-- Build merged player profile from raw season rows (from scratch).
-- Sequence:
-- 1) compute p90 from raw season totals
-- 2) apply league coefficient per season
-- 3) merge seasons to one row per player, weighted by recency + minutes
--
-- Output table:
--   mart.player_profile_raw_coeff_merged_v1
--
-- Notes:
-- - Source table: mart.player_pool_clean_tbl
-- - Metadata join: mart.player_dim
-- - Recency weighting: exponential half-life = 1 season (lambda = ln(2))
-- - Minutes weighting: min(minutes, 3000) / 3000

create schema if not exists mart;

do $$
declare
  v_season_metrics text;
  v_agg_metrics text;
  v_final_cols text;
  v_sql text;
begin
  /*
    Build expressions dynamically from numeric columns in player_pool_clean_tbl.

    Rules:
    - Rate-like columns (pct/rate/per_90/p90) are treated as already rate/p90.
      -> season value copied (then coefficient applied except explicit pct/rate)
      -> merged alias: <original>_merged
    - Total-like columns are converted to p90:
      p90 = total / minutes_played * 90
      -> merged alias: <original>_p90_merged
      -> also keep merged total signal: <original>_total_merged
  */
  with cols as (
    select
      c.column_name,
      case
        when c.column_name ~* '(^|_)(pct|rate)($|_)' then true
        when c.column_name ~* '(_per_90|_p90)($|_)' then true
        else false
      end as is_rate_like,
      case
        when c.column_name ~* '(^|_)(pct|rate)($|_)' then true
        else false
      end as is_pct_like
    from information_schema.columns c
    where c.table_schema = 'mart'
      and c.table_name = 'player_pool_clean_tbl'
      and c.data_type in (
        'smallint', 'integer', 'bigint',
        'real', 'double precision', 'numeric', 'decimal'
      )
      and c.column_name not in (
        'player_id',
        'season_id',
        'season_year',
        'season_order',
        'league_strength_coefficient',
        'minutes_played', 'minutes', 'mins_played',
        'minutes_total', 'total_minutes', 'time_played'
      )
  )
  select
    string_agg(
      case
        when is_rate_like then
          -- keep season value; apply coeff only if not pct/rate-style
          format(
            E'case when %3$s then p.%1$I::double precision else p.%1$I::double precision * b.league_coeff end as %2$I',
            column_name,
            column_name || '__season_coeff',
            case when is_pct_like then 'true' else 'false' end
          )
        else
          -- raw total -> p90, then apply coeff
          format(
            E'case when b.minutes_played > 0 then (p.%1$I::double precision / b.minutes_played) * 90.0 * b.league_coeff end as %2$I,\n' ||
            E'       p.%1$I::double precision * b.league_coeff as %3$I',
            column_name,
            column_name || '__p90_season_coeff',
            column_name || '__total_season_coeff'
          )
      end,
      E',\n       '
      order by column_name
    ),
    string_agg(
      case
        when is_rate_like then
          format(
            E'sum(w.%1$I * w.merge_weight) / nullif(sum(case when w.%1$I is not null then w.merge_weight else 0 end), 0) as %2$I',
            column_name || '__season_coeff',
            column_name || '_merged'
          )
        else
          format(
            E'sum(w.%1$I * w.merge_weight) / nullif(sum(case when w.%1$I is not null then w.merge_weight else 0 end), 0) as %2$I,\n' ||
            E'       sum(w.%3$I * w.merge_weight) / nullif(sum(case when w.%3$I is not null then w.merge_weight else 0 end), 0) as %4$I',
            column_name || '__p90_season_coeff',
            column_name || '_p90_merged',
            column_name || '__total_season_coeff',
            column_name || '_total_merged'
          )
      end,
      E',\n       '
      order by column_name
    ),
    string_agg(
      case
        when is_rate_like then
          format('a.%I', column_name || '_merged')
        else
          format('a.%I, a.%I', column_name || '_p90_merged', column_name || '_total_merged')
      end,
      E',\n      '
      order by column_name
    )
  into v_season_metrics, v_agg_metrics, v_final_cols
  from cols;

  if v_season_metrics is null or v_agg_metrics is null or v_final_cols is null then
    raise exception 'No eligible numeric metric columns found in mart.player_pool_clean_tbl';
  end if;

  v_sql := format($SQL$
    drop table if exists mart.player_profile_raw_coeff_merged_v1;

    create table mart.player_profile_raw_coeff_merged_v1 as
    with base as (
      select
        p.player_id,
        p.season_slug,
        coalesce(
          nullif((to_jsonb(p) ->> 'minutes_played')::double precision, 0.0),
          nullif((to_jsonb(p) ->> 'minutes')::double precision, 0.0),
          nullif((to_jsonb(p) ->> 'mins_played')::double precision, 0.0),
          nullif((to_jsonb(p) ->> 'minutes_total')::double precision, 0.0),
          nullif((to_jsonb(p) ->> 'total_minutes')::double precision, 0.0),
          nullif((to_jsonb(p) ->> 'time_played')::double precision, 0.0),
          0.0
        ) as minutes_played,
        coalesce((to_jsonb(p) ->> 'league_strength_coefficient')::double precision, 1.0) as league_coeff,
        coalesce((to_jsonb(p) ->> 'league_name')::text, (to_jsonb(p) ->> 'league')::text) as season_league,
        coalesce((to_jsonb(p) ->> 'team_name')::text, (to_jsonb(p) ->> 'team')::text, (to_jsonb(p) ->> 'club')::text) as season_team,
        -- best effort season ordering using first 4-digit year found
        coalesce(
          nullif(substring(p.season_slug from '([0-9]{4})'), '')::int,
          0
        ) as season_year_sort
      from mart.player_pool_clean_tbl p
    ),
    weighted as (
      select
        b.player_id,
        b.season_slug,
        b.season_league,
        b.season_team,
        b.minutes_played,
        b.league_coeff,
        -- recency rank per player (latest season first)
        row_number() over (
          partition by b.player_id
          order by b.season_year_sort desc nulls last, b.season_slug desc nulls last
        ) as recency_rank,
        exp(-ln(2) * (
          row_number() over (
            partition by b.player_id
            order by b.season_year_sort desc nulls last, b.season_slug desc nulls last
          ) - 1
        )) as recency_weight,
        least(greatest(b.minutes_played, 0.0), 3000.0) / 3000.0 as minutes_weight,
        -- final merge weight: recency * minutes (small floor to keep sparse seasons from vanishing)
        exp(-ln(2) * (
          row_number() over (
            partition by b.player_id
            order by b.season_year_sort desc nulls last, b.season_slug desc nulls last
          ) - 1
        )) * greatest(least(greatest(b.minutes_played, 0.0), 3000.0) / 3000.0, 0.05) as merge_weight
      from base b
    ),
    season_metrics as (
      select
        w.player_id,
        w.season_slug,
        w.season_league,
        w.season_team,
        w.minutes_played,
        w.merge_weight,
        %1$s
      from weighted w
      join mart.player_pool_clean_tbl p
        on p.player_id = w.player_id
       and p.season_slug = w.season_slug
      join base b
        on b.player_id = w.player_id
       and b.season_slug = w.season_slug
    ),
    agg as (
      select
        sm.player_id,
        count(*) filter (where sm.minutes_played > 0) as seasons_used,
        sum(sm.merge_weight) as sum_weights,
        %2$s
      from season_metrics sm
      group by sm.player_id
    ),
    latest_ctx as (
      select distinct on (sm.player_id)
        sm.player_id,
        sm.season_team as team,
        sm.season_league as league
      from season_metrics sm
      order by sm.player_id, sm.season_slug desc nulls last
    )
    select
      a.player_id,
      d.player_name as name,
      d.age_last_season as age,
      d.market_value_eur as market_value,
      coalesce(d.played_positions_short, d.position_text) as positions,
      lc.team,
      lc.league,
      d.nationality_code as nationality,
      a.seasons_used,
      a.sum_weights,
      'raw_coeff_merge_v1'::text as merge_version,
      'league_coeff_from_season'::text as coefficient_version,
      %3$s
    from agg a
    left join mart.player_dim d
      on d.player_id = a.player_id
    left join latest_ctx lc
      on lc.player_id = a.player_id;

    create index if not exists idx_player_profile_raw_coeff_merged_v1_player_id
      on mart.player_profile_raw_coeff_merged_v1 (player_id);
  $SQL$, v_season_metrics, v_agg_metrics, v_final_cols);

  execute v_sql;
end
$$;

-- Validation queries:
-- select count(*) as players from mart.player_profile_raw_coeff_merged_v1;
-- select seasons_used, count(*) from mart.player_profile_raw_coeff_merged_v1 group by 1 order by 1;
-- select * from mart.player_profile_raw_coeff_merged_v1 order by sum_weights desc nulls last limit 20;

