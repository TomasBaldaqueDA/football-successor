import { getPool } from "@/lib/db";
import { formatP90MergedLabel, pickJsonNumber } from "@/lib/metricLabels";
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

function asRecord(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function toRawP90Column(metricColumn: string): string {
  if (/_adj_merged$/i.test(metricColumn)) {
    return metricColumn.replace(/_adj_merged$/i, "_merged");
  }
  return metricColumn;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const target = body as {
    player_id?: string | number;
    selected_bucket?: string;
    weight_version?: string;
    top_k?: number;
  };

  const playerId = target.player_id;
  const selectedBucket = (target.selected_bucket ?? "").trim();
  const weightVersion = (target.weight_version ?? "v1_manual").trim() || "v1_manual";
  const topK = Math.min(10, Math.max(1, Number(target.top_k) || 5));

  if (playerId === undefined || playerId === null || playerId === "") {
    return NextResponse.json({ error: "player_id required" }, { status: 400 });
  }
  if (!selectedBucket) {
    return NextResponse.json({ error: "selected_bucket required" }, { status: 400 });
  }

  const pool = getPool();

  try {
    const id = String(playerId);

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
       where player_id = $1::bigint`,
      [id],
    );
    const dim = dimRows[0] ?? null;

    const { rows: mergedRows } = await pool.query<{ j: unknown }>(
      `select to_jsonb(m) as j
       from mart.player_profile_merged_v1 m
       where m.player_id = $1::bigint`,
      [id],
    );
    const merged = asRecord(mergedRows[0]?.j ?? {});

    const { rows: weightRows } = await pool.query<WeightRow>(
      `select metric_column, weight::text
       from mart.l4l_metric_weights
       where position_bucket = $1
         and weight_version = $2
       order by weight::float8 desc`,
      [selectedBucket, weightVersion],
    );

    const metricRows = weightRows
      .filter((w) => METRIC_COL_RE.test(w.metric_column))
      .map((w) => {
        const weight = Number(w.weight);
        const rawColumn = toRawP90Column(w.metric_column);
        const valueP90 = pickJsonNumber(merged, rawColumn);
        const valueAdj = pickJsonNumber(merged, w.metric_column);
        const strengthScore =
          valueP90 === null || !Number.isFinite(weight)
            ? 0
            : Math.abs(valueP90) * Math.max(weight, 0);
        return {
          column: rawColumn,
          source_metric_column: w.metric_column,
          label: formatP90MergedLabel(rawColumn),
          weight,
          value_p90: valueP90,
          value_adj: valueAdj,
          strength_score: strengthScore,
        };
      })
      .filter((r) => r.value_p90 !== null)
      .sort((a, b) => b.strength_score - a.strength_score)
      .slice(0, topK);

    return NextResponse.json({
      playerSummary: dim,
      selected_bucket: selectedBucket,
      weight_version: weightVersion,
      rows: metricRows,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Query failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

