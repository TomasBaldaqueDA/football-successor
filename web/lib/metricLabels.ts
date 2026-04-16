/** Human-readable label for mart.player_profile_merged_v1 adj_merged columns */
export function formatMetricLabel(column: string): string {
  const trimmed = column
    .replace(/_per_90_adj_merged$/i, "")
    .replace(/_p90_adj_merged$/i, "")
    .replace(/_pct_adj_merged$/i, "")
    .replace(/_adj_merged$/i, "");
  return trimmed.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function pickJsonNumber(row: Record<string, unknown>, key: string): number | null {
  const v = row[key];
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Label for merged raw p90 columns (no adj). */
export function formatP90MergedLabel(column: string): string {
  return column
    .replace(/_per_90_merged$/i, "")
    .replace(/_p90_merged$/i, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
