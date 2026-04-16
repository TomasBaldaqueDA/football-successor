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
  height_cm: number | null;
  weight_kg: number | null;
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
    min_age?: number | null;
    max_age?: number | null;
    cb_max_age?: number | null;
  };

  const targetPlayerId = target.target_player_id;
  const selectedBucket = (target.selected_bucket ?? "").trim();
  const topN = Math.min(100, Math.max(1, Number(target.top_n) || 20));
  const weightVersion = (target.weight_version ?? "v1_manual").trim() || "v1_manual";
  const compareN = Math.min(12, Math.max(3, Number(target.comparison_metrics) || 8));

  let minAge: number = target.min_age === undefined || target.min_age === null ? 15 : Number(target.min_age);
  let maxAge: number = target.max_age === undefined || target.max_age === null ? 22 : Number(target.max_age);
  let cbMaxAge: number = target.cb_max_age === undefined || target.cb_max_age === null ? 23 : Number(target.cb_max_age);

  if (!Number.isFinite(minAge) || !Number.isFinite(maxAge) || !Number.isFinite(cbMaxAge)) {
    return NextResponse.json({ error: "Age parameters must be numbers" }, { status: 400 });
  }

  minAge = Math.max(10, Math.round(minAge));
  maxAge = Math.max(minAge, Math.round(maxAge));
  cbMaxAge = Math.max(maxAge, Math.round(cbMaxAge));

  if (targetPlayerId === undefined || targetPlayerId === null || targetPlayerId === "") {
    return NextResponse.json({ error: "target_player_id required" }, { status: 400 });
  }
  if (!selectedBucket) {
    return NextResponse.json({ error: "selected_bucket required" }, { status: 400 });
  }

  const pool = getPool();

  try {
    const { rows: devRows } = await pool.query(
      `select *
       from mart.development_replacements(
         $1::bigint, $2::text, $3::int, $4::text, $5::int, $6::int, $7::int
       )`,
      [String(targetPlayerId), selectedBucket, topN, weightVersion, minAge, maxAge, cbMaxAge],
    );

    const targetIdStr = String(targetPlayerId);
    const candidateIds = Array.isArray(devRows)
      ? devRows.map((r: { player_id: unknown }) => String(r.player_id))
      : [];
    const allIds = [...new Set([targetIdStr, ...candidateIds])];
    const idList = allIds.map((id) => BigInt(id));

    const { rows: weightRows } = await pool.query<WeightRow>(
      `select metric_column, weight::text
       from mart.role_metric_weights
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
         height_cm,
         weight_kg,
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
      return { ...w, tv, contribution: Number.isFinite(contribution) ? contribution : 0 };
    });

    const allZero = withTargetSignal.every((x) => x.contribution === 0);
    if (allZero) {
      withTargetSignal.sort((a, b) => (Number(b.weight) || 0) - (Number(a.weight) || 0));
    } else {
      withTargetSignal.sort((a, b) => b.contribution - a.contribution);
    }

    let chosen = withTargetSignal.slice(0, compareN).map((r) => r.metric_column);
    if (chosen.length < 3) chosen = rankedWeights.slice(0, compareN).map((r) => r.metric_column);

    const comparisonMetrics = chosen.map((column) => ({
      column,
      label: formatMetricLabel(column),
      weight: weightByCol.get(column) ?? 0,
      target: pickJsonNumber(targetMerged, column),
    }));

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
      height_cm: targetDim?.height_cm ?? null,
      weight_kg: targetDim?.weight_kg ?? null,
      market_value_eur: targetDim?.market_value_eur ?? null,
      market_value_text: targetDim?.market_value_text ?? null,
      metricVals: metricSlice(targetMerged),
    };

    const rows = (Array.isArray(devRows) ? devRows : []).map((r: Record<string, unknown>) => {
      const pid = String(r.player_id);
      const dim = dimById.get(pid);
      const merged = mergedById.get(pid) ?? {};
      return {
        ...r,
        last_club: dim?.last_club ?? null,
        nationality_code: dim?.nationality_code ?? null,
        age_last_season: dim?.age_last_season ?? null,
        position_text: dim?.position_text ?? null,
        played_positions_short: dim?.played_positions_short ?? null,
        height_cm: dim?.height_cm ?? null,
        weight_kg: dim?.weight_kg ?? null,
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
        min_age: minAge,
        max_age: maxAge,
        cb_max_age: cbMaxAge,
        weight_mix: {
          fit_now: 0.3,
          upside: 0.45,
          trajectory: 0.15,
          readiness: 0.1,
        },
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Query failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

