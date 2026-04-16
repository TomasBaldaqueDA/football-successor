-- Budget replacement:
-- find candidates with strong fit at lower cost than target.
--
-- v1 decisions:
-- - budget mode: relative to target market value
-- - floor: fit_now_score >= 80
-- - fit_now uses L4L weighted metric distance by bucket

create schema if not exists mart;

drop function if exists mart.budget_replacements(bigint, text, int, text, numeric, int, int);
drop function if exists mart.budget_replacements(bigint, text, int, text, numeric, numeric, int, int, numeric);
drop function if exists mart.budget_replacements(bigint, text, int, text, numeric, int, int, numeric);

create or replace function mart.budget_replacements(
  p_target_player_id bigint,
  p_selected_bucket text,
  p_top_n int default 20,
  p_weight_version text default 'v1_manual',
  p_budget_ratio numeric default 0.70,         -- upper cap vs target value
  p_fit_floor int default 80,
  p_min_minutes int default 0,
  p_league_bonus_weight numeric default 0.15
)
returns table (
  budget_rank bigint,
  player_id bigint,
  player_name text,
  value_for_money_score double precision,
  fit_now_score double precision,
  cost_efficiency_score double precision,
  readiness_score double precision,
  league_strength_score double precision,
  budget_ratio_to_target double precision,
  target_market_value_eur bigint,
  candidate_market_value_eur bigint,
  savings_eur bigint,
  l2_distance double precision,
  minutes_played double precision
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
tgt_dim as (
  select
    d.player_id,
    d.player_name,
    d.market_value_eur,
    d.age_last_season as target_age,
    coalesce((t.j ->> 'league_strength_coefficient')::double precision, 1.0) as target_league_coeff,
    least(
      d.market_value_eur::double precision * greatest(least(p_budget_ratio, 1.0), 0.05),
      greatest(
        20000000.0,
        d.market_value_eur::double precision * 0.2667
      )
    ) as dynamic_budget_cap_eur
  from mart.player_dim d
  left join tgt t on true
  where d.player_id = p_target_player_id
    and d.market_value_eur is not null
    and d.market_value_eur > 0
    and d.age_last_season is not null
  limit 1
),
weights as (
  select w.metric_column, w.weight::double precision as weight
  from mart.l4l_metric_weights w
  where w.position_bucket = p_selected_bucket
    and w.weight_version = p_weight_version
),
candidates as (
  select
    m.player_id,
    to_jsonb(m) as j,
    d.player_name,
    d.market_value_eur as candidate_market_value_eur,
    coalesce((to_jsonb(m) ->> 'league_strength_coefficient')::double precision, 1.0) as candidate_league_coeff,
    d.age_last_season as candidate_age,
    coalesce(mp.minutes_played, 0.0) as minutes_played
  from mart.player_profile_merged_v1 m
  join mart.player_position_membership pm
    on pm.player_id = m.player_id
   and pm.position_bucket = p_selected_bucket
  join mart.player_dim d
    on d.player_id = m.player_id
  join tgt_dim td
    on d.market_value_eur is not null
   and d.market_value_eur > 0
   and d.market_value_eur <= td.dynamic_budget_cap_eur
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
    and d.age_last_season is not null
    and d.age_last_season between 15 and
      case
        when td.target_age between 26 and 35 then td.target_age + 2
        when td.target_age between 15 and 25 then td.target_age + 3
        else 28
      end
    and coalesce(mp.minutes_played, 0.0) >= greatest(p_min_minutes, 0)
),
dist as (
  select
    c.player_id,
    c.player_name,
    c.candidate_market_value_eur,
    c.candidate_league_coeff,
    c.candidate_age,
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
  group by
    c.player_id,
    c.player_name,
    c.candidate_market_value_eur,
    c.candidate_league_coeff,
    c.candidate_age,
    c.minutes_played
),
scored as (
  select
    d.*,
    td.market_value_eur as target_market_value_eur,
    (100.0 / (1.0 + d.l2_distance)) as fit_now_score,
    greatest(0.0, least(100.0,
      100.0 * (
        1.0 - abs(
          (d.candidate_market_value_eur::double precision / td.market_value_eur::double precision) - 0.45
        ) / 0.40
      )
    )) as cost_efficiency_score,
    greatest(0.0, least(100.0, 100.0 * d.minutes_played / 2500.0)) as readiness_score,
    greatest(0.0, least(100.0,
      case
        when td.target_league_coeff > 0
          then 100.0 * least(d.candidate_league_coeff / td.target_league_coeff, 1.0)
        else 50.0
      end
    )) as league_strength_score
  from dist d
  cross join tgt_dim td
),
eligible as (
  select
    s.*,
    (s.target_market_value_eur - s.candidate_market_value_eur) as savings_eur,
    (s.candidate_market_value_eur::double precision / s.target_market_value_eur::double precision) as budget_ratio_to_target
  from scored s
  where s.fit_now_score >= greatest(p_fit_floor, 1)
),
final_scores as (
  select
    e.*,
    (e.candidate_market_value_eur::double precision / e.target_market_value_eur::double precision) as candidate_ratio,
    greatest(
      0.55,
      least(
        1.0,
        (e.candidate_market_value_eur::double precision / e.target_market_value_eur::double precision) / 0.15
      )
    ) as cheap_penalty,
    (
      0.45 * e.fit_now_score +
      (0.40 - greatest(least(p_league_bonus_weight, 0.30), 0.0)) * (
        e.cost_efficiency_score *
        greatest(
          0.55,
          least(
            1.0,
            (e.candidate_market_value_eur::double precision / e.target_market_value_eur::double precision) / 0.15
          )
        )
      ) +
      0.15 * e.readiness_score +
      greatest(least(p_league_bonus_weight, 0.30), 0.0) * e.league_strength_score
    ) as value_for_money_score
  from eligible e
)
select
  row_number() over (
    order by
      f.value_for_money_score desc,
      f.fit_now_score desc,
      f.cost_efficiency_score desc
  )::bigint as budget_rank,
  f.player_id,
  coalesce(f.player_name, ''::text) as player_name,
  f.value_for_money_score,
  f.fit_now_score,
  f.cost_efficiency_score,
  f.readiness_score,
  f.league_strength_score,
  f.budget_ratio_to_target,
  f.target_market_value_eur,
  f.candidate_market_value_eur,
  f.savings_eur,
  f.l2_distance,
  f.minutes_played
from final_scores f
order by f.value_for_money_score desc, f.fit_now_score desc, f.cost_efficiency_score desc
limit greatest(coalesce(nullif(p_top_n, 0), 20), 1);
$fn$;

comment on function mart.budget_replacements(bigint, text, int, text, numeric, int, int, numeric) is
  'Budget replacement v1.2: dynamic upper budget cap, soft cheap-penalty (no hard min cap), dynamic age rule, fit floor, league bonus, and value-for-money ranking.';

-- Example:
-- select *
-- from mart.budget_replacements(12345::bigint, 'CM', 20, 'v1_manual', 0.70, 80, 0, 0.15);

