"use client";

import { useEffect, useState } from "react";
import type { Player } from "@/lib/scouting/types";
import { loadPlayers } from "@/lib/scouting/dataLoader";
import { useFilterStore, applyFilters } from "@/lib/scouting/filterStore";

import { FilterBar } from "./scouting/FilterBar";
import { KPIStrip } from "./scouting/KPIStrip";
import { InsightChips } from "./scouting/InsightChips";
import { TopPlayersBar } from "./scouting/TopPlayersBar";
import { ScatterPlot } from "./scouting/ScatterPlot";
import { RadarChart } from "./scouting/RadarChart";
import { HeatmapChart } from "./scouting/HeatmapChart";
import { AgeTalentCurve } from "./scouting/AgeTalentCurve";
import { BoxPlots } from "./scouting/BoxPlots";
import { NationalityChart } from "./scouting/NationalityChart";
import { LeaderboardTable } from "./scouting/LeaderboardTable";
import { PlayerDetailPanel } from "./scouting/PlayerDetailPanel";
import { ClubDensityChart } from "./scouting/ClubDensityChart";
import { HiddenGems } from "./scouting/HiddenGems";
import { ShortlistDrawer } from "./scouting/ShortlistDrawer";
import { MetricsGuide } from "./scouting/MetricsGuide";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "search", label: "Player Search" },
  { id: "comparisons", label: "Comparisons" },
  { id: "scouting", label: "Scouting" },
  { id: "guide", label: "Metrics Guide" },
] as const;

export function ScoutingDashboard() {
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const store = useFilterStore();
  const { activeTab, setActiveTab, detailPlayer, showDetail, showShortlist, setShowShortlist, shortlist } = store;

  useEffect(() => {
    loadPlayers()
      .then((players) => {
        setAllPlayers(players);
        setLoading(false);
      })
      .catch((e) => {
        setError(String(e));
        setLoading(false);
      });
  }, []);

  const filteredPlayers = applyFilters(allPlayers, store);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D1117] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-[#00C9A7] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#8B949E] text-sm">Loading scouting data…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0D1117] flex items-center justify-center">
        <div className="text-[#FF6B6B] text-sm">Error loading data: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D1117] text-[#E6EDF3] flex flex-col" style={{ fontFamily: "var(--font-geist-sans), Inter, sans-serif" }}>
      {/* Sticky header */}
      <header className="sticky top-0 z-40 bg-[#0D1117]/95 backdrop-blur border-b border-white/10 px-4 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded bg-[#00C9A7] flex items-center justify-center text-[#0D1117] font-bold text-xs">S</div>
          <span className="font-semibold text-sm">Scouting Dashboard</span>
          <span className="text-[11px] text-[#8B949E]">{allPlayers.length.toLocaleString()} players · 5 seasons · 12 leagues</span>
        </div>

        {/* Tab navigation */}
        <nav className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                activeTab === tab.id
                  ? "bg-[#00C9A7]/15 text-[#00C9A7] border border-[#00C9A7]/30"
                  : "text-[#8B949E] hover:text-[#E6EDF3]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Shortlist button */}
        <button
          onClick={() => setShowShortlist(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-white/10 text-xs text-[#8B949E] hover:border-[#FFD54F] hover:text-[#FFD54F] transition"
        >
          ★ Shortlist
          {shortlist.length > 0 && (
            <span className="bg-[#FFD54F] text-[#0D1117] rounded-full w-4 h-4 text-[10px] font-bold flex items-center justify-center">
              {shortlist.length}
            </span>
          )}
        </button>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 min-h-0">
        <FilterBar allPlayers={allPlayers} />

        {/* Content area */}
        <main className="flex-1 overflow-y-auto p-4 min-w-0">
          <KPIStrip players={filteredPlayers} />
          <InsightChips players={filteredPlayers} />

          {/* Tab content */}
          {activeTab === "overview" && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <TopPlayersBar players={filteredPlayers} />
                <ScatterPlot players={filteredPlayers} />
              </div>
              <AgeTalentCurve players={filteredPlayers} />
              <BoxPlots players={filteredPlayers} />
            </div>
          )}

          {activeTab === "search" && (
            <div className="flex flex-col gap-4">
              <LeaderboardTable players={filteredPlayers} />
              <NationalityChart players={filteredPlayers} />
              <ClubDensityChart players={filteredPlayers} />
            </div>
          )}

          {activeTab === "comparisons" && (
            <div className="flex flex-col gap-4">
              <RadarChart allPlayers={allPlayers} />
              <HeatmapChart allPlayers={allPlayers} />
            </div>
          )}

          {activeTab === "guide" && <MetricsGuide />}

          {activeTab === "scouting" && (
            <div className="flex flex-col gap-4">
              <HiddenGems allPlayers={allPlayers} />
              <div className="grid grid-cols-2 gap-4">
                <AgeTalentCurve players={filteredPlayers} />
                <ClubDensityChart players={filteredPlayers} />
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Overlays */}
      {showDetail && detailPlayer && <PlayerDetailPanel player={detailPlayer} />}
      {showShortlist && <ShortlistDrawer />}
    </div>
  );
}
