import { pickJsonNumber } from "@/lib/metricLabels";

/**
 * Resolve a value from a single mart.player_pool_clean_tbl row (as json)
 * for metrics keyed like mart.player_profile_merged_v1 (*_adj_merged in weights).
 * Uses per-90 from totals when the pool row only has season totals.
 */
export function pickSeasonPoolValue(
  j: Record<string, unknown>,
  minutes: number,
  adjMergedColumn: string,
): number | null {
  const mergedKey = adjMergedColumn.replace(/_adj_merged$/i, "");
  const inner = mergedKey.replace(/_merged$/i, "");

  const pn = (k: string) => pickJsonNumber(j, k);

  for (const k of [inner, mergedKey, adjMergedColumn]) {
    const v = pn(k);
    if (v !== null) return v;
  }

  const mP90 = /^(.+)_p90$/i.exec(inner);
  if (mP90 && !/_per_90$/i.test(inner)) {
    const stem = mP90[1];
    const asP90Col = pn(inner);
    if (asP90Col !== null) return asP90Col;
    const total = pn(stem);
    if (total !== null && minutes > 0) return (total / minutes) * 90;
  }

  const mPer = /^(.+)_per_90$/i.exec(inner);
  if (mPer) {
    const stem = mPer[1];
    const rate = pn(inner);
    if (rate !== null) return rate;
    const total = pn(stem);
    if (total !== null && minutes > 0) return (total / minutes) * 90;
  }

  return null;
}
