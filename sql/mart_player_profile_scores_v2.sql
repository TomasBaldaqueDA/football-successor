-- Control scores v2 from existing merged base table.
-- Source: mart.player_profile_raw_coeff_merged_v1
-- Output: mart.player_profile_raw_coeff_merged_v2
--
-- Formulas exactly as requested:
--  Pressure_Index, Possession_Index, Creation_Index, Scoring_Index,
--  Possession_Lost_Rate, index normalizations (0..1),
--  Defend/Support/Create/Score final scores.

create schema if not exists mart;

drop table if exists mart.player_profile_raw_coeff_merged_v2;

create table mart.player_profile_raw_coeff_merged_v2 as
select *
from mart.player_profile_raw_coeff_merged_v1;

alter table mart.player_profile_raw_coeff_merged_v2
  add column if not exists pressure_index_v2 double precision,
  add column if not exists possession_index_v2 double precision,
  add column if not exists creation_index_v2 double precision,
  add column if not exists scoring_index_v2 double precision,
  add column if not exists possession_lost_rate_v2 double precision,
  add column if not exists pressure_index_v2_norm double precision,
  add column if not exists possession_index_v2_norm double precision,
  add column if not exists creation_index_v2_norm double precision,
  add column if not exists scoring_index_v2_norm double precision,
  add column if not exists defend_score_v2 double precision,
  add column if not exists support_score_v2 double precision,
  add column if not exists create_score_v2 double precision,
  add column if not exists score_score_v2 double precision,
  add column if not exists possession_lost_score_v2 double precision;

-- 1) Recompute indexes (raw)
update mart.player_profile_raw_coeff_merged_v2 t
set
  pressure_index_v2 =
    (
      coalesce(t.tackles_p90_merged, 0.0)
      + coalesce(t.interceptions_p90_merged, 0.0)
      + coalesce(t.blocks_p90_merged, 0.0)
    )
    *
    (
      (
        coalesce(t.tackles_p90_merged, 0.0)
        + coalesce(t.interceptions_p90_merged, 0.0)
        + coalesce(t.blocks_p90_merged, 0.0)
      )
      /
      nullif(
        coalesce(t.tackles_p90_merged, 0.0)
        + coalesce(t.interceptions_p90_merged, 0.0)
        + coalesce(t.blocks_p90_merged, 0.0)
        + coalesce(t.dribbled_past_p90_merged, 0.0),
        0.0
      )
    ),

  possession_index_v2 =
      (
        coalesce(t.tackles_p90_merged, 0.0)
        + coalesce(t.interceptions_p90_merged, 0.0)
        + coalesce(t.dribbles_won_p90_merged, 0.0)
        + coalesce(t.aerial_won_p90_merged, 0.0)
      )
    + (
        coalesce(t.passes_p90_merged, 0.0)
        * coalesce(t.pass_success_pct_merged, 0.0)
      )
    + (
        0.5 * (
          coalesce(t.accurate_long_passes_p90_merged, 0.0)
          + coalesce(t.accurate_through_balls_p90_merged, 0.0)
        )
      ),

  creation_index_v2 =
    (
      coalesce(t.key_passes_p90_merged, 0.0)
      + coalesce(t.accurate_through_balls_p90_merged, 0.0)
      + coalesce(t.accurate_crosses_p90_merged, 0.0)
      + coalesce(t.assists_p90_merged, 0.0)
    )
    *
    (
      (
        coalesce(t.key_passes_p90_merged, 0.0)
        + coalesce(t.accurate_through_balls_p90_merged, 0.0)
        + coalesce(t.accurate_crosses_p90_merged, 0.0)
        + coalesce(t.assists_p90_merged, 0.0)
      )
      / nullif(coalesce(t.key_passes_p90_merged, 0.0), 0.0)
    ),

  scoring_index_v2 =
    (
      coalesce(t.goals_p90_merged, 0.0)
      * (
          coalesce(t.xg_per_90_merged, 0.0)
          / nullif(coalesce(t.shots_p90_merged, 0.0), 0.0)
        )
    ),

  possession_lost_rate_v2 =
    greatest(
      0.0,
      least(
        1.0,
        1.0 - (
          (
            coalesce(t.turnovers_p90_merged, 0.0)
            + coalesce(t.dispossessed_p90_merged, 0.0)
          )
          / nullif(coalesce(t.passes_p90_merged, 0.0), 0.0)
        )
      )
    );

