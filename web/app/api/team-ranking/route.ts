import { getPool } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

type SortBy = "defend" | "support" | "create" | "score" | "overall_avg" | "market_value";

const SORT_SQL: Record<SortBy, string> = {
  defend: "coalesce(defend_score_v2_norm, 0)",
  support: "coalesce(support_score_v2_norm, 0)",
  create: "coalesce(create_score_v2_norm, 0)",
  score: "coalesce(score_score_v2_norm, 0)",
  market_value: "coalesce(nullif(market_value::text, '')::numeric, 0)",
  overall_avg:
    "(coalesce(defend_score_v2_norm,0) + coalesce(support_score_v2_norm,0) + coalesce(create_score_v2_norm,0) + coalesce(score_score_v2_norm,0)) / 4.0",
};

export async function GET(req: NextRequest) {
  const team = (req.nextUrl.searchParams.get("team") ?? "").trim();
  const sortBy = (req.nextUrl.searchParams.get("sort_by") ?? "overall_avg").trim() as SortBy;
  const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 200));

  if (!team) return NextResponse.json({ error: "team required" }, { status: 400 });
  if (!Object.keys(SORT_SQL).includes(sortBy)) {
    return NextResponse.json({ error: "invalid sort_by" }, { status: 400 });
  }

  const orderExpr = SORT_SQL[sortBy];
  const pool = getPool();

  try {
    const { rows } = await pool.query(
      `select
         player_id::text,
         name,
         age,
         positions,
         team,
         league,
         nationality,
         market_value::text as market_value,
         coalesce(defend_score_v2_norm,0)::double precision as defend_score,
         coalesce(support_score_v2_norm,0)::double precision as support_score,
         coalesce(create_score_v2_norm,0)::double precision as create_score,
         coalesce(score_score_v2_norm,0)::double precision as score_score,
         coalesce(possession_lost_score_v2,0)::double precision as possession_lost_score,
         ${orderExpr}::double precision as ranking_score
       from mart.player_profile_raw_coeff_merged_v2
       where team = $1::text
       order by ${orderExpr} desc, market_value::numeric desc nulls last
       limit $2::int`,
      [team, limit],
    );

    return NextResponse.json({ team, sort_by: sortBy, rows });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Query failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

