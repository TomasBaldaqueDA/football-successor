"use client";

import { useMemo } from "react";
import type { Player } from "@/lib/scouting/types";
import { POSITION_COLORS } from "@/lib/scouting/types";
import { getHiddenGems, getGemTopStat } from "@/lib/scouting/hiddenGems";
import { useFilterStore } from "@/lib/scouting/filterStore";

interface HiddenGemsProps {
  allPlayers: Player[];
}

function GemCard({ player, rank }: { player: Player; rank: number }) {
  const { openDetail, addToShortlist, shortlist } = useFilterStore();
  const posColor = POSITION_COLORS[player.positionGroup];
  const isShortlisted = shortlist.some((s) => s.name === player.name);
  const topStat = getGemTopStat(player);
  const score = ((player.gemScore ?? 0) * 100).toFixed(1);

  return (
    <div
      className="bg-[#0D1117] border border-white/10 rounded-lg p-3 flex gap-3 hover:border-[#00C9A7]/40 transition cursor-pointer group"
      onClick={() => openDetail(player)}
    >
      {/* Rank */}
      <div className="flex flex-col items-center justify-start gap-1 shrink-0 w-7">
        <span className="text-lg font-bold text-[#8B949E]">{rank}</span>
        <div
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: posColor }}
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[#E6EDF3] truncate">{player.name}</div>
            <div className="text-[11px] text-[#8B949E] truncate">
              {player.club} · Age {player.age} · {player.nationality.toUpperCase()}
            </div>
          </div>
          <div className="flex flex-col items-end gap-0.5 shrink-0">
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded"
              style={{ backgroundColor: posColor + "25", color: posColor }}
            >
              {player.positionGroup}
            </span>
            <span className="text-[11px] text-[#00C9A7] font-semibold">
              ⬥ {score}
            </span>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex gap-3 mt-1.5">
          <div className="text-[10px] text-[#8B949E]">
            Rating: <span className="text-[#E6EDF3] font-medium">{player.rating_merged.toFixed(2)}</span>
          </div>
          <div className="text-[10px] text-[#8B949E]">
            xG/90: <span className="text-[#E6EDF3] font-medium">{player.xg_per_90_merged.toFixed(2)}</span>
          </div>
          <div className="text-[10px] text-[#8B949E]">
            KP/90: <span className="text-[#E6EDF3] font-medium">{player.key_passes_p90_merged.toFixed(2)}</span>
          </div>
        </div>

        {/* Why tooltip */}
        <div className="mt-1 text-[10px] text-[#00C9A7]/80 italic truncate">
          ★ {topStat}
        </div>
      </div>

      {/* Shortlist btn */}
      <button
        onClick={(e) => { e.stopPropagation(); addToShortlist(player); }}
        disabled={isShortlisted}
        className={`self-center px-2 py-1 rounded text-[10px] border transition shrink-0 ${
          isShortlisted
            ? "border-[#00C9A7] text-[#00C9A7] opacity-50 cursor-default"
            : "border-white/10 text-[#8B949E] hover:border-[#FFD54F] hover:text-[#FFD54F]"
        }`}
      >
        {isShortlisted ? "✓" : "★"}
      </button>
    </div>
  );
}

export function HiddenGems({ allPlayers }: HiddenGemsProps) {
  const { positionGroups } = useFilterStore();

  const gems = useMemo(() => {
    const pool =
      positionGroups.length > 0
        ? allPlayers.filter((p) => positionGroups.includes(p.positionGroup))
        : allPlayers;
    return getHiddenGems(pool, 20);
  }, [allPlayers, positionGroups]);

  return (
    <div className="bg-[#161B22] border border-white/10 rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#E6EDF3]">
          Hidden Gems Finder
          <span className="ml-2 text-[11px] text-[#8B949E] font-normal">
            Age ≤26 · Rating ≥6.5 · Non-Big6
          </span>
        </h3>
        <span className="text-[11px] text-[#8B949E]">{gems.length} found</span>
      </div>

      <div className="text-[10px] text-[#8B949E] bg-[#0D1117] rounded px-2 py-1.5 border border-white/5">
        Score = Rating(40%) + xG%(20%) + Key Passes%(15%) + Tackles%(10%) + Pass Success%(15%) — weighted by position
      </div>

      <div className="flex flex-col gap-2 max-h-[600px] overflow-y-auto pr-1">
        {gems.map((p, i) => (
          <GemCard key={p.name} player={p} rank={i + 1} />
        ))}
        {gems.length === 0 && (
          <div className="text-center text-[#8B949E] text-sm py-8">
            No hidden gems found with current filters
          </div>
        )}
      </div>
    </div>
  );
}
