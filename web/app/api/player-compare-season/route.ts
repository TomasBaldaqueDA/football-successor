import { getPool } from "@/lib/db";
import { formatMetricLabel } from "@/lib/metricLabels";
import {
  asRecord,
  classifyBigFivePoolRow,
  poolMinutes,
} from "@/lib/playerPoolBigFive";
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
  nationality_code: string | null;
  age_last_season: number | null;
  position_text: string | null;
  played_positions_short: string | null;
  market_value_eur: string | null;
  market_value_text: string | null;
};

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const target = body as {
    player_ids?: unknown;
    position_bucket?: string;
    weight_version?: string;
    comparison_metrics?: number;
  };

  const rawIds = target.player_ids;
  if (!Array.isArray(rawIds) || rawIds.length < 2) {
    return NextResponse.json({ error: "player_ids must be an array with at least 2 ids" }, { status: 400 });
  }
  const playerIds = [...new Set(rawIds.map((x) => String(x).trim()).filter(Boolean))];
  if (playerIds.length < 2) {
    return NextResponse.json({ error: "at least 2 distinct player_ids required" }, { status: 400 });
  }
  if (playerIds.length > 8) {
    return NextResponse.json({ error: "at most 8 players" }, { status: 400 });
  }

  const selectedBucket = (target.position_bucket ?? "").trim();
  if (!selectedBucket) {
    return NextResponse.json({ error: "position_bucket required" }, { status: 400 });
  }

  const weightVersion = (target.weight_version ?? "v1_manual").trim() || "v1_manual";
  const compareN = Math.min(12, Math.max(3, Number(target.comparison_metrics) || 8));

  const pool = getPool();

  try {
    const { rows: seasonRows } = await pool.query<{ season_slug: string | null }>(
      `select max(season_slug) as season_slug from mart.player_pool_clean_tbl`,
    );
    const seasonSlug = seasonRows[0]?.season_slug ?? null;
    if (!seasonSlug) {
      return NextResponse.json({ error: "No seasons found in player_pool_clean_tbl" }, { status: 500 });
    }

    const { rows: weightRows } = await pool.query<WeightRow>(
      `select metric_column, weight::text
       from mart.l4l_metric_weights
       where position_bucket = $1
         and weight_version = $2
       order by weight::float8 desc`,
      [selectedBucket, weightVersion],
    );

    const { rows: poolRows } = await pool.query<{ player_id: string; j: unknown }>(
      `select
         p.player_id::text,
         to_jsonb(p) as j
       from mart.player_pool_clean_tbl p
       where p.season_slug = $1::text
         and p.player_id = any($2::bigint[])`,
      [seasonSlug, playerIds],
    );

    const poolById = new Map<string, Record<string, unknown>>();
    for (const r of poolRows) {
      poolById.set(r.player_id, asRecord(r.j));
    }

    const { rows: memRows } = await pool.query<{ player_id: string }>(
      `select player_id::text
       from mart.player_position_membership
       where position_bucket = $1
         and player_id = any($2::bigint[])`,
      [selectedBucket, playerIds],
    );
    const memOk = new Set(memRows.map((r) => r.player_id));

    const errors: string[] = [];
    const eligible: { id: string; j: Record<string, unknown>; minutes: number; league: string }[] = [];

    for (const id of playerIds) {
      const j = poolById.get(id);
      if (!j) {
        errors.push(`${id}: no row for season ${seasonSlug} in player_pool_clean_tbl`);
        continue;
      }
      if (!memOk.has(id)) {
        errors.push(`${id}: no membership in bucket «${selectedBucket}»`);
        continue;
      }
      const minutes = poolMinutes(j);
      if (minutes < 900) {
        errors.push(`${id}: only ${Math.round(minutes)} min in the season (minimum 900)`);
        continue;
      }
      const big = classifyBigFivePoolRow(j);
      if (!big.ok) {
        errors.push(
          `${id}: league «${big.display || "—"}» is not one of the Big 5 (Premier League, La Liga, Serie A, Bundesliga, Ligue 1)`,
        );
        continue;
      }
      eligible.push({ id, j, minutes, league: big.display });
    }

    if (eligible.length < 2) {
      return NextResponse.json(
        {
          error: "Fewer than 2 eligible players. Check bucket, minutes, league and season.",
          season_slug: seasonSlug,
          details: errors,
        },
        { status: 400 },
      );
    }

    const eligibleIds = eligible.map((e) => e.id);

    const { rows: dimRows } = await pool.query<DimRow>(
      `select
         player_id::text,
         player_name,
         last_club,
         nationality_code,
         age_last_season,
         position_text,
         played_positions_short,
         market_value_eur::text,
         market_value_text
       from mart.player_dim
       where player_id = any($1::bigint[])`,
      [eligibleIds],
    );
    const dimById = new Map(dimRows.map((d) => [d.player_id, d]));

    const rankedWeights = weightRows.filter((w) => METRIC_COL_RE.test(w.metric_column));
    const anchorId = eligibleIds[0];
    const anchorJ = poolById.get(anchorId) ?? {};

    const withAnchorSignal = rankedWeights.map((w) => {
      const wn = Number(w.weight);
      const tv = pickSeasonPoolValue(anchorJ, poolMinutes(anchorJ), w.metric_column);
      const contribution = tv === null ? 0 : Math.abs(tv) * (Number.isFinite(wn) ? wn : 0);
      return { ...w, tv, contribution: Number.isFinite(contribution) ? contribution : 0 };
    });

    const allZero = withAnchorSignal.every((x) => x.contribution === 0);
    if (allZero) {
      withAnchorSignal.sort((a, b) => (Number(b.weight) || 0) - (Number(a.weight) || 0));
    } else {
      withAnchorSignal.sort((a, b) => b.contribution - a.contribution);
    }

    let chosen = withAnchorSignal.slice(0, compareN).map((r) => r.metric_column);
    if (chosen.length < 3) {
      chosen = rankedWeights.slice(0, compareN).map((r) => r.metric_column);
    }

    const weightByCol = new Map(rankedWeights.map((r) => [r.metric_column, Number(r.weight)]));

    const comparisonMetrics = chosen.map((column) => ({
      column,
      label: formatMetricLabel(column),
      weight: weightByCol.get(column) ?? 0,
    }));

    function metricSlice(j: Record<string, unknown>, minutes: number): Record<string, number | null> {
      const out: Record<string, number | null> = {};
      for (const col of chosen) {
        out[col] = pickSeasonPoolValue(j, minutes, col);
      }
      return out;
    }

    const players = eligible.map((e) => {
      const dim = dimById.get(e.id);
      return {
        player_id: e.id,
        player_name: dim?.player_name ?? null,
        last_club: dim?.last_club ?? null,
        nationality_code: dim?.nationality_code ?? null,
        age_last_season: dim?.age_last_season ?? null,
        position_text: dim?.position_text ?? null,
        played_positions_short: dim?.played_positions_short ?? null,
        market_value_eur: dim?.market_value_eur ?? null,
        market_value_text: dim?.market_value_text ?? null,
        season_slug: seasonSlug,
        league_name: e.league,
        minutes_played: Math.round(e.minutes),
        metric_vals: metricSlice(e.j, e.minutes),
      };
    });

    return NextResponse.json({
      season_slug: seasonSlug,
      position_bucket: selectedBucket,
      weight_version: weightVersion,
      comparisonMetrics,
      players,
      skipped_messages: errors.length > 0 ? errors : undefined,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Query failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
