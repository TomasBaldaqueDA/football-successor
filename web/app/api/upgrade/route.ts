import { getPool } from "@/lib/db";
import { formatMetricLabel, pickJsonNumber } from "@/lib/metricLabels";
import { NextRequest, NextResponse } from "next/server";

const METRIC_COL_RE = /^[a-z][a-z0-9_]*$/i;

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

type WeightRow = {
  metric_column: string;
  weight: string;
};

function asRecord(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const target = body as {
    target_player_id?: string | number;
    selected_bucket?: string;
    top_n?: number;
    weight_version?: string;
    comparison_metrics?: number;
    fit_floor?: number;
    min_positive_metrics?: number;
    min_positive_top_metrics?: number;
    subpos_bonus_weight?: number;
  };

  const targetPlayerId = target.target_player_id;
  const selectedBucket = (target.selected_bucket ?? "").trim();
  const topN = Math.min(100, Math.max(1, Number(target.top_n) || 20));
  const weightVersion =
    (target.weight_version ?? "v1_manual").trim() || "v1_manual";
  const compareN = Math.min(12, Math.max(3, Number(target.comparison_metrics) || 8));
  const fitFloor = Math.min(99, Math.max(1, Number(target.fit_floor) || 70));
  const minPositiveMetrics = Math.min(
    20,
    Math.max(1, Number(target.min_positive_metrics) || 2),
  );
  const minPositiveTopMetrics = Math.min(
    4,
    Math.max(0, Number(target.min_positive_top_metrics) || 1),
  );
  const subposBonusWeight = Math.min(
    0.3,
    Math.max(0, Number(target.subpos_bonus_weight) || 0.15),
  );

  if (targetPlayerId === undefined || targetPlayerId === null || targetPlayerId === "") {
    return NextResponse.json({ error: "target_player_id required" }, { status: 400 });
  }
  if (!selectedBucket) {
    return NextResponse.json({ error: "selected_bucket required" }, { status: 400 });
  }

  const pool = getPool();

  try {
    const { rows: upgradeRows } = await pool.query(
      `select *
       from mart.upgrade_replacements(
         $1::bigint, $2::text, $3::int, $4::text, $5::int, $6::int, $7::int, $8::float8
       )`,
      [
        String(targetPlayerId),
        selectedBucket,
        topN,
        weightVersion,
        fitFloor,
        minPositiveMetrics,
        minPositiveTopMetrics,
        subposBonusWeight,
      ],
    );

    const targetIdStr = String(targetPlayerId);
    const candidateIds = Array.isArray(upgradeRows)
      ? upgradeRows.map((r: { player_id: unknown }) => String(r.player_id))
      : [];
    const allIds = [...new Set([targetIdStr, ...candidateIds])];
    const idList = allIds.map((id) => BigInt(id));

    const { rows: weightRows } = await pool.query<WeightRow>(
      `select metric_column, weight::text
       from mart.l4l_metric_weights
       where position_bucket = $1
         and weight_version = $2
       order by weight::float8 desc`,
      [selectedBucket, weightVersion],
    );

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
      [idList],
    );
    const dimById = new Map(dimRows.map((d) => [d.player_id, d]));

    const { rows: mergedRows } = await pool.query<{ player_id: string; j: unknown }>(
      `select player_id::text, to_jsonb(m) as j
       from mart.player_profile_merged_v1 m
       where player_id = any($1::bigint[])`,
      [idList],
    );
    const mergedById = new Map<string, Record<string, unknown>>();
    for (const r of mergedRows) mergedById.set(r.player_id, asRecord(r.j));

    const targetMerged = mergedById.get(targetIdStr) ?? {};
    const rankedWeights = weightRows.filter((w) => METRIC_COL_RE.test(w.metric_column));
    const weightByCol = new Map(rankedWeights.map((w) => [w.metric_column, Number(w.weight)]));

    const withTargetSignal = rankedWeights.map((w) => {
      const wn = Number(w.weight);
      const tv = pickJsonNumber(targetMerged, w.metric_column);
      const contribution = tv === null ? 0 : Math.abs(tv) * (Number.isFinite(wn) ? wn : 0);
      return { ...w, contribution: Number.isFinite(contribution) ? contribution : 0 };
    });
    withTargetSignal.sort((a, b) => b.contribution - a.contribution);
    const chosen = withTargetSignal.slice(0, compareN).map((r) => r.metric_column);

    function metricSlice(merged: Record<string, unknown>): Record<string, number | null> {
      const out: Record<string, number | null> = {};
      for (const col of chosen) out[col] = pickJsonNumber(merged, col);
      return out;
    }

    const targetDim = dimById.get(targetIdStr);
    const targetSummary = {
      player_id: targetIdStr,
      player_name: targetDim?.player_name ?? null,
      last_club: targetDim?.last_club ?? null,
      nationality_code: targetDim?.nationality_code ?? null,
      age_last_season: targetDim?.age_last_season ?? null,
      position_text: targetDim?.position_text ?? null,
      played_positions_short: targetDim?.played_positions_short ?? null,
      market_value_eur: targetDim?.market_value_eur ?? null,
      market_value_text: targetDim?.market_value_text ?? null,
      metricVals: metricSlice(targetMerged),
    };

    const comparisonMetrics = chosen.map((column) => ({
      column,
      label: formatMetricLabel(column),
      weight: weightByCol.get(column) ?? 0,
      target: pickJsonNumber(targetMerged, column),
    }));

    const rows = (Array.isArray(upgradeRows) ? upgradeRows : []).map((r: Record<string, unknown>) => {
      const pid = String(r.player_id);
      const dim = dimById.get(pid);
      const merged = mergedById.get(pid) ?? {};
      return {
        ...r,
        last_club: dim?.last_club ?? null,
        nationality_code: dim?.nationality_code ?? null,
        age_last_season: dim?.age_last_season ?? null,
        played_positions_short: dim?.played_positions_short ?? null,
        market_value_eur: dim?.market_value_eur ?? null,
        market_value_text: dim?.market_value_text ?? null,
        metric_vals: metricSlice(merged),
      };
    });

    return NextResponse.json({
      rows,
      targetSummary,
      comparisonMetrics,
      selected_bucket: selectedBucket,
      config: {
        fit_floor: fitFloor,
        min_positive_metrics: minPositiveMetrics,
        min_positive_top_metrics: minPositiveTopMetrics,
        subpos_bonus_weight: subposBonusWeight,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Query failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

