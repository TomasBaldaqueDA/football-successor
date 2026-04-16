import { getPool } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const id = (req.nextUrl.searchParams.get("player_id") ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "player_id required" }, { status: 400 });
  }

  try {
    const pool = getPool();
    const { rows } = await pool.query<{ position_bucket: string }>(
      `select distinct position_bucket
       from mart.player_position_membership
       where player_id = $1::bigint
       order by 1`,
      [id],
    );
    return NextResponse.json({ buckets: rows.map((r) => r.position_bucket) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Query failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
