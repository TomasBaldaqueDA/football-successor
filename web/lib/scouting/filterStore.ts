import { create } from "zustand";
import type { MetricKey, Player, PositionGroup } from "./types";
import { METRIC_OPTIONS } from "./types";

export interface FilterState {
  // Global filters
  positionGroups: PositionGroup[];
  ageMin: number;
  ageMax: number;
  nationalities: string[];
  clubs: string[];
  minRating: number;
  playerSearch: string;
  metricX: MetricKey;
  metricY: MetricKey;
  topN: number;

  // Scatter chart selected metric for box/bar
  selectedBarMetric: MetricKey;
  selectedBoxMetric: MetricKey;
  selectedClubMetric: "avgRating" | "avgXg" | "squadDepth";

  // Player comparison (radar)
  comparisonPlayers: Player[];

  // Shortlist
  shortlist: Player[];

  // Active tab
  activeTab: "overview" | "search" | "comparisons" | "scouting";

  // Player detail panel
  detailPlayer: Player | null;
  showDetail: boolean;

  // Show shortlist drawer
  showShortlist: boolean;

  // Setters
  setPositionGroups: (v: PositionGroup[]) => void;
  setAgeMin: (v: number) => void;
  setAgeMax: (v: number) => void;
  setNationalities: (v: string[]) => void;
  setClubs: (v: string[]) => void;
  setMinRating: (v: number) => void;
  setPlayerSearch: (v: string) => void;
  setMetricX: (v: MetricKey) => void;
  setMetricY: (v: MetricKey) => void;
  setTopN: (v: number) => void;
  setSelectedBarMetric: (v: MetricKey) => void;
  setSelectedBoxMetric: (v: MetricKey) => void;
  setSelectedClubMetric: (v: "avgRating" | "avgXg" | "squadDepth") => void;
  addComparisonPlayer: (p: Player) => void;
  removeComparisonPlayer: (name: string) => void;
  clearComparison: () => void;
  addToShortlist: (p: Player) => void;
  removeFromShortlist: (name: string) => void;
  setActiveTab: (v: "overview" | "search" | "comparisons" | "scouting") => void;
  openDetail: (p: Player) => void;
  closeDetail: () => void;
  setShowShortlist: (v: boolean) => void;
  resetFilters: () => void;
}

const DEFAULT_X = METRIC_OPTIONS.find((m) => m.key === "xg_per_90_merged")!.key;
const DEFAULT_Y = METRIC_OPTIONS.find((m) => m.key === "key_passes_p90_merged")!.key;

export const useFilterStore = create<FilterState>((set) => ({
  positionGroups: ["FW"],
  ageMin: 18,
  ageMax: 26,
  nationalities: [],
  clubs: [],
  minRating: 6.8,
  playerSearch: "",
  metricX: DEFAULT_X,
  metricY: DEFAULT_Y,
  topN: 15,
  selectedBarMetric: "goals_p90_merged",
  selectedBoxMetric: "xg_per_90_merged",
  selectedClubMetric: "avgRating",
  comparisonPlayers: [],
  shortlist: [],
  activeTab: "overview",
  detailPlayer: null,
  showDetail: false,
  showShortlist: false,

  setPositionGroups: (v) => set({ positionGroups: v }),
  setAgeMin: (v) => set({ ageMin: v }),
  setAgeMax: (v) => set({ ageMax: v }),
  setNationalities: (v) => set({ nationalities: v }),
  setClubs: (v) => set({ clubs: v }),
  setMinRating: (v) => set({ minRating: v }),
  setPlayerSearch: (v) => set({ playerSearch: v }),
  setMetricX: (v) => set({ metricX: v }),
  setMetricY: (v) => set({ metricY: v }),
  setTopN: (v) => set({ topN: v }),
  setSelectedBarMetric: (v) => set({ selectedBarMetric: v }),
  setSelectedBoxMetric: (v) => set({ selectedBoxMetric: v }),
  setSelectedClubMetric: (v) => set({ selectedClubMetric: v }),
  addComparisonPlayer: (p) =>
    set((s) => ({
      comparisonPlayers:
        s.comparisonPlayers.length < 3 && !s.comparisonPlayers.find((x) => x.name === p.name)
          ? [...s.comparisonPlayers, p]
          : s.comparisonPlayers,
      activeTab: "comparisons",
    })),
  removeComparisonPlayer: (name) =>
    set((s) => ({ comparisonPlayers: s.comparisonPlayers.filter((p) => p.name !== name) })),
  clearComparison: () => set({ comparisonPlayers: [] }),
  addToShortlist: (p) =>
    set((s) => ({
      shortlist:
        s.shortlist.length < 20 && !s.shortlist.find((x) => x.name === p.name)
          ? [...s.shortlist, p]
          : s.shortlist,
    })),
  removeFromShortlist: (name) =>
    set((s) => ({ shortlist: s.shortlist.filter((p) => p.name !== name) })),
  setActiveTab: (v) => set({ activeTab: v }),
  openDetail: (p) => set({ detailPlayer: p, showDetail: true }),
  closeDetail: () => set({ showDetail: false }),
  setShowShortlist: (v) => set({ showShortlist: v }),
  resetFilters: () =>
    set({
      positionGroups: ["FW"],
      ageMin: 18,
      ageMax: 26,
      nationalities: [],
      clubs: [],
      minRating: 6.8,
      playerSearch: "",
      metricX: DEFAULT_X,
      metricY: DEFAULT_Y,
    }),
}));

/** Apply all global filters to a player array */
export function applyFilters(players: Player[], s: FilterState): Player[] {
  return players.filter((p) => {
    if (s.positionGroups.length > 0 && !s.positionGroups.includes(p.positionGroup)) return false;
    if (p.age < s.ageMin || p.age > s.ageMax) return false;
    if (s.nationalities.length > 0 && !s.nationalities.includes(p.nationality)) return false;
    if (s.clubs.length > 0 && !s.clubs.includes(p.club)) return false;
    if (p.rating_merged < s.minRating) return false;
    if (
      s.playerSearch.trim() &&
      !p.name.toLowerCase().includes(s.playerSearch.toLowerCase())
    )
      return false;
    return true;
  });
}
