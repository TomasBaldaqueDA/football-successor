export const L4L_STUDIO_STORAGE_KEY = "fs_l4l_studio_snapshot_v1";

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

export type StoredL4lRow = Record<string, unknown>;

export type L4lStudioSnapshotV1 = {
  v: 1;
  q: string;
  target: StoredPlayerHit | null;
  buckets: string[];
  bucket: string;
  topN: number;
  weightVersion: string;
  /** Idade candidatos: strings vazias = sem filtro */
  minAge?: string;
  maxAge?: string;
  rows: StoredL4lRow[];
  targetSummary: StoredTargetSummary | null;
  comparisonMetrics: StoredComparisonMetric[];
};

export function loadL4lStudioSnapshot(): L4lStudioSnapshotV1 | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(L4L_STUDIO_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as L4lStudioSnapshotV1;
    if (data?.v !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveL4lStudioSnapshot(s: Omit<L4lStudioSnapshotV1, "v">): void {
  if (typeof window === "undefined") return;
  try {
    const payload: L4lStudioSnapshotV1 = { v: 1, ...s };
    sessionStorage.setItem(L4L_STUDIO_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // quota or private mode
  }
}

export function clearL4lStudioSnapshot(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(L4L_STUDIO_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
