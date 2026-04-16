export const ROLE_STUDIO_STORAGE_KEY = "fs_role_studio_snapshot_v1";

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

export type StoredRoleRow = Record<string, unknown>;

export type RoleStudioSnapshotV1 = {
  v: 1;
  q: string;
  target: StoredPlayerHit | null;
  buckets: string[];
  bucket: string;
  topN: number;
  weightVersion: string;
  minAge: string;
  maxAge: string;
  rows: StoredRoleRow[];
  targetSummary: StoredTargetSummary | null;
  comparisonMetrics: StoredComparisonMetric[];
};

export function loadRoleStudioSnapshot(): RoleStudioSnapshotV1 | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(ROLE_STUDIO_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as RoleStudioSnapshotV1;
    if (data?.v !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveRoleStudioSnapshot(
  s: Omit<RoleStudioSnapshotV1, "v">,
): void {
  if (typeof window === "undefined") return;
  try {
    const payload: RoleStudioSnapshotV1 = { v: 1, ...s };
    sessionStorage.setItem(ROLE_STUDIO_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota/private mode issues
  }
}

export function clearRoleStudioSnapshot(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(ROLE_STUDIO_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

