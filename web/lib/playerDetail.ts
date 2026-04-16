import { getPool } from "@/lib/db";
import { formatP90MergedLabel } from "@/lib/metricLabels";

export type PlayerDetailDim = Record<string, string | number | null>;

export type PlayerDetailStat = {
  key: string;
  label: string;
  value: string | number | null;
};

export type PlayerDetailData = {
  playerId: string;
  dim: PlayerDetailDim | null;
  p90Stats: PlayerDetailStat[];
  meta: PlayerDetailStat[];
  otherMerged: PlayerDetailStat[];
  /** Última linha época no pool limpo (se a tabela existir). */
  latestPoolSeason: PlayerDetailStat[] | null;
};

function asScalar(v: unknown): string | number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
    return typeof v === "boolean" ? String(v) : v;
  }
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function rowToDim(row: Record<string, unknown>): PlayerDetailDim {
  const out: PlayerDetailDim = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = asScalar(v);
  }
  return out;
}

function isMetaMergedKey(key: string): boolean {
  const meta = new Set([
    "player_id",
    "seasons_used",
    "sum_weights",
    "rating_merged",
    "coefficient_version",
    "normalization_version",
    "league_strength_coefficient",
  ]);
  if (meta.has(key)) return true;
  if (key.startsWith("league_")) return true;
  if (key === "season_slug") return true;
  return false;
}

/** Bruto agregado: só *_p90_merged e *_per_90_merged (sem adj / norm / pct). */
export async function getPlayerDetail(playerId: string): Promise<PlayerDetailData | null> {
  if (!/^\d+$/.test(playerId)) return null;

  const pool = getPool();

  const { rows: dimRows } = await pool.query<Record<string, unknown>>(
    `select * from mart.player_dim where player_id = $1::bigint limit 1`,
    [playerId],
  );

  const { rows: mergedRows } = await pool.query<{ j: unknown }>(
    `select to_jsonb(m) as j
     from mart.player_profile_merged_v1 m
     where player_id = $1::bigint
     limit 1`,
    [playerId],
  );

  const dim = dimRows[0] ? rowToDim(dimRows[0]) : null;
  const raw = mergedRows[0]?.j;
  const j =
    raw !== null && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : null;

  if (!dim && !j) return null;

  let latestPoolSeason: PlayerDetailStat[] | null = null;
  try {
    const { rows: poolRows } = await pool.query<{ j: unknown }>(
      `select to_jsonb(t) as j
       from mart.player_pool_clean_tbl t
       where t.player_id = $1::bigint
       order by t.season_slug desc nulls last
       limit 1`,
      [playerId],
    );
    const pj = poolRows[0]?.j;
    if (pj !== null && typeof pj === "object" && !Array.isArray(pj)) {
      const flat: PlayerDetailStat[] = [];
      for (const [key, val] of Object.entries(pj as Record<string, unknown>)) {
        if (val !== null && typeof val === "object") continue;
        flat.push({
          key,
          label: key.replace(/_/g, " "),
          value: asScalar(val) as string | number | null,
        });
      }
      flat.sort((a, b) => a.key.localeCompare(b.key));
      latestPoolSeason = flat.length > 0 ? flat : null;
    }
  } catch {
    latestPoolSeason = null;
  }

  const p90Stats: PlayerDetailStat[] = [];
  const meta: PlayerDetailStat[] = [];
  const otherMerged: PlayerDetailStat[] = [];

  if (j) {
    for (const [key, val] of Object.entries(j)) {
      if (
        key.endsWith("_adj_merged") ||
        key.endsWith("_norm_merged") ||
        key.endsWith("_pct_merged")
      ) {
        continue;
      }

      if (key.endsWith("_p90_merged") || key.endsWith("_per_90_merged")) {
        p90Stats.push({
          key,
          label: formatP90MergedLabel(key),
          value: asScalar(val) as string | number | null,
        });
        continue;
      }

      if (isMetaMergedKey(key)) {
        meta.push({
          key,
          label: key.replace(/_/g, " "),
          value: asScalar(val) as string | number | null,
        });
        continue;
      }

      otherMerged.push({
        key,
        label: key.replace(/_/g, " "),
        value: asScalar(val) as string | number | null,
      });
    }

    p90Stats.sort((a, b) => a.label.localeCompare(b.label, "pt"));
    meta.sort((a, b) => a.label.localeCompare(b.label, "pt"));
    otherMerged.sort((a, b) => a.key.localeCompare(b.key));
  }

  return {
    playerId,
    dim,
    p90Stats,
    meta,
    otherMerged,
    latestPoolSeason,
  };
}
