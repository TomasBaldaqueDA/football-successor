/**
 * Tokens usados em played_positions_short / dim que correspondem a cada bucket.
 * O ranking usa isto em vez de só player_position_membership, porque essa tabela
 * inclui expansão cruzada (ex.: CB→DM→AM) e mete centrais no bucket AM.
 */
export const BUCKET_DIM_TOKEN_ALTS: Record<string, string[]> = {
  CB: ["CB", "DC"],
  FB: ["FB", "LB", "RB", "RWB", "LWB"],
  DM: ["DM", "CDM", "DMC", "DMF", "CDMF"],
  CM: ["CM", "MC"],
  AM: ["AM", "CAM"],
  W: ["W", "LW", "RW"],
  ST: ["ST", "CF"],
};

/**
 * Padrão Postgres ~ para token completo (evita "AM" dentro de "CAM" mal interpretado
 * quando o alternativo inclui ambos: testa limites antes de cada ramo).
 */
export function pgTokenBoundaryPatternForBucket(bucket: string): string | null {
  const raw = (bucket ?? "").trim();
  if (!raw || !/^[A-Za-z0-9_]+$/.test(raw)) return null;
  const alts = BUCKET_DIM_TOKEN_ALTS[raw] ?? [raw.toUpperCase()];
  const sanitized = alts
    .map((t) => t.toUpperCase().replace(/[^A-Z0-9]/g, ""))
    .filter((t) => t.length > 0);
  if (sanitized.length === 0) return null;
  const sorted = [...sanitized].sort((a, b) => b.length - a.length);
  const inner = sorted.join("|");
  return `(^|[^A-Z0-9])(${inner})($|[^A-Z0-9])`;
}
