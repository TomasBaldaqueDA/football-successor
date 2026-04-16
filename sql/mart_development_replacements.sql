-- Development replacement:
-- young candidates with role compatibility + upside weighting.
--
-- Score mix (v1):
--   development_score =
--     0.30 * fit_now_score +
--     0.45 * upside_score +
--     0.15 * trajectory_score +
--     0.10 * readiness_score
--
-- Closed defaults for this project:
-- - Age:
--   * default 15-22
--   * CB exception max age 23
-- - Minutes:
--   * sourced from mart.player_pool_clean_tbl (latest season per player)
--   * used only for readiness bucket/score

create schema if not exists mart;

drop function if exists mart.development_replacements(bigint, text, int, text, int, int, int);

create or replace function mart.development_replacements(
  p_target_player_id bigint,
  p_selected_bucket text,
  p_top_n int default 20,
  p_weight_version text default 'v1_manual',
  p_min_age int default 15,
  p_max_age int default 22,
  p_cb_max_age int default 23
)
returns table (
  development_rank bigint,
  player_id bigint,
  player_name text,
  development_score double precision,
  fit_now_score double precision,
  upside_score double precision,
  trajectory_score double precision,
  readiness_score double precision,
  readiness_bucket text,
  development_gap_to_target double precision,
  role_score double precision,
  role_distance double precision,
  age_last_season int,
  minutes_played double precision
)
language sql
stable
parallel safe
as $fn$
with
cfg as (
  select
    case
      when lower(p_selected_bucket) in ('st', 'cf', 'ss', 'lw', 'rw', 'lf', 'rf') then 'attack'
      when lower(p_selected_bucket) in ('am', 'cm', 'dm', 'lm', 'rm') then 'midfield'
      when lower(p_selected_bucket) in ('cb', 'lcb', 'rcb', 'lb', 'rb', 'wb', 'lwb', 'rwb') then 'defense'
      else 'other'
    end as bucket_family
),
cfg_weights as (
  select
    c.bucket_family,
    case when c.bucket_family = 'attack' then 0.45
         when c.bucket_family = 'midfield' then 0.40
         when c.bucket_family = 'defense' then 0.42
         else 0.35 end as w_fit,
    case when c.bucket_family = 'attack' then 0.30
         when c.bucket_family = 'midfield' then 0.35
         when c.bucket_family = 'defense' then 0.33
         else 0.40 end as w_upside,
    0.15::double precision as w_trajectory,
    0.10::double precision as w_readiness,
    case when c.bucket_family = 'attack' then 58.0
         when c.bucket_family = 'midfield' then 55.0
         when c.bucket_family = 'defense' then 57.0
         else 53.0 end as fit_floor,
    case when c.bucket_family = 'attack' then 42.0
         when c.bucket_family = 'midfield' then 40.0
         when c.bucket_family = 'defense' then 41.0
         else 38.0 end as key_gate_floor
  from cfg c
),
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
weights as (
  select
    w.metric_column,
    w.weight::double precision as weight
  from mart.l4l_metric_weights w
  where w.position_bucket = p_selected_bucket
    and w.weight_version = p_weight_version
),
top_metrics as (
  select w.metric_column, w.weight
  from weights w
  order by w.weight desc
  limit 3
),
candidates as (
  select
    m.player_id,
    to_jsonb(m) as j,
    dim.player_name,
    dim.age_last_season,
    coalesce(mp.minutes_played, 0.0) as minutes_played
  from mart.player_profile_merged_v1 m
  join mart.player_position_membership pm
    on pm.player_id = m.player_id
   and pm.position_bucket = p_selected_bucket
  join mart.player_dim dim
    on dim.player_id = m.player_id
  left join lateral (
    select
      coalesce(
        nullif((to_jsonb(t) ->> 'minutes_played')::double precision, 0.0),
        nullif((to_jsonb(t) ->> 'minutes')::double precision, 0.0),
        nullif((to_jsonb(t) ->> 'mins_played')::double precision, 0.0),
        nullif((to_jsonb(t) ->> 'minutes_total')::double precision, 0.0),
        nullif((to_jsonb(t) ->> 'total_minutes')::double precision, 0.0),
        nullif((to_jsonb(t) ->> 'time_played')::double precision, 0.0),
        0.0
      ) as minutes_played
    from mart.player_pool_clean_tbl t
    where t.player_id = m.player_id
    order by t.season_slug desc nulls last
    limit 1
  ) mp on true
  where m.player_id <> p_target_player_id
    and dim.age_last_season is not null
    and dim.age_last_season >= p_min_age
    and dim.age_last_season <= case
      when lower(p_selected_bucket) in ('cb', 'lcb', 'rcb', 'dc', 'dfc') then p_cb_max_age
      else p_max_age
    end
),
role_scores as (
  select
    c.player_id,
    c.player_name,
    c.age_last_season,
    c.minutes_played,
    sqrt(
      coalesce(sum(
        w.weight * power(
          coalesce((c.j ->> w.metric_column)::double precision, 0.0)
          - coalesce((t.j ->> w.metric_column)::double precision, 0.0),
          2.0
        )
      ), 0.0)
    ) as l2_distance
  from candidates c
  cross join tgt t
  cross join weights w
  where exists (select 1 from tgt_has_bucket)
    and exists (select 1 from tgt)
  group by c.player_id, c.player_name, c.age_last_season, c.minutes_played
),
scored as (
  select
    rs.player_id,
    rs.player_name,
    rs.l2_distance,
    rs.age_last_season,
    rs.minutes_played,
    (100.0 / (1.0 + rs.l2_distance)) as fit_now_score
  from role_scores rs
),
fit_dist as (
  select
    s.*,
    stddev_samp(s.fit_now_score) over () as fit_sd
  from scored s
),
components as (
  select
    s.*,
    coalesce(
      (
        select avg(
          greatest(
            0.0,
            100.0 * (
              1.0 - (
                abs(
                  coalesce((cj.j ->> tm.metric_column)::double precision, 0.0)
                  - coalesce((tj.j ->> tm.metric_column)::double precision, 0.0)
                )
                / greatest(abs(coalesce((tj.j ->> tm.metric_column)::double precision, 0.0)), 0.15)
              )
            )
          )
        )
        from top_metrics tm
      ),
      0.0
    ) as key_metric_similarity_score,
    greatest(
      0.0,
      least(
        100.0,
        100.0 * (
          (
            case
              when lower(p_selected_bucket) in ('cb', 'lcb', 'rcb', 'dc', 'dfc') then p_cb_max_age
              else p_max_age
            end
          ) - s.age_last_season
        )::double precision /
        greatest(
          (
            case
              when lower(p_selected_bucket) in ('cb', 'lcb', 'rcb', 'dc', 'dfc') then p_cb_max_age
              else p_max_age
            end
          )::double precision - p_min_age::double precision,
          1.0
        )
      )
    ) as age_upside_score,
    (100.0 / (1.0 + abs((100.0 - s.fit_now_score) / coalesce(nullif(s.fit_sd, 0.0), 1.0) - 0.5))) as gap_upside_score,
    (100.0 / (1.0 + abs((100.0 - s.fit_now_score) / coalesce(nullif(s.fit_sd, 0.0), 1.0) - 0.2))) as trajectory_score,
    greatest(0.0, least(100.0, 100.0 * s.minutes_played / 2500.0)) as readiness_score
  from fit_dist s
  join candidates cj
    on cj.player_id = s.player_id
  cross join tgt tj
),
eligible as (
  select
    c.player_id,
    c.player_name,
    null::double precision as role_score,
    c.l2_distance as role_distance,
    c.age_last_season,
    c.minutes_played,
    ((100.0 - c.fit_now_score) / coalesce(nullif(c.fit_sd, 0.0), 1.0)) as development_gap_to_target,
    c.fit_now_score,
    c.key_metric_similarity_score,
    (0.70 * c.age_upside_score + 0.30 * c.gap_upside_score) as upside_score,
    c.trajectory_score,
    c.readiness_score,
    case
      when c.minutes_played >= 1500 then 'near_starter'
      else 'rotation_ready'
    end as readiness_bucket
  from components c
  cross join cfg_weights cw
  where c.fit_now_score >= cw.fit_floor
    and c.key_metric_similarity_score >= cw.key_gate_floor
),
final_scores as (
  select
    e.player_id,
    e.player_name,
    e.role_score,
    e.role_distance,
    e.age_last_season,
    e.minutes_played,
    e.development_gap_to_target,
    e.fit_now_score,
    e.upside_score,
    e.trajectory_score,
    e.readiness_score,
    e.readiness_bucket,
    e.key_metric_similarity_score,
    least(10.0, greatest(0.0, e.key_metric_similarity_score * 0.10)) as key_metric_bonus
  from eligible e
)
select
  row_number() over (
    order by
      (
        cw.w_fit * f.fit_now_score +
        cw.w_upside * f.upside_score +
        cw.w_trajectory * f.trajectory_score +
        cw.w_readiness * f.readiness_score +
        f.key_metric_bonus
      ) desc,
      f.key_metric_similarity_score desc,
      f.upside_score desc,
      f.fit_now_score desc
  )::bigint as development_rank,
  f.player_id,
  coalesce(f.player_name, ''::text) as player_name,
  (
    cw.w_fit * f.fit_now_score +
    cw.w_upside * f.upside_score +
    cw.w_trajectory * f.trajectory_score +
    cw.w_readiness * f.readiness_score +
    f.key_metric_bonus
  ) as development_score,
  f.fit_now_score,
  f.upside_score,
  f.trajectory_score,
  f.readiness_score,
  f.readiness_bucket,
  f.development_gap_to_target,
  f.role_score,
  f.role_distance,
  f.age_last_season,
  f.minutes_played
from final_scores f
cross join cfg_weights cw
order by development_score desc, f.key_metric_similarity_score desc, upside_score desc, fit_now_score desc
limit greatest(coalesce(nullif(p_top_n, 0), 20), 1);
$fn$;

comment on function mart.development_replacements(bigint, text, int, text, int, int, int) is
  'Development replacement v1: upside-first ranking (fit 30%, upside 45%, trajectory 15%, readiness 10%). Minutes sourced from latest mart.player_pool_clean_tbl season and used only for readiness.';

-- Example:
-- select *
-- from mart.development_replacements(12345::bigint, 'CM', 20, 'v1_manual', 15, 22, 23);

