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
    budget_ratio?: number | null;
    fit_floor?: number | null;
    league_bonus_weight?: number | null;
  };

  const targetPlayerId = target.target_player_id;
  const selectedBucket = (target.selected_bucket ?? "").trim();
  const topN = Math.min(100, Math.max(1, Number(target.top_n) || 20));
  const weightVersion = (target.weight_version ?? "v1_manual").trim() || "v1_manual";
  const compareN = Math.min(12, Math.max(3, Number(target.comparison_metrics) || 8));

  let budgetRatio: number = target.budget_ratio === undefined || target.budget_ratio === null
    ? 0.7
    : Number(target.budget_ratio);
  let fitFloor: number = target.fit_floor === undefined || target.fit_floor === null
    ? 80
    : Number(target.fit_floor);
  let leagueBonusWeight: number = target.league_bonus_weight === undefined || target.league_bonus_weight === null
    ? 0.15
    : Number(target.league_bonus_weight);

  if (!Number.isFinite(budgetRatio) || !Number.isFinite(fitFloor) || !Number.isFinite(leagueBonusWeight)) {
    return NextResponse.json({ error: "budget_ratio, fit_floor and league_bonus_weight must be numbers" }, { status: 400 });
  }
  budgetRatio = Math.min(1.0, Math.max(0.05, budgetRatio));
  fitFloor = Math.min(99, Math.max(1, Math.round(fitFloor)));
  leagueBonusWeight = Math.min(0.30, Math.max(0.0, leagueBonusWeight));

  if (targetPlayerId === undefined || targetPlayerId === null || targetPlayerId === "") {
    return NextResponse.json({ error: "target_player_id required" }, { status: 400 });
  }
  if (!selectedBucket) {
    return NextResponse.json({ error: "selected_bucket required" }, { status: 400 });
  }

  const pool = getPool();

  try {
    const { rows: budgetRows } = await pool.query(
      `select *
       from mart.budget_replacements(
         $1::bigint, $2::text, $3::int, $4::text, $5::numeric, $6::int, $7::int, $8::numeric
       )`,
      [String(targetPlayerId), selectedBucket, topN, weightVersion, budgetRatio, fitFloor, 0, leagueBonusWeight],
    );

    const targetIdStr = String(targetPlayerId);
    const candidateIds = Array.isArray(budgetRows)
      ? budgetRows.map((r: { player_id: unknown }) => String(r.player_id))
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
    const chosen = rankedWeights.slice(0, compareN).map((r) => r.metric_column);

    const comparisonMetrics = chosen.map((column) => ({
      column,
      label: formatMetricLabel(column),
      weight: Number(rankedWeights.find((w) => w.metric_column === column)?.weight ?? 0),
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
      market_value_eur: targetDim?.market_value_eur ?? null,
      market_value_text: targetDim?.market_value_text ?? null,
      metricVals: metricSlice(targetMerged),
    };

    const rows = (Array.isArray(budgetRows) ? budgetRows : []).map((r: Record<string, unknown>) => {
      const pid = String(r.player_id);
      const dim = dimById.get(pid);
      const merged = mergedById.get(pid) ?? {};
      return {
        ...r,
        last_club: dim?.last_club ?? null,
        nationality_code: dim?.nationality_code ?? null,
        age_last_season: dim?.age_last_season ?? null,
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
        budget_ratio: budgetRatio,
        fit_floor: fitFloor,
        league_bonus_weight: leagueBonusWeight,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Query failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

