import { getPool } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ players: [] as { player_id: string; player_name: string; last_club: string | null }[] });
  }

  try {
    const pool = getPool();
    const { rows } = await pool.query<{
      player_id: string;
      player_name: string;
      last_club: string | null;
    }>(
      `select player_id::text, player_name, last_club
       from mart.player_dim
       where player_name ilike ('%' || $1::text || '%')
       order by player_name asc
       limit 40`,
      [q],
    );
    return NextResponse.json({ players: rows });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Query failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
