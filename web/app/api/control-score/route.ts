import { getPool } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

type ControlCardRow = {
  player_id: string;
  name: string | null;
  age: number | null;
  market_value: string | null;
  positions: string | null;
  team: string | null;
  league: string | null;
  nationality: string | null;
  defend_score: number | null;
  support_score: number | null;
  create_score: number | null;
  score_score: number | null;
  possession_lost_score: number | null;
};

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const target = body as {
    player_id?: string | number;
  };

  const playerId = target.player_id;

  if (playerId === undefined || playerId === null || playerId === "") {
    return NextResponse.json({ error: "player_id required" }, { status: 400 });
  }

  const pool = getPool();

  try {
    const { rows } = await pool.query<ControlCardRow>(
      `select *
       from (
         select
           t.player_id::text,
           t.name,
           t.age,
           t.market_value::text,
           t.positions,
           t.team,
           t.league,
           t.nationality,
           coalesce(t.defend_score_v2_norm, t.defend_score_v2)::double precision as defend_score,
           coalesce(t.support_score_v2_norm, t.support_score_v2)::double precision as support_score,
           coalesce(t.create_score_v2_norm, t.create_score_v2)::double precision as create_score,
           coalesce(t.score_score_v2_norm, t.score_score_v2)::double precision as score_score,
           t.possession_lost_score_v2::double precision as possession_lost_score
         from mart.player_profile_raw_coeff_merged_v2 t
       ) x
       where player_id = $1::text`,
      [String(playerId)],
    );

    const row = rows?.[0] ?? null;

    return NextResponse.json({
      row,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Query failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

