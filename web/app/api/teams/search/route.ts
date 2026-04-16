import { getPool } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ teams: [] as string[] });
  }

  const pool = getPool();
  try {
    const { rows } = await pool.query<{ team: string }>(
      `select distinct team
       from mart.player_profile_raw_coeff_merged_v2
       where team is not null
         and team ilike ('%%' || $1::text || '%%')
       order by team asc
       limit 30`,
      [q],
    );
    return NextResponse.json({ teams: rows.map((r) => r.team) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Query failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

