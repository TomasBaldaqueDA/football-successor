"use client";

import type { Player } from "@/lib/scouting/types";
import { POSITION_COLORS } from "@/lib/scouting/types";
import { useFilterStore } from "@/lib/scouting/filterStore";

export function ShortlistDrawer() {
  const { shortlist, removeFromShortlist, setShowShortlist, addComparisonPlayer, clearComparison, setActiveTab } =
    useFilterStore();

  const exportCSV = () => {
    if (shortlist.length === 0) return;
    const headers = ["Name", "Age", "Club", "Nationality", "Position", "Rating", "xG/90", "Key Passes/90"];
    const rows = shortlist.map((p) =>
      [p.name, p.age, p.club, p.nationality, p.positionGroup, p.rating_merged.toFixed(2), p.xg_per_90_merged.toFixed(2), p.key_passes_p90_merged.toFixed(2)].join(",")
    );
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "shortlist.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const compareShortlist = () => {
    clearComparison();
    shortlist.slice(0, 3).forEach((p) => addComparisonPlayer(p));
    setActiveTab("comparisons");
    setShowShortlist(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end pointer-events-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 pointer-events-auto"
        onClick={() => setShowShortlist(false)}
      />
      <div className="relative h-full w-[380px] bg-[#0D1117] border-l border-white/10 flex flex-col pointer-events-auto shadow-2xl z-10">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-sm font-semibold text-[#E6EDF3]">
            Shortlist
            <span className="ml-2 text-[11px] text-[#8B949E]">{shortlist.length}/20 players</span>
          </h2>
          <button
            onClick={() => setShowShortlist(false)}
            className="text-[#8B949E] hover:text-[#E6EDF3] text-lg"
          >
            ×
          </button>
        </div>

        {/* Players */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
          {shortlist.length === 0 ? (
            <div className="text-center text-[#8B949E] text-sm py-12">
              No players shortlisted yet.<br />
              <span className="text-[11px]">Click ★ on any player to add them.</span>
            </div>
          ) : (
            shortlist.map((p: Player, i: number) => {
              const posColor = POSITION_COLORS[p.positionGroup];
              return (
                <div
                  key={p.name}
                  className="flex items-center gap-2 bg-[#161B22] border border-white/5 rounded-lg px-3 py-2"
                >
                  <span className="text-[#8B949E] text-xs w-4">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-[#E6EDF3] truncate">{p.name}</div>
                    <div className="text-[10px] text-[#8B949E] truncate">
                      {p.club} · Age {p.age}
                    </div>
                  </div>
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
                    style={{ backgroundColor: posColor + "25", color: posColor }}
                  >
                    {p.positionGroup}
                  </span>
                  <span className="text-[11px] font-bold text-[#00C9A7] shrink-0">
                    {p.rating_merged.toFixed(2)}
                  </span>
                  <button
                    onClick={() => removeFromShortlist(p.name)}
                    className="text-[#8B949E] hover:text-[#FF6B6B] transition text-sm"
                  >
                    ×
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Actions */}
        {shortlist.length > 0 && (
          <div className="p-3 border-t border-white/10 flex flex-col gap-2">
            <button
              onClick={compareShortlist}
              className="w-full py-2 rounded text-xs font-medium bg-[#00C9A7]/10 border border-[#00C9A7]/50 text-[#00C9A7] hover:bg-[#00C9A7]/20 transition"
            >
              Compare First 3 in Radar →
            </button>
            <button
              onClick={exportCSV}
              className="w-full py-2 rounded text-xs font-medium bg-[#FFD54F]/10 border border-[#FFD54F]/50 text-[#FFD54F] hover:bg-[#FFD54F]/20 transition"
            >
              Export Shortlist CSV
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
