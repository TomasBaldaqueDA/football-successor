import type { PositionGroup } from "./types";

/**
 * Derives a single primary position group from the `positions` string.
 * Priority order (highest first): CB → FB → DM → CM → Winger → AM → FW
 */
export function derivePositionGroup(positions: string): PositionGroup {
  if (!positions) return "CM"; // fallback

  if (positions.includes("D(C)")) return "CB";

  // FB: has D(L) or D(R) but NOT D(C)
  if (
    (positions.includes("D(L)") || positions.includes("D(R)") || positions.includes("D(LR)")) &&
    !positions.includes("D(C)")
  )
    return "FB";

  if (positions.includes("DMC")) return "DM";

  if (positions.includes("M(C)")) return "CM";

  // Winger: M(L), M(R), AM(L), AM(R) but no AM(C)
  if (
    (positions.includes("M(L)") ||
      positions.includes("M(R)") ||
      positions.includes("AM(L)") ||
      positions.includes("AM(R)")) &&
    !positions.includes("AM(C)")
  )
    return "Winger";

  if (positions.includes("AM(C)")) return "AM";

  if (positions.includes("FW")) return "FW";

  // Secondary fallbacks for combined tags
  if (positions.includes("AM")) return "AM";
  if (positions.includes("M(")) return "CM";

  return "CM";
}
