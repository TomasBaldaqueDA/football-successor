-- Control Score card (Mustermann-inspired, adapted to real data columns)
-- - 4 components: Creation, Scoring, Pressure, Possession
-- - Outputs 4 profile cards: Defend / Support / Create / Score
-- - No single final score; each card has its own weighted value
-- - Uses raw merged metrics only (no league coefficient)

create schema if not exists mart;

drop function if exists mart.control_score_profile(bigint, text, text, numeric, numeric);
drop function if exists mart.control_score_card(bigint, text, numeric, numeric);
drop function if exists mart.control_score_card(bigint, text, numeric);

create or replace function mart.control_score_card(
  p_player_id bigint,
  p_selected_bucket text default 'CM',
  p_loss_penalty_floor numeric default 0.75
)
returns table (
  player_id bigint,
  selected_bucket text,
  creation_index double precision,
  scoring_index double precision,
  pressure_index double precision,
  possession_index double precision,
  possession_loss_rate double precision,
  defend_score double precision,
  support_score double precision,
  create_score double precision,
  score_score double precision,
  season_minutes integer,
  season_goals integer,
  season_assists integer
)
language sql
stable
parallel safe
as $fn$
with bucket_guard as (
  select 1 as ok
  from mart.player_position_membership pm
  where pm.player_id = p_player_id
    and pm.position_bucket = p_selected_bucket
  limit 1
),
population as (
  select
    m.player_id,
    to_jsonb(m) as j
  from mart.player_profile_merged_v1 m
  join mart.player_position_membership pm
    on pm.player_id = m.player_id
   and pm.position_bucket = p_selected_bucket
),
pop_features as (
  select
    p.player_id,
    -- creation
    coalesce((p.j ->> 'xA_per_90_merged')::double precision, (p.j ->> 'xa_per_90_merged')::double precision, 0.0) as xa_p90,
    coalesce((p.j ->> 'key_passes_per_90_merged')::double precision, (p.j ->> 'key_passes_p90_merged')::double precision, 0.0) as key_passes_p90,
    coalesce((p.j ->> 'chances_created_per_90_merged')::double precision, (p.j ->> 'created_opp_per_90_merged')::double precision, 0.0) as created_opp_p90,
    -- scoring
    coalesce((p.j ->> 'goals_per_90_merged')::double precision, (p.j ->> 'goals_p90_merged')::double precision, 0.0) as goals_p90,
    coalesce((p.j ->> 'xg_per_90_merged')::double precision, 0.0) as xg_p90,
    coalesce((p.j ->> 'shots_per_90_merged')::double precision, (p.j ->> 'shots_p90_merged')::double precision, 0.0) as shots_p90,
    -- pressure/defense
    coalesce((p.j ->> 'defensive_actions_per_90_merged')::double precision, (p.j ->> 'defensive_actions_p90_merged')::double precision, 0.0) as defensive_actions_p90,
    coalesce((p.j ->> 'tackles_per_90_merged')::double precision, (p.j ->> 'tackles_p90_merged')::double precision, 0.0) as tackles_p90,
    coalesce((p.j ->> 'interceptions_per_90_merged')::double precision, (p.j ->> 'interceptions_p90_merged')::double precision, 0.0) as interceptions_p90,
    coalesce((p.j ->> 'recoveries_per_90_merged')::double precision, 0.0) as recoveries_p90,
    -- possession / ball security
    coalesce((p.j ->> 'pass_success_pct_merged')::double precision, 0.0) as pass_success_pct,
    coalesce((p.j ->> 'passes_per_90_merged')::double precision, (p.j ->> 'passes_p90_merged')::double precision, 0.0) as passes_p90,
    coalesce((p.j ->> 'duels_won_pct_merged')::double precision, 0.0) as duels_won_pct,
    coalesce((p.j ->> 'touches_per_90_merged')::double precision, 0.0) as touches_p90,
    coalesce((p.j ->> 'turnovers_per_90_merged')::double precision, (p.j ->> 'turnovers_p90_merged')::double precision, 0.0) as turnovers_p90,
    coalesce((p.j ->> 'dispossessed_per_90_merged')::double precision, (p.j ->> 'dispossessed_p90_merged')::double precision, 0.0) as dispossessed_p90,
    coalesce((p.j ->> 'possession_lost_rate_merged')::double precision, (p.j ->> 'possession_loss_rate_merged')::double precision, null) as possession_loss_direct,
    coalesce((p.j ->> 'goals_merged')::double precision, null) as goals_total,
    coalesce((p.j ->> 'assists_merged')::double precision, null) as assists_total
  from population p
),
latest_pool as (
  select
    p.player_id,
    coalesce(
      nullif((to_jsonb(p) ->> 'minutes_played')::double precision, 0.0),
      nullif((to_jsonb(p) ->> 'minutes')::double precision, 0.0),
      nullif((to_jsonb(p) ->> 'mins_played')::double precision, 0.0),
      nullif((to_jsonb(p) ->> 'minutes_total')::double precision, 0.0),
      nullif((to_jsonb(p) ->> 'total_minutes')::double precision, 0.0),
      nullif((to_jsonb(p) ->> 'time_played')::double precision, 0.0),
      0.0
    )::int as minutes_played
  from mart.player_pool_clean_tbl p
  where p.player_id = p_player_id
  order by p.season_slug desc nulls last
  limit 1
),
pop_idx as (
  select
    v.player_id,
    v.goals_p90,
    v.xa_p90,
    -- raw component scores
    (
      0.35 * v.xa_p90 +
      0.35 * v.key_passes_p90 +
      0.30 * v.created_opp_p90
    ) as creation_raw,
    (
      0.40 * v.goals_p90 +
      0.35 * v.xg_p90 +
      0.25 * v.shots_p90
    ) as scoring_raw,
    (
      0.45 * v.defensive_actions_p90 +
      0.30 * v.tackles_p90 +
      0.15 * v.interceptions_p90 +
      0.10 * v.recoveries_p90
    ) as pressure_raw,
    (
      0.45 * (v.pass_success_pct / 100.0) +
      0.25 * (v.duels_won_pct / 100.0) +
      0.20 * (v.passes_p90 / 60.0) +
      0.10 * (v.recoveries_p90 / 6.0)
    ) as possession_raw,
    least(
      0.60,
      greatest(
        0.0,
        coalesce(
          case
            when v.possession_loss_direct is null then null
            when v.possession_loss_direct > 1.0 then v.possession_loss_direct / 100.0
            else v.possession_loss_direct
          end,
          (v.turnovers_p90 + v.dispossessed_p90) / nullif(greatest(v.touches_p90, 1.0), 0.0),
          (v.turnovers_p90 + v.dispossessed_p90) / nullif(greatest(v.passes_p90, 1.0), 0.0),
          0.0
        )
      )
    ) as possession_loss_rate,
    v.goals_total,
    v.assists_total
  from pop_features v
),
pop_pct as (
  select
    p.*,
    100.0 * percent_rank() over (order by p.creation_raw) as creation_index,
    100.0 * percent_rank() over (order by p.scoring_raw) as scoring_index,
    100.0 * percent_rank() over (order by p.pressure_raw) as pressure_index,
    100.0 * percent_rank() over (order by p.possession_raw) as possession_index
  from pop_idx p
),
target as (
  select *
  from pop_pct
  where player_id = p_player_id
),
sc as (
  select
    t.*,
    coalesce(lp.minutes_played, 0)::int as season_minutes,
    greatest(p_loss_penalty_floor::double precision, 1.0 - t.possession_loss_rate) as loss_factor
  from target t
  left join latest_pool lp
    on lp.player_id = t.player_id
  where exists (select 1 from bucket_guard)
)
select
  sc.player_id,
  p_selected_bucket as selected_bucket,
  sc.creation_index,
  sc.scoring_index,
  sc.pressure_index,
  sc.possession_index,
  sc.possession_loss_rate,
  ((0.00 * sc.creation_index + 0.00 * sc.scoring_index + 0.20 * sc.pressure_index + 0.80 * sc.possession_index) * sc.loss_factor) as defend_score,
  ((0.20 * sc.creation_index + 0.00 * sc.scoring_index + 0.40 * sc.pressure_index + 0.40 * sc.possession_index) * sc.loss_factor) as support_score,
  ((0.60 * sc.creation_index + 0.20 * sc.scoring_index + 0.20 * sc.pressure_index + 0.00 * sc.possession_index) * sc.loss_factor) as create_score,
  ((0.20 * sc.creation_index + 0.60 * sc.scoring_index + 0.20 * sc.pressure_index + 0.00 * sc.possession_index) * sc.loss_factor) as score_score,
  sc.season_minutes,
  coalesce(sc.goals_total::int, round(coalesce(sc.goals_p90, 0.0) * sc.season_minutes / 90.0)::int) as season_goals,
  coalesce(sc.assists_total::int, round(coalesce(sc.xa_p90, 0.0) * sc.season_minutes / 90.0)::int) as season_assists
from sc;
$fn$;

comment on function mart.control_score_card(bigint, text, numeric) is
  'Control Score card: CI/SI/PrI/PoI + possession loss rate + four profile cards (defend/support/create/score), raw merged only, no league adjustment.';

-- Example:
-- select * from mart.control_score_card(12345, 'CM', 0.75);

