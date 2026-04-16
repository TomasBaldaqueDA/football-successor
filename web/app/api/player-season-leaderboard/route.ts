import { getPool } from "@/lib/db";
import { formatMetricLabel } from "@/lib/metricLabels";
import {
  asRecord,
  classifyBigFivePoolRow,
  poolLeagueStrengthCoeff,
  poolMinutes,
} from "@/lib/playerPoolBigFive";
import { minMaxNormalizeScores, seasonValueTimesLeagueStrength } from "@/lib/seasonMetricLeagueAdj";
import { pgTokenBoundaryPatternForBucket } from "@/lib/positionBucketDimTokens";
import { pickSeasonPoolValue } from "@/lib/seasonPoolMetric";
import { NextRequest, NextResponse } from "next/server";

const METRIC_COL_RE = /^[a-z][a-z0-9_]*$/i;

type WeightRow = {
  metric_column: string;
  weight: string;
};

type DimRow = {
  player_id: string;
  player_name: string | null;
  last_club: string | null;
  age_last_season: number | null;
  position_text: string | null;
  played_positions_short: string | null;
  market_value_eur: string | null;
  market_value_text: string | null;
};

export async function GET(req: NextRequest) {
  const positionBucket = (req.nextUrl.searchParams.get("position_bucket") ?? "").trim();
  const weightVersion = (req.nextUrl.searchParams.get("weight_version") ?? "v1_manual").trim() || "v1_manual";

  if (!positionBucket) {
    return NextResponse.json({ error: "position_bucket query param required" }, { status: 400 });
  }

  const pool = getPool();
  try {
    const { rows } = await pool.query<WeightRow>(
      `select metric_column, weight::text
       from mart.l4l_metric_weights
       where position_bucket = $1
         and weight_version = $2
       order by weight::float8 desc`,
      [positionBucket, weightVersion],
    );
    const metrics = rows
      .filter((r) => METRIC_COL_RE.test(r.metric_column))
      .map((r) => ({
        column: r.metric_column,
        label: formatMetricLabel(r.metric_column),
        weight: Number(r.weight),
      }));
    return NextResponse.json({ position_bucket: positionBucket, weight_version: weightVersion, metrics });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Query failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const target = body as {
    position_bucket?: string;
    metric_column?: string;
    weight_version?: string;
    min_minutes?: number;
    /** Se false, usa só player_position_membership (inclui expansão L4L: ex. CB→AM). Predefinição: true. */
    strict_dim_tokens?: boolean;
  };

  const positionBucket = (target.position_bucket ?? "").trim();
  const metricColumn = (target.metric_column ?? "").trim();
  const weightVersion = (target.weight_version ?? "v1_manual").trim() || "v1_manual";
  const minMinutes = Math.max(0, Number(target.min_minutes) || 900);
  const strictDimTokens = target.strict_dim_tokens !== false;

  if (!positionBucket) {
    return NextResponse.json({ error: "position_bucket required" }, { status: 400 });
  }
  if (!metricColumn || !METRIC_COL_RE.test(metricColumn)) {
    return NextResponse.json({ error: "metric_column required (safe identifier)" }, { status: 400 });
  }

  const pool = getPool();

  try {
    const { rows: okRows } = await pool.query<{ ok: number }>(
      `select 1 as ok
       from mart.l4l_metric_weights
       where position_bucket = $1
         and weight_version = $2
         and metric_column = $3
       limit 1`,
      [positionBucket, weightVersion, metricColumn],
    );
    if (okRows.length === 0) {
      return NextResponse.json(
        { error: "metric_column not found for this position_bucket and weight_version" },
        { status: 400 },
      );
    }

    const { rows: seasonRows } = await pool.query<{ season_slug: string | null }>(
      `select max(season_slug) as season_slug from mart.player_pool_clean_tbl`,
    );
    const seasonSlug = seasonRows[0]?.season_slug ?? null;
    if (!seasonSlug) {
      return NextResponse.json({ error: "No seasons found in player_pool_clean_tbl" }, { status: 500 });
    }

    const minutesPredicate = `coalesce(
           nullif((to_jsonb(p) ->> 'minutes_played')::double precision, 0.0),
           nullif((to_jsonb(p) ->> 'minutes')::double precision, 0.0),
           nullif((to_jsonb(p) ->> 'mins_played')::double precision, 0.0),
           nullif((to_jsonb(p) ->> 'minutes_total')::double precision, 0.0),
           nullif((to_jsonb(p) ->> 'total_minutes')::double precision, 0.0),
           nullif((to_jsonb(p) ->> 'time_played')::double precision, 0.0),
           0.0
         ) >= $2::double precision`;

    let poolRowList: { player_id: string; j: unknown }[];
    if (strictDimTokens) {
      const tokenPattern = pgTokenBoundaryPatternForBucket(positionBucket);
      if (!tokenPattern) {
        return NextResponse.json({ error: "Invalid position_bucket for strict token filter" }, { status: 400 });
      }
      const res = await pool.query<{ player_id: string; j: unknown }>(
        `with latest as (select max(season_slug) as season_slug from mart.player_pool_clean_tbl)
         select p.player_id::text, to_jsonb(p) as j
         from mart.player_pool_clean_tbl p
         cross join latest l
         inner join mart.player_position_membership pm
           on pm.player_id = p.player_id
          and pm.position_bucket = $1::text
         inner join mart.player_dim d
           on d.player_id = p.player_id
         where p.season_slug = l.season_slug
           and ${minutesPredicate}
           and upper(coalesce(d.played_positions_short, '')) ~ $3::text`,
        [positionBucket, minMinutes, tokenPattern],
      );
      poolRowList = res.rows;
    } else {
      const res = await pool.query<{ player_id: string; j: unknown }>(
        `with latest as (select max(season_slug) as season_slug from mart.player_pool_clean_tbl)
         select p.player_id::text, to_jsonb(p) as j
         from mart.player_pool_clean_tbl p
         cross join latest l
         inner join mart.player_position_membership pm
           on pm.player_id = p.player_id
          and pm.position_bucket = $1::text
         where p.season_slug = l.season_slug
           and ${minutesPredicate}`,
        [positionBucket, minMinutes],
      );
      poolRowList = res.rows;
    }

    type Row = {
      player_id: string;
      minutes: number;
      league: string;
      raw: number;
      coeff: number;
      adjusted: number;
    };

    const eligible: Row[] = [];
    for (const r of poolRowList) {
      const j = asRecord(r.j);
      const big = classifyBigFivePoolRow(j);
      if (!big.ok) continue;
      const minutes = poolMinutes(j);
      if (minutes < minMinutes) continue;
      const raw = pickSeasonPoolValue(j, minutes, metricColumn);
      if (raw === null || !Number.isFinite(raw)) continue;
      const coeff = poolLeagueStrengthCoeff(j);
      const adjusted = seasonValueTimesLeagueStrength(raw, coeff, metricColumn);
      if (adjusted === null || !Number.isFinite(adjusted)) continue;
      eligible.push({
        player_id: r.player_id,
        minutes,
        league: big.display,
        raw,
        coeff,
        adjusted,
      });
    }

    eligible.sort((a, b) => b.adjusted - a.adjusted);
    const norms = minMaxNormalizeScores(eligible.map((e) => e.adjusted));

    const ids = eligible.map((e) => e.player_id);
    let dimById = new Map<string, DimRow>();
    if (ids.length > 0) {
      const { rows: dimRows } = await pool.query<DimRow>(
        `select
           player_id::text,
           player_name,
           last_club,
           age_last_season,
           position_text,
           played_positions_short,
           market_value_eur::text,
           market_value_text
         from mart.player_dim
         where player_id = any($1::bigint[])`,
        [ids],
      );
      dimById = new Map(dimRows.map((d) => [d.player_id, d]));
    }

    const rows_out = eligible.map((e, i) => {
      const dim = dimById.get(e.player_id);
      return {
        rank: i + 1,
        player_id: e.player_id,
        player_name: dim?.player_name ?? null,
        last_club: dim?.last_club ?? null,
        age_last_season: dim?.age_last_season ?? null,
        position_text: dim?.position_text ?? null,
        played_positions_short: dim?.played_positions_short ?? null,
        market_value_eur: dim?.market_value_eur ?? null,
        market_value_text: dim?.market_value_text ?? null,
        league_name: e.league,
        minutes_played: Math.round(e.minutes),
        raw_season: e.raw,
        league_strength_coefficient: e.coeff,
        adjusted_season: e.adjusted,
        score_01: norms[i] ?? 0,
      };
    });

    return NextResponse.json({
      season_slug: seasonSlug,
      position_bucket: positionBucket,
      metric_column: metricColumn,
      metric_label: formatMetricLabel(metricColumn),
      weight_version: weightVersion,
      min_minutes: minMinutes,
      strict_dim_tokens: strictDimTokens,
      count: rows_out.length,
      rows: rows_out,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Query failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
