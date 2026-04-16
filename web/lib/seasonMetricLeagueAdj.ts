/**
 * Aligns with mart.player_profile_from_raw.sql: pct/rate-style columns skip league coefficient on season values.
 */
export function leagueStrengthMultiplierApplies(metricColumn: string): boolean {
  const withoutAdj = metricColumn.replace(/_adj_merged$/i, "");
  return !/(^|_)(pct|rate)($|_)/i.test(withoutAdj);
}

/**
 * Raw = single-season p90/rate from pool; coeff = league_strength_coefficient (default 1).
 */
export function seasonValueTimesLeagueStrength(
  raw: number | null,
  coeff: number,
  metricColumn: string,
): number | null {
  if (raw === null || !Number.isFinite(raw)) return null;
  const c = Number.isFinite(coeff) && coeff > 0 ? coeff : 1;
  if (!leagueStrengthMultiplierApplies(metricColumn)) return raw;
  return raw * c;
}

/** Min–max to [0,1]; best (highest adjusted) → 1, worst → 0. Constant cohort → 1 for all. */
export function minMaxNormalizeScores(values: number[]): number[] {
  if (values.length === 0) return [];
  let min = values[0];
  let max = values[0];
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (max <= min) return values.map(() => 1);
  return values.map((v) => (v - min) / (max - min));
}