-- 2) Normalize four indexes to 0..1 (min-max)
with mm as (
  select
    min(pressure_index_v2) as pressure_min,
    max(pressure_index_v2) as pressure_max,
    min(possession_index_v2) as possession_min,
    max(possession_index_v2) as possession_max,
    min(creation_index_v2) as creation_min,
    max(creation_index_v2) as creation_max,
    min(scoring_index_v2) as scoring_min,
    max(scoring_index_v2) as scoring_max
  from mart.player_profile_raw_coeff_merged_v2
)
update mart.player_profile_raw_coeff_merged_v2 t
set
  pressure_index_v2_norm =
    case
      when mm.pressure_max = mm.pressure_min then null
      else (t.pressure_index_v2 - mm.pressure_min) / nullif(mm.pressure_max - mm.pressure_min, 0.0)
    end,
  possession_index_v2_norm =
    case
      when mm.possession_max = mm.possession_min then null
      else (t.possession_index_v2 - mm.possession_min) / nullif(mm.possession_max - mm.possession_min, 0.0)
    end,
  creation_index_v2_norm =
    case
      when mm.creation_max = mm.creation_min then null
      else (t.creation_index_v2 - mm.creation_min) / nullif(mm.creation_max - mm.creation_min, 0.0)
    end,
  scoring_index_v2_norm =
    case
      when mm.scoring_max = mm.scoring_min then null
      else (t.scoring_index_v2 - mm.scoring_min) / nullif(mm.scoring_max - mm.scoring_min, 0.0)
    end
from mm;

-- 3) Final scores with requested weights
update mart.player_profile_raw_coeff_merged_v2 t
set
  defend_score_v2 =
    (
      0.75 * coalesce(t.pressure_index_v2_norm, 0.0)
      + 0.25 * coalesce(t.possession_index_v2_norm, 0.0)
    ) * coalesce(t.possession_lost_rate_v2, 0.0) * 100.0,

  support_score_v2 =
    (
      0.20 * coalesce(t.pressure_index_v2_norm, 0.0)
      + 0.60 * coalesce(t.possession_index_v2_norm, 0.0)
      + 0.20 * coalesce(t.creation_index_v2_norm, 0.0)
    ) * coalesce(t.possession_lost_rate_v2, 0.0) * 100.0,

  create_score_v2 =
    (
      0.35 * coalesce(t.possession_index_v2_norm, 0.0)
      + 0.55 * coalesce(t.creation_index_v2_norm, 0.0)
      + 0.10 * coalesce(t.scoring_index_v2_norm, 0.0)
    ) * coalesce(t.possession_lost_rate_v2, 0.0) * 100.0,

  score_score_v2 =
    (
      0.05 * coalesce(t.pressure_index_v2_norm, 0.0)
      + 0.05 * coalesce(t.possession_index_v2_norm, 0.0)
      + 0.15 * coalesce(t.creation_index_v2_norm, 0.0)
      + 0.75 * coalesce(t.scoring_index_v2_norm, 0.0)
    ) * coalesce(t.possession_lost_rate_v2, 0.0) * 100.0,

  possession_lost_score_v2 = coalesce(t.possession_lost_rate_v2, 0.0) * 100.0;

create index if not exists idx_player_profile_raw_coeff_merged_v2_player_id
  on mart.player_profile_raw_coeff_merged_v2 (player_id);

-- Validation / inspection
-- Top 50 by each score (global)
-- select player_id, name, age, positions, team, league, round(defend_score_v2::numeric,2) as defend_score_v2 from mart.player_profile_raw_coeff_merged_v2 order by defend_score_v2 desc nulls last limit 50;
-- select player_id, name, age, positions, team, league, round(support_score_v2::numeric,2) as support_score_v2 from mart.player_profile_raw_coeff_merged_v2 order by support_score_v2 desc nulls last limit 50;
-- select player_id, name, age, positions, team, league, round(create_score_v2::numeric,2) as create_score_v2 from mart.player_profile_raw_coeff_merged_v2 order by create_score_v2 desc nulls last limit 50;
-- select player_id, name, age, positions, team, league, round(score_score_v2::numeric,2) as score_score_v2 from mart.player_profile_raw_coeff_merged_v2 order by score_score_v2 desc nulls last limit 50;

-- Sanity ranges
-- select
--   min(pressure_index_v2_norm), max(pressure_index_v2_norm),
--   min(possession_index_v2_norm), max(possession_index_v2_norm),
--   min(creation_index_v2_norm), max(creation_index_v2_norm),
--   min(scoring_index_v2_norm), max(scoring_index_v2_norm),
--   min(possession_lost_rate_v2), max(possession_lost_rate_v2)
-- from mart.player_profile_raw_coeff_merged_v2;

