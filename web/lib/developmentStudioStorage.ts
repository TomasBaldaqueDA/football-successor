export const DEVELOPMENT_STUDIO_STORAGE_KEY = "fs_development_studio_snapshot_v1";

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
  position_text: string | null;
  played_positions_short: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  market_value_eur?: string | null;
  market_value_text?: string | null;
  metricVals: Record<string, number | null>;
};

export type StoredDevelopmentRow = Record<string, unknown>;

export type DevelopmentStudioSnapshotV1 = {
  v: 1;
  q: string;
  target: StoredPlayerHit | null;
  buckets: string[];
  bucket: string;
  topN: number;
  weightVersion: string;
  minAge: string;
  maxAge: string;
  cbMaxAge: string;
  rows: StoredDevelopmentRow[];
  targetSummary: StoredTargetSummary | null;
  comparisonMetrics: StoredComparisonMetric[];
};

export function loadDevelopmentStudioSnapshot(): DevelopmentStudioSnapshotV1 | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(DEVELOPMENT_STUDIO_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as DevelopmentStudioSnapshotV1;
    if (data?.v !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveDevelopmentStudioSnapshot(
  s: Omit<DevelopmentStudioSnapshotV1, "v">,
): void {
  if (typeof window === "undefined") return;
  try {
    const payload: DevelopmentStudioSnapshotV1 = { v: 1, ...s };
    sessionStorage.setItem(DEVELOPMENT_STUDIO_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota/private mode issues
  }
}

export function clearDevelopmentStudioSnapshot(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(DEVELOPMENT_STUDIO_STORAGE_KEY);
  } catch {
    // ignore
  }
}

