-- Upgrade replacement:
-- L4L-compatible candidate set, but score upgrades only on positive metric deltas.
--
-- Core idea:
-- - delta_i = candidate_i - target_i
-- - improvement_i = max(delta_i, 0)
-- - effective_weight_i = base_weight_i * target_relevance_i
-- - upgrade_raw = sum(effective_weight_i * improvement_i) / sum(effective_weight_i)
--
-- The target_relevance_i term reinforces metrics where target already has stronger values.

create schema if not exists mart;

drop function if exists mart.upgrade_replacements(bigint, text, int, text, int, int, int, double precision);

create or replace function mart.upgrade_replacements(
  p_target_player_id bigint,
  p_selected_bucket text,
  p_top_n int default 20,
  p_weight_version text default 'v1_manual',
  p_fit_floor int default 70,
  p_min_positive_metrics int default 2,
  p_min_positive_top_metrics int default 1,
  p_subpos_bonus_weight double precision default 0.15
)
returns table (
  upgrade_rank bigint,
  player_id bigint,
  player_name text,
  upgrade_score double precision,
  upgrade_raw double precision,
  key_upgrade_bonus double precision,
  sub_position_bonus double precision,
  fit_now_score double precision,
  l2_distance double precision,
  positive_metrics_count int,
  positive_top_metrics_count int
)
language sql
stable
parallel safe
as $fn$
with
tgt as (
  select to_jsonb(m) as j
  from mart.player_profile_merged_v1 m
  where m.player_id = p_target_player_id
),
tgt_has_bucket as (
  select 1 as ok
  from mart.player_position_membership pm
  where pm.player_id = p_target_player_id
    and pm.position_bucket = p_selected_bucket
  limit 1
),
target_subpos as (
  select
    case
      when coalesce(d.played_positions_short, '') ~* '(^|[,\s/;-])(RB)([,\s/;-]|$)' then 'RB'
      when coalesce(d.played_positions_short, '') ~* '(^|[,\s/;-])(RWB)([,\s/;-]|$)' then 'RWB'
      when coalesce(d.played_positions_short, '') ~* '(^|[,\s/;-])(LB)([,\s/;-]|$)' then 'LB'
      when coalesce(d.played_positions_short, '') ~* '(^|[,\s/;-])(LWB)([,\s/;-]|$)' then 'LWB'
      else null
    end as target_side_pos
  from mart.player_dim d
  where d.player_id = p_target_player_id
),
weights as (
  select
    w.metric_column,
    w.weight::double precision as base_weight
  from mart.l4l_metric_weights w
  where w.position_bucket = p_selected_bucket
    and w.weight_version = p_weight_version
),
target_metric_values as (
  select
    w.metric_column,
    w.base_weight,
    coalesce((t.j ->> w.metric_column)::double precision, 0.0) as target_value
  from weights w
  cross join tgt t
  where exists (select 1 from tgt)
),
target_scale as (
  select
    greatest(max(abs(target_value)), 0.001) as max_abs_target_value
  from target_metric_values
),
effective_weights as (
  select
    tm.metric_column,
    tm.target_value,
    tm.base_weight,
    -- stronger separation for important bucket metrics
    power(greatest(tm.base_weight, 0.000001), 1.35) as bucket_importance_weight,
    -- relevance in [1.0, 2.6], stronger where target metric is stronger
    (
      1.0 + 1.6 * power(abs(tm.target_value) / ts.max_abs_target_value, 1.2)
    ) as target_strength_factor,
    power(greatest(tm.base_weight, 0.000001), 1.35) * (
      1.0 + 1.6 * power(abs(tm.target_value) / ts.max_abs_target_value, 1.2)
    ) as effective_weight
  from target_metric_values tm
  cross join target_scale ts
),
top_metrics as (
  select ew.metric_column
  from effective_weights ew
  order by ew.effective_weight desc
  limit 4
),
candidates as (
  select
    m.player_id,
    to_jsonb(m) as j,
    case
      when coalesce(d.played_positions_short, '') ~* '(^|[,\s/;-])(RB)([,\s/;-]|$)' then 'RB'
      when coalesce(d.played_positions_short, '') ~* '(^|[,\s/;-])(RWB)([,\s/;-]|$)' then 'RWB'
      when coalesce(d.played_positions_short, '') ~* '(^|[,\s/;-])(LB)([,\s/;-]|$)' then 'LB'
      when coalesce(d.played_positions_short, '') ~* '(^|[,\s/;-])(LWB)([,\s/;-]|$)' then 'LWB'
      else null
    end as candidate_side_pos
  from mart.player_profile_merged_v1 m
  join mart.player_position_membership pm
    on pm.player_id = m.player_id
   and pm.position_bucket = p_selected_bucket
  left join mart.player_dim d
    on d.player_id = m.player_id
  where m.player_id <> p_target_player_id
),
fit_and_upgrade as (
  select
    c.player_id,
    c.candidate_side_pos,
    sqrt(
      coalesce(sum(
        ew.bucket_importance_weight * power(
          coalesce((c.j ->> ew.metric_column)::double precision, 0.0) - ew.target_value,
          2.0
        )
      ), 0.0)
    ) as l2_distance,
    coalesce(sum(
      ew.effective_weight * greatest(
        coalesce((c.j ->> ew.metric_column)::double precision, 0.0) - ew.target_value,
        0.0
      )
    ), 0.0) / nullif(sum(ew.effective_weight), 0.0) as upgrade_raw,
    count(*) filter (
      where coalesce((c.j ->> ew.metric_column)::double precision, 0.0) - ew.target_value > 0
    )::int as positive_metrics_count,
    count(*) filter (
      where coalesce((c.j ->> ew.metric_column)::double precision, 0.0) - ew.target_value > 0
        and ew.metric_column in (select metric_column from top_metrics)
    )::int as positive_top_metrics_count
  from candidates c
  cross join effective_weights ew
  where exists (select 1 from tgt_has_bucket)
  group by c.player_id, c.candidate_side_pos
),
eligible as (
  select
    f.*,
    (100.0 / (1.0 + f.l2_distance)) as fit_now_score,
    100.0 * least(1.0, f.positive_top_metrics_count::double precision / 2.0) as key_upgrade_bonus,
    case
      when p_selected_bucket <> 'FB' then 0.0
      when ts.target_side_pos is null or f.candidate_side_pos is null then 0.0
      when ts.target_side_pos = f.candidate_side_pos then 100.0
      when ts.target_side_pos in ('RB', 'RWB') and f.candidate_side_pos in ('RB', 'RWB') then 70.0
      when ts.target_side_pos in ('LB', 'LWB') and f.candidate_side_pos in ('LB', 'LWB') then 70.0
      else 0.0
    end as sub_position_bonus
  from fit_and_upgrade f
  cross join target_subpos ts
  where (100.0 / (1.0 + f.l2_distance)) >= greatest(p_fit_floor, 1)
    and f.positive_metrics_count >= greatest(p_min_positive_metrics, 1)
    and f.positive_top_metrics_count >= (
      case
        when p_selected_bucket = 'FB' then greatest(p_min_positive_top_metrics, 2)
        else greatest(p_min_positive_top_metrics, 0)
      end
    )
),
scaled as (
  select
    e.*,
    max(e.upgrade_raw) over () as max_upgrade_raw
  from eligible e
)
select
  row_number() over (
    order by
      (
        case
          when p_selected_bucket = 'FB' then
            0.55 * (
              case
                when s.max_upgrade_raw > 0 then 100.0 * s.upgrade_raw / s.max_upgrade_raw
                else 0.0
              end
            ) + 0.30 * s.key_upgrade_bonus + least(greatest(p_subpos_bonus_weight, 0.0), 0.3) * s.sub_position_bonus
          else
            0.8 * (
              case
                when s.max_upgrade_raw > 0 then 100.0 * s.upgrade_raw / s.max_upgrade_raw
                else 0.0
              end
            ) + 0.2 * s.key_upgrade_bonus
        end
      ) desc,
      s.fit_now_score desc
  )::bigint as upgrade_rank,
  s.player_id,
  coalesce(d.player_name, ''::text) as player_name,
  (
    case
      when p_selected_bucket = 'FB' then
        0.55 * (
          case
            when s.max_upgrade_raw > 0 then 100.0 * s.upgrade_raw / s.max_upgrade_raw
            else 0.0
          end
        ) + 0.30 * s.key_upgrade_bonus + least(greatest(p_subpos_bonus_weight, 0.0), 0.3) * s.sub_position_bonus
      else
        0.8 * (
          case
            when s.max_upgrade_raw > 0 then 100.0 * s.upgrade_raw / s.max_upgrade_raw
            else 0.0
          end
        ) + 0.2 * s.key_upgrade_bonus
    end
  ) as upgrade_score,
  s.upgrade_raw,
  s.key_upgrade_bonus,
  s.sub_position_bonus,
  s.fit_now_score,
  s.l2_distance,
  s.positive_metrics_count,
  s.positive_top_metrics_count
from scaled s
left join mart.player_dim d
  on d.player_id = s.player_id
order by upgrade_score desc, fit_now_score desc
limit greatest(coalesce(nullif(p_top_n, 0), 20), 1);
$fn$;

comment on function mart.upgrade_replacements(bigint, text, int, text, int, int, int, double precision) is
  'Upgrade replacement v3: positive deltas only, amplified by bucket importance and target strengths, with key-metric bonus plus FB sub-position bonus and stronger FB key-metric gate.';

-- Example:
-- select * from mart.upgrade_replacements(12345::bigint, 'AM', 20, 'v1_manual', 70, 2, 1, 0.15);

