import type { Player, PositionGroup } from "./types";
import { TOP_CLUBS_BIG6 } from "./types";

interface GemWeights {
  rating: number;
  xg: number;
  key_passes: number;
  tackles: number;
  interceptions: number;
  passes: number;
  dribbles: number;
}

const POSITION_WEIGHTS: Record<PositionGroup, GemWeights> = {
  FW: { rating: 0.35, xg: 0.30, key_passes: 0.10, tackles: 0.05, interceptions: 0.05, passes: 0.05, dribbles: 0.10 },
  AM: { rating: 0.35, xg: 0.20, key_passes: 0.20, tackles: 0.05, interceptions: 0.05, passes: 0.10, dribbles: 0.05 },
  Winger: { rating: 0.35, xg: 0.15, key_passes: 0.15, tackles: 0.05, interceptions: 0.05, passes: 0.10, dribbles: 0.15 },
  CM: { rating: 0.35, xg: 0.10, key_passes: 0.20, tackles: 0.10, interceptions: 0.10, passes: 0.15, dribbles: 0.00 },
  FB: { rating: 0.35, xg: 0.05, key_passes: 0.15, tackles: 0.10, interceptions: 0.10, passes: 0.20, dribbles: 0.05 },
  DM: { rating: 0.35, xg: 0.05, key_passes: 0.10, tackles: 0.20, interceptions: 0.20, passes: 0.10, dribbles: 0.00 },
  CB: { rating: 0.35, xg: 0.05, key_passes: 0.05, tackles: 0.20, interceptions: 0.25, passes: 0.10, dribbles: 0.00 },
};

export function computeGemScore(p: Player): number {
  const w = POSITION_WEIGHTS[p.positionGroup];
  return (
    p.rating_merged / 10 * w.rating +
    p.xg_per_90_pct_merged * w.xg +
    p.key_passes_p90_pct_merged * w.key_passes +
    p.tackles_p90_pct_merged * w.tackles +
    p.interceptions_p90_pct_merged * w.interceptions +
    p.pass_success_pct_pct_merged * w.passes +
    p.dribbles_won_p90_pct_merged * w.dribbles
  );
}

export function getHiddenGems(players: Player[], topN = 20): Player[] {
  return players
    .filter(
      (p) =>
        p.age <= 26 &&
        p.rating_merged >= 6.5 &&
        !TOP_CLUBS_BIG6.has(p.club)
    )
    .map((p) => ({ ...p, gemScore: computeGemScore(p) }))
    .sort((a, b) => (b.gemScore ?? 0) - (a.gemScore ?? 0))
    .slice(0, topN);
}

export function getGemTopStat(p: Player): string {
  const stats: [string, number][] = [
    ["xG/90", p.xg_per_90_pct_merged],
    ["Key Passes/90", p.key_passes_p90_pct_merged],
    ["Tackles/90", p.tackles_p90_pct_merged],
    ["Interceptions/90", p.interceptions_p90_pct_merged],
    ["Pass%", p.pass_success_pct_pct_merged],
    ["Dribbles/90", p.dribbles_won_p90_pct_merged],
    ["Aerials/90", p.aerial_won_p90_pct_merged],
  ];
  stats.sort((a, b) => b[1] - a[1]);
  const top = stats[0];
  return `${top[0]} — Top ${Math.round((1 - top[1]) * 100)}% globally`;
}
