import { pickJsonNumber } from "@/lib/metricLabels";

export function asRecord(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export function poolMinutes(j: Record<string, unknown>): number {
  const candidates = [
    pickJsonNumber(j, "minutes_played"),
    pickJsonNumber(j, "minutes"),
    pickJsonNumber(j, "mins_played"),
    pickJsonNumber(j, "minutes_total"),
    pickJsonNumber(j, "total_minutes"),
    pickJsonNumber(j, "time_played"),
  ];
  for (const c of candidates) {
    if (c !== null && c > 0) return c;
  }
  return 0;
}

/** Transfermarkt-style top-tier codes for the five leagues (GB1 = Premier League, L1 = Bundesliga). */
export const BIG_FIVE_COMPETITION_CODES = new Set(["GB1", "ES1", "IT1", "L1", "FR1"]);

export const BIG_FIVE_CODE_LABEL: Record<string, string> = {
  GB1: "Premier League",
  ES1: "La Liga",
  IT1: "Serie A",
  L1: "Bundesliga",
  FR1: "Ligue 1",
};

function asTrimmedString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

export function poolCompetitionCode(j: Record<string, unknown>): string | null {
  const keys = [
    "competition_code",
    "league_code",
    "tm_competition_code",
    "domestic_competition_code",
    "competition_id",
    "league_id",
  ];
  for (const k of keys) {
    const raw = j[k];
    const s = asTrimmedString(raw);
    if (s) {
      const u = s.toUpperCase().replace(/\s+/g, "");
      if (/^[A-Z]{1,3}\d+$/.test(u)) return u;
      if (BIG_FIVE_COMPETITION_CODES.has(u)) return u;
    }
  }
  return null;
}

export function poolLeagueName(j: Record<string, unknown>): string {
  const orderedKeys = [
    "competition_name",
    "league_name",
    "league",
    "season_league",
    "domestic_league_name",
    "league_title",
    "competition",
    "competition_full_name",
    "tournament_name",
    "division_name",
    "division",
  ];
  for (const k of orderedKeys) {
    const s = asTrimmedString(j[k]);
    if (s) return s;
  }
  for (const [k, v] of Object.entries(j)) {
    const kl = k.toLowerCase();
    if (
      (kl.includes("league") || kl.includes("competition")) &&
      !kl.includes("coefficient") &&
      !kl.includes("strength") &&
      !kl.includes("bonus") &&
      !kl.includes("code") &&
      !kl.includes("_id")
    ) {
      const s = asTrimmedString(v);
      if (s) return s;
    }
  }
  return "";
}

export function poolLeagueStrengthCoeff(j: Record<string, unknown>): number {
  const c = pickJsonNumber(j, "league_strength_coefficient");
  if (c !== null && c > 0 && Number.isFinite(c)) return c;
  return 1;
}

/**
 * Premier League, La Liga, Serie A, Bundesliga, Ligue 1 — by name or TM competition_code.
 */
function isBigFiveLeague(leagueName: string): boolean {
  const lc = leagueName.toLowerCase().trim().normalize("NFD").replace(/\p{M}/gu, "");
  if (!lc) return false;
  if (lc.includes("premier league")) return true;
  if (lc.includes("la liga") || lc.startsWith("laliga") || /\blaliga\b/.test(lc)) return true;
  if (lc.includes("bundesliga")) return true;
  if (/\bligue\s*1\b/.test(lc) || lc.startsWith("ligue 1")) return true;
  if (lc.includes("serie b") || lc.includes("serie c")) return false;
  if (lc === "serie a" || lc.startsWith("serie a ") || /\bserie a\b/.test(lc)) return true;
  return false;
}

export function classifyBigFivePoolRow(
  j: Record<string, unknown>,
): { ok: true; display: string } | { ok: false; display: string } {
  const code = poolCompetitionCode(j);
  if (code && BIG_FIVE_COMPETITION_CODES.has(code)) {
    const name = poolLeagueName(j);
    const display = name || BIG_FIVE_CODE_LABEL[code] || code;
    return { ok: true, display };
  }
  const name = poolLeagueName(j);
  if (name && isBigFiveLeague(name)) {
    return { ok: true, display: name };
  }
  return { ok: false, display: name };
}
