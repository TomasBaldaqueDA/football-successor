import { getPool } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const pool = getPool();
    const { rows } = await pool.query<{ position_bucket: string }>(
      `select distinct position_bucket
       from mart.player_position_membership
       order by 1`,
    );
    return NextResponse.json({ buckets: rows.map((r) => r.position_bucket) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Query failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
