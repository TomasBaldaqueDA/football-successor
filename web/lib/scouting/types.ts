export type PositionGroup =
  | "CB"
  | "FB"
  | "DM"
  | "CM"
  | "Winger"
  | "AM"
  | "FW";

export interface RawPlayer {
  name: string;
  age: number;
  club: string;
  positions: string;
  nationality: string;
  rating_merged: number;
  goals_p90_merged: number;
  assists_p90_merged: number;
  xg_per_90_merged: number;
  shots_p90_merged: number;
  key_passes_p90_merged: number;
  passes_p90_merged: number;
  accurate_crosses_p90_merged: number;
  interceptions_p90_merged: number;
  tackles_p90_merged: number;
  blocks_p90_merged: number;
  dribbles_won_p90_merged: number;
  aerial_won_p90_merged: number;
  pass_success_pct_merged: number;
  dispossessed_p90_merged: number;
  turnovers_p90_merged: number;
  // percentile columns (0–1)
  goals_p90_pct_merged: number;
  assists_p90_pct_merged: number;
  xg_per_90_pct_merged: number;
  key_passes_p90_pct_merged: number;
  tackles_p90_pct_merged: number;
  interceptions_p90_pct_merged: number;
  pass_success_pct_pct_merged: number;
  dribbles_won_p90_pct_merged: number;
  aerial_won_p90_pct_merged: number;
}

export interface Player extends RawPlayer {
  positionGroup: PositionGroup;
  gemScore?: number;
}

export type MetricKey =
  | "goals_p90_merged"
  | "assists_p90_merged"
  | "xg_per_90_merged"
  | "shots_p90_merged"
  | "key_passes_p90_merged"
  | "passes_p90_merged"
  | "accurate_crosses_p90_merged"
  | "interceptions_p90_merged"
  | "tackles_p90_merged"
  | "blocks_p90_merged"
  | "dribbles_won_p90_merged"
  | "aerial_won_p90_merged"
  | "pass_success_pct_merged"
  | "dispossessed_p90_merged"
  | "turnovers_p90_merged"
  | "rating_merged";

export type PctMetricKey =
  | "goals_p90_pct_merged"
  | "assists_p90_pct_merged"
  | "xg_per_90_pct_merged"
  | "key_passes_p90_pct_merged"
  | "tackles_p90_pct_merged"
  | "interceptions_p90_pct_merged"
  | "pass_success_pct_pct_merged"
  | "dribbles_won_p90_pct_merged"
  | "aerial_won_p90_pct_merged";

export interface MetricOption {
  key: MetricKey;
  label: string;
  short: string;
}

export const METRIC_OPTIONS: MetricOption[] = [
  { key: "goals_p90_merged", label: "Goals / 90", short: "Goals" },
  { key: "assists_p90_merged", label: "Assists / 90", short: "Assists" },
  { key: "xg_per_90_merged", label: "xG / 90", short: "xG" },
  { key: "shots_p90_merged", label: "Shots / 90", short: "Shots" },
  { key: "key_passes_p90_merged", label: "Key Passes / 90", short: "Key Passes" },
  { key: "passes_p90_merged", label: "Passes / 90", short: "Passes" },
  { key: "accurate_crosses_p90_merged", label: "Accurate Crosses / 90", short: "Crosses" },
  { key: "interceptions_p90_merged", label: "Interceptions / 90", short: "Interceptions" },
  { key: "tackles_p90_merged", label: "Tackles / 90", short: "Tackles" },
  { key: "blocks_p90_merged", label: "Blocks / 90", short: "Blocks" },
  { key: "dribbles_won_p90_merged", label: "Dribbles Won / 90", short: "Dribbles" },
  { key: "aerial_won_p90_merged", label: "Aerials Won / 90", short: "Aerials" },
  { key: "pass_success_pct_merged", label: "Pass Success %", short: "Pass%" },
  { key: "rating_merged", label: "Overall Rating", short: "Rating" },
];

export const POSITION_COLORS: Record<PositionGroup, string> = {
  CB: "#4FC3F7",
  FB: "#81D4FA",
  DM: "#A5D6A7",
  CM: "#C5E1A5",
  Winger: "#FFD54F",
  AM: "#FFAB40",
  FW: "#FF7043",
};

export const POSITION_GROUPS: PositionGroup[] = [
  "CB", "FB", "DM", "CM", "Winger", "AM", "FW",
];

export const TOP_CLUBS_BIG6 = new Set([
  // England
  "Manchester City", "Manchester United", "Arsenal", "Liverpool", "Chelsea", "Tottenham",
  // Spain
  "Real Madrid", "Barcelona", "Atlético de Madrid", "Atletico Madrid", "Athletic Club", "Athletic Bilbao",
  // Germany
  "Bayern Munich", "Bayern München", "Borussia Dortmund", "RB Leipzig", "Bayer Leverkusen",
  // Italy
  "Juventus", "Inter", "AC Milan", "Napoli", "AS Roma", "Lazio",
  // France
  "Paris Saint-Germain", "PSG", "Marseille", "Lyon", "Monaco",
  // Portugal
  "Benfica", "Porto", "Sporting CP", "Sporting",
]);
