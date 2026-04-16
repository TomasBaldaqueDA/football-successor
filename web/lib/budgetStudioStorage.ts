export const BUDGET_STUDIO_STORAGE_KEY = "fs_budget_studio_snapshot_v1";

export type StoredPlayerHit = {
  player_id: string;
  player_name: string;
  last_club: string | null;
};

export type StoredComparisonMetric = {
  column: string;
  label: string;
  weight: number;
  target: number | null;
};

export type StoredTargetSummary = {
  player_id: string;
  player_name: string | null;
  last_club: string | null;
  nationality_code: string | null;
  age_last_season: number | null;
  market_value_eur?: string | null;
  market_value_text?: string | null;
  metricVals: Record<string, number | null>;
};

export type StoredBudgetRow = Record<string, unknown>;

export type BudgetStudioSnapshotV1 = {
  v: 1;
  q: string;
  target: StoredPlayerHit | null;
  buckets: string[];
  bucket: string;
  topN: number;
  preset: "ultra_budget" | "conservative" | "balanced" | "aggressive";
  weightVersion: string;
  budgetRatio: string;
  fitFloor: string;
  leagueBonusWeight: string;
  rows: StoredBudgetRow[];
  targetSummary: StoredTargetSummary | null;
  comparisonMetrics: StoredComparisonMetric[];
};

export function loadBudgetStudioSnapshot(): BudgetStudioSnapshotV1 | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(BUDGET_STUDIO_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as BudgetStudioSnapshotV1;
    if (data?.v !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveBudgetStudioSnapshot(
  s: Omit<BudgetStudioSnapshotV1, "v">,
): void {
  if (typeof window === "undefined") return;
  try {
    const payload: BudgetStudioSnapshotV1 = { v: 1, ...s };
    sessionStorage.setItem(BUDGET_STUDIO_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

