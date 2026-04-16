import { getPool } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

type ScoreType = "defend" | "support" | "create" | "score";

const SCORE_COL: Record<ScoreType, string> = {
  defend: "defend_score_v2_norm",
  support: "support_score_v2_norm",
  create: "create_score_v2_norm",
  score: "score_score_v2_norm",
};

export async function GET(req: NextRequest) {
  const score = (req.nextUrl.searchParams.get("score") ?? "score").toLowerCase() as ScoreType;
  const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 50));

  if (!Object.keys(SCORE_COL).includes(score)) {
    return NextResponse.json({ error: "score must be defend/support/create/score" }, { status: 400 });
  }

  const col = SCORE_COL[score];
  const pool = getPool();

  try {
    const { rows } = await pool.query(
      `select
         player_id::text,
         name,
         age,
         team,
         league,
         positions,
         market_value::text as market_value,
         ${col}::double precision as score_value
       from mart.player_profile_raw_coeff_merged_v2
       where ${col} is not null
       order by ${col} desc
       limit $1::int`,
      [limit],
    );

    return NextResponse.json({ rows, score, limit });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Query failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

