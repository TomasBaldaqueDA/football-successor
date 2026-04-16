import Papa from "papaparse";
import type { Player, RawPlayer } from "./types";
import { derivePositionGroup } from "./positionGrouping";

let cachedPlayers: Player[] | null = null;

export async function loadPlayers(): Promise<Player[]> {
  if (cachedPlayers) return cachedPlayers;

  return new Promise((resolve, reject) => {
    Papa.parse("/scouting-players.csv", {
      download: true,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        const players: Player[] = (results.data as RawPlayer[])
          .filter((r) => r.name && r.positions)
          .map((r) => ({
            ...r,
            age: Number(r.age) || 0,
            rating_merged: Number(r.rating_merged) || 0,
            goals_p90_merged: Number(r.goals_p90_merged) || 0,
            assists_p90_merged: Number(r.assists_p90_merged) || 0,
            xg_per_90_merged: Number(r.xg_per_90_merged) || 0,
            shots_p90_merged: Number(r.shots_p90_merged) || 0,
            key_passes_p90_merged: Number(r.key_passes_p90_merged) || 0,
            passes_p90_merged: Number(r.passes_p90_merged) || 0,
            accurate_crosses_p90_merged: Number(r.accurate_crosses_p90_merged) || 0,
            interceptions_p90_merged: Number(r.interceptions_p90_merged) || 0,
            tackles_p90_merged: Number(r.tackles_p90_merged) || 0,
            blocks_p90_merged: Number(r.blocks_p90_merged) || 0,
            dribbles_won_p90_merged: Number(r.dribbles_won_p90_merged) || 0,
            aerial_won_p90_merged: Number(r.aerial_won_p90_merged) || 0,
            pass_success_pct_merged: Number(r.pass_success_pct_merged) || 0,
            dispossessed_p90_merged: Number(r.dispossessed_p90_merged) || 0,
            turnovers_p90_merged: Number(r.turnovers_p90_merged) || 0,
            goals_p90_pct_merged: Number(r.goals_p90_pct_merged) || 0,
            assists_p90_pct_merged: Number(r.assists_p90_pct_merged) || 0,
            xg_per_90_pct_merged: Number(r.xg_per_90_pct_merged) || 0,
            key_passes_p90_pct_merged: Number(r.key_passes_p90_pct_merged) || 0,
            tackles_p90_pct_merged: Number(r.tackles_p90_pct_merged) || 0,
            interceptions_p90_pct_merged: Number(r.interceptions_p90_pct_merged) || 0,
            pass_success_pct_pct_merged: Number(r.pass_success_pct_pct_merged) || 0,
            dribbles_won_p90_pct_merged: Number(r.dribbles_won_p90_pct_merged) || 0,
            aerial_won_p90_pct_merged: Number(r.aerial_won_p90_pct_merged) || 0,
            positionGroup: derivePositionGroup(String(r.positions ?? "")),
          }));

        cachedPlayers = players;
        resolve(players);
      },
      error: reject,
    });
  });
}
