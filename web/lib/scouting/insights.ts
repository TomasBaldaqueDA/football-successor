import type { Player } from "./types";

export interface InsightChip {
  text: string;
  type: "positive" | "neutral" | "warning";
}

export function generateInsights(players: Player[]): InsightChip[] {
  if (players.length === 0) return [];
  const chips: InsightChip[] = [];

  // Insight 1: Young players in top 5% for xG
  const youngHighXg = players.filter(
    (p) => p.age <= 23 && p.xg_per_90_pct_merged >= 0.95
  );
  if (youngHighXg.length > 0) {
    chips.push({
      text: `${youngHighXg.length} player${youngHighXg.length > 1 ? "s" : ""} in the Top 5% for xG/90 aged under 24`,
      type: "positive",
    });
  }

  // Insight 2: Top interceptor among CBs
  const cbs = players.filter((p) => p.positionGroup === "CB");
  if (cbs.length > 1) {
    const avgInter = cbs.reduce((s, p) => s + p.interceptions_p90_merged, 0) / cbs.length;
    const pct = cbs.filter((p) => p.interceptions_p90_pct_merged >= 0.9).length;
    chips.push({
      text: `CBs in view avg ${avgInter.toFixed(2)} interceptions/90${pct > 0 ? ` — ${pct} in top 10% globally` : ""}`,
      type: "neutral",
    });
  }

  // Insight 3: Goals vs xG overperformer
  const overperformers = players
    .filter((p) => p.xg_per_90_merged > 0.05)
    .map((p) => ({ p, diff: p.goals_p90_merged - p.xg_per_90_merged }))
    .sort((a, b) => b.diff - a.diff);
  if (overperformers.length > 0 && overperformers[0].diff > 0.1) {
    const top = overperformers[0];
    chips.push({
      text: `${top.p.name} outperforms xG by +${top.diff.toFixed(2)} goals/90 — elite conversion`,
      type: "positive",
    });
  }

  // Insight 4: Best dribbling nationality
  const natMap = new Map<string, number[]>();
  players.forEach((p) => {
    if (!natMap.has(p.nationality)) natMap.set(p.nationality, []);
    natMap.get(p.nationality)!.push(p.dribbles_won_p90_merged);
  });
  let bestNat = "";
  let bestAvg = 0;
  natMap.forEach((vals, nat) => {
    if (vals.length >= 3) {
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      if (avg > bestAvg) { bestAvg = avg; bestNat = nat; }
    }
  });
  if (bestNat) {
    chips.push({
      text: `Players from ${bestNat.toUpperCase()} avg highest dribbles won/90 in this view (${bestAvg.toFixed(2)})`,
      type: "neutral",
    });
  }

  // Insight 5: Hidden talent age bracket
  const under21HighRating = players.filter((p) => p.age <= 21 && p.rating_merged >= 7.0);
  if (under21HighRating.length > 0) {
    chips.push({
      text: `${under21HighRating.length} player${under21HighRating.length > 1 ? "s" : ""} aged ≤21 with rating ≥ 7.0 in current view`,
      type: "positive",
    });
  }

  // Insight 6: Total players warning if large set
  if (players.length > 1000) {
    chips.push({
      text: `Large dataset: ${players.length} players visible — refine filters for sharper insights`,
      type: "warning",
    });
  }

  return chips.slice(0, 4);
}
