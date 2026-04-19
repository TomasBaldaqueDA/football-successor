"use client";

import { useMemo, useState } from "react";
import type { Player, PositionGroup } from "@/lib/scouting/types";
import { POSITION_COLORS, POSITION_GROUPS } from "@/lib/scouting/types";
import { TOP_CLUBS_BIG6 } from "@/lib/scouting/types";
import { computeGemScore, getGemTopStat } from "@/lib/scouting/hiddenGems";
import { useFilterStore } from "@/lib/scouting/filterStore";

// ─── Gem Card ────────────────────────────────────────────────────────────────

function GemCard({ player, rank }: { player: Player; rank: number }) {
  const { openDetail, addToShortlist, shortlist } = useFilterStore();
  const posColor = POSITION_COLORS[player.positionGroup];
  const isShortlisted = shortlist.some((s) => s.name === player.name);
  const topStat = getGemTopStat(player);
  const score = ((player.gemScore ?? 0) * 100).toFixed(1);

  return (
    <div
      className="bg-[#0D1117] border border-white/10 rounded-lg p-3 flex gap-3 hover:border-[#00C9A7]/40 transition cursor-pointer"
      onClick={() => openDetail(player)}
    >
      {/* Rank */}
      <div className="flex flex-col items-center justify-start gap-1 shrink-0 w-7">
        <span className="text-lg font-bold text-[#8B949E]">{rank}</span>
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: posColor }} />
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
            <span className="text-[11px] text-[#00C9A7] font-semibold">⬥ {score}</span>
          </div>
        </div>

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

        <div className="mt-1 text-[10px] text-[#00C9A7]/80 italic truncate">★ {topStat}</div>
      </div>

      {/* Shortlist */}
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

// ─── Main Component ───────────────────────────────────────────────────────────

interface HiddenGemsProps {
  allPlayers: Player[];
}

type SortKey = "gemScore" | "rating" | "age";

export function HiddenGems({ allPlayers }: HiddenGemsProps) {
  // Local filters — independentes da sidebar global
  const [positions, setPositions] = useState<PositionGroup[]>([]);
  const [ageMax, setAgeMax] = useState(26);
  const [minRating, setMinRating] = useState(6.5);
  const [natSearch, setNatSearch] = useState("");
  const [selectedNats, setSelectedNats] = useState<string[]>([]);
  const [clubSearch, setClubSearch] = useState("");
  const [selectedClubs, setSelectedClubs] = useState<string[]>([]);
  const [excludeBig6, setExcludeBig6] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("gemScore");
  const [topN, setTopN] = useState(20);
  const [showFilters, setShowFilters] = useState(true);

  // Derived options
  const allNats = useMemo(
    () => [...new Set(allPlayers.map((p) => p.nationality))].sort(),
    [allPlayers]
  );
  const allClubs = useMemo(
    () => [...new Set(allPlayers.map((p) => p.club))].sort(),
    [allPlayers]
  );
  const filteredNats = allNats.filter((n) =>
    n.toLowerCase().includes(natSearch.toLowerCase())
  );
  const filteredClubs = allClubs.filter((c) =>
    c.toLowerCase().includes(clubSearch.toLowerCase())
  );

  const togglePos = (pos: PositionGroup) =>
    setPositions((cur) =>
      cur.includes(pos) ? cur.filter((p) => p !== pos) : [...cur, pos]
    );

  const toggleNat = (nat: string) =>
    setSelectedNats((cur) =>
      cur.includes(nat) ? cur.filter((n) => n !== nat) : [...cur, nat]
    );

  const toggleClub = (club: string) =>
    setSelectedClubs((cur) =>
      cur.includes(club) ? cur.filter((c) => c !== club) : [...cur, club]
    );

  const resetFilters = () => {
    setPositions([]);
    setAgeMax(26);
    setMinRating(6.5);
    setSelectedNats([]);
    setSelectedClubs([]);
    setExcludeBig6(true);
    setSortKey("gemScore");
    setTopN(20);
  };

  // Apply filters + score + sort
  const gems = useMemo(() => {
    return allPlayers
      .filter((p) => {
        if (positions.length > 0 && !positions.includes(p.positionGroup)) return false;
        if (p.age > ageMax) return false;
        if (p.rating_merged < minRating) return false;
        if (selectedNats.length > 0 && !selectedNats.includes(p.nationality)) return false;
        if (selectedClubs.length > 0 && !selectedClubs.includes(p.club)) return false;
        if (excludeBig6 && TOP_CLUBS_BIG6.has(p.club)) return false;
        return true;
      })
      .map((p) => ({ ...p, gemScore: computeGemScore(p) }))
      .sort((a, b) => {
        if (sortKey === "gemScore") return (b.gemScore ?? 0) - (a.gemScore ?? 0);
        if (sortKey === "rating") return b.rating_merged - a.rating_merged;
        return a.age - b.age; // youngest first
      })
      .slice(0, topN);
  }, [allPlayers, positions, ageMax, minRating, selectedNats, selectedClubs, excludeBig6, sortKey, topN]);

  const activeFilterCount =
    positions.length +
    selectedNats.length +
    selectedClubs.length +
    (ageMax !== 26 ? 1 : 0) +
    (minRating !== 6.5 ? 1 : 0) +
    (!excludeBig6 ? 1 : 0);

  return (
    <div className="bg-[#161B22] border border-white/10 rounded-lg p-4 flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[#E6EDF3]">
            Hidden Gems Finder
          </h3>
          <p className="text-[11px] text-[#8B949E] mt-0.5">
            Score ponderado por posição · {gems.length} jogadores encontrados
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {activeFilterCount > 0 && (
            <button
              onClick={resetFilters}
              className="text-xs text-[#FF6B6B] hover:text-[#FF6B6B]/80 transition"
            >
              Clear filters ({activeFilterCount})
            </button>
          )}
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs border transition ${
              showFilters
                ? "bg-[#00C9A7]/10 border-[#00C9A7]/40 text-[#00C9A7]"
                : "border-white/10 text-[#8B949E] hover:border-[#00C9A7]/40"
            }`}
          >
            {showFilters ? "▲" : "▼"} Filters
            {activeFilterCount > 0 && (
              <span className="bg-[#00C9A7] text-[#0D1117] rounded-full w-4 h-4 text-[10px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-[#0D1117] border border-white/5 rounded-lg p-4 grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3">

          {/* Posição */}
          <div className="col-span-full md:col-span-3">
            <label className="text-[11px] text-[#8B949E] uppercase tracking-wider mb-2 block">
              Position
            </label>
            <div className="flex flex-wrap gap-1.5">
              {POSITION_GROUPS.map((pos) => {
                const active = positions.includes(pos);
                return (
                  <button
                    key={pos}
                    onClick={() => togglePos(pos)}
                    className="px-2.5 py-1 rounded text-xs font-medium border transition"
                    style={{
                      backgroundColor: active ? POSITION_COLORS[pos] : "transparent",
                      borderColor: POSITION_COLORS[pos],
                      color: active ? "#0D1117" : POSITION_COLORS[pos],
                    }}
                  >
                    {pos}
                  </button>
                );
              })}
              {positions.length > 0 && (
                <button
                  onClick={() => setPositions([])}
                  className="text-[10px] text-[#8B949E] hover:text-[#E6EDF3] ml-1"
                >
                  all
                </button>
              )}
            </div>
          </div>

          {/* Idade máxima */}
          <div>
            <label className="text-[11px] text-[#8B949E] uppercase tracking-wider mb-1 block">
              Max age: <span className="text-[#E6EDF3] font-semibold">{ageMax}</span>
            </label>
            <input
              type="range" min={18} max={32} value={ageMax}
              onChange={(e) => setAgeMax(Number(e.target.value))}
              className="w-full accent-[#00C9A7]"
            />
            <div className="flex justify-between text-[9px] text-[#8B949E] mt-0.5">
              <span>18</span><span>32</span>
            </div>
          </div>

          {/* Rating mínimo */}
          <div>
            <label className="text-[11px] text-[#8B949E] uppercase tracking-wider mb-1 block">
              Min rating: <span className="text-[#E6EDF3] font-semibold">{minRating.toFixed(1)}</span>
            </label>
            <input
              type="range" min={5.0} max={8.0} step={0.1} value={minRating}
              onChange={(e) => setMinRating(Number(e.target.value))}
              className="w-full accent-[#00C9A7]"
            />
            <div className="flex justify-between text-[9px] text-[#8B949E] mt-0.5">
              <span>5.0</span><span>8.0</span>
            </div>
          </div>

          {/* Top N + Ordenar */}
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-[11px] text-[#8B949E] uppercase tracking-wider mb-1.5 block">
                Sort by
              </label>
              <div className="flex gap-1">
                {([["gemScore", "Gem Score"], ["rating", "Rating"], ["age", "Youngest"]] as [SortKey, string][]).map(
                  ([k, lbl]) => (
                    <button
                      key={k}
                      onClick={() => setSortKey(k)}
                      className={`flex-1 py-1 rounded text-[10px] border transition ${
                        sortKey === k
                          ? "bg-[#00C9A7] border-[#00C9A7] text-[#0D1117] font-semibold"
                          : "border-white/10 text-[#8B949E] hover:border-[#00C9A7]"
                      }`}
                    >
                      {lbl}
                    </button>
                  )
                )}
              </div>
            </div>
            <div>
              <label className="text-[11px] text-[#8B949E] uppercase tracking-wider mb-1.5 block">
                Show top
              </label>
              <div className="flex gap-1">
                {[10, 20, 30, 50].map((n) => (
                  <button
                    key={n}
                    onClick={() => setTopN(n)}
                    className={`flex-1 py-1 rounded text-[10px] border transition ${
                      topN === n
                        ? "bg-[#00C9A7] border-[#00C9A7] text-[#0D1117] font-semibold"
                        : "border-white/10 text-[#8B949E] hover:border-[#00C9A7]"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Nacionalidade */}
          <div>
            <label className="text-[11px] text-[#8B949E] uppercase tracking-wider mb-1 block">
              Nationality {selectedNats.length > 0 && <span className="text-[#00C9A7]">({selectedNats.length})</span>}
            </label>
            <input
              className="w-full bg-[#161B22] border border-white/10 rounded px-2 py-1 text-[11px] placeholder-[#8B949E] focus:outline-none focus:border-[#00C9A7] mb-1"
              placeholder="Search country..."
              value={natSearch}
              onChange={(e) => setNatSearch(e.target.value)}
            />
            <div className="h-24 overflow-y-auto border border-white/5 rounded bg-[#161B22]">
              {filteredNats.slice(0, 60).map((nat) => (
                <button
                  key={nat}
                  onClick={() => toggleNat(nat)}
                  className={`w-full text-left px-2 py-0.5 text-[11px] transition ${
                    selectedNats.includes(nat)
                      ? "bg-[#00C9A7]/20 text-[#00C9A7]"
                      : "text-[#8B949E] hover:bg-white/5 hover:text-[#E6EDF3]"
                  }`}
                >
                  {nat.toUpperCase()}
                </button>
              ))}
            </div>
            {selectedNats.length > 0 && (
              <button onClick={() => setSelectedNats([])} className="text-[10px] text-[#8B949E] mt-1 hover:text-[#FF6B6B]">
                Clear
              </button>
            )}
          </div>

          {/* Clube */}
          <div>
            <label className="text-[11px] text-[#8B949E] uppercase tracking-wider mb-1 block">
              Club {selectedClubs.length > 0 && <span className="text-[#00C9A7]">({selectedClubs.length})</span>}
            </label>
            <input
              className="w-full bg-[#161B22] border border-white/10 rounded px-2 py-1 text-[11px] placeholder-[#8B949E] focus:outline-none focus:border-[#00C9A7] mb-1"
              placeholder="Search club..."
              value={clubSearch}
              onChange={(e) => setClubSearch(e.target.value)}
            />
            <div className="h-24 overflow-y-auto border border-white/5 rounded bg-[#161B22]">
              {filteredClubs.slice(0, 80).map((club) => (
                <button
                  key={club}
                  onClick={() => toggleClub(club)}
                  className={`w-full text-left px-2 py-0.5 text-[11px] transition truncate ${
                    selectedClubs.includes(club)
                      ? "bg-[#00C9A7]/20 text-[#00C9A7]"
                      : "text-[#8B949E] hover:bg-white/5 hover:text-[#E6EDF3]"
                  }`}
                >
                  {club}
                </button>
              ))}
            </div>
            {selectedClubs.length > 0 && (
              <button onClick={() => setSelectedClubs([])} className="text-[10px] text-[#8B949E] mt-1 hover:text-[#FF6B6B]">
                Clear
              </button>
            )}
          </div>

          {/* Excluir Big 6 */}
          <div className="col-span-full flex items-center gap-3">
            <button
              onClick={() => setExcludeBig6((v) => !v)}
              className={`w-10 h-5 rounded-full relative transition ${excludeBig6 ? "bg-[#00C9A7]" : "bg-white/10"}`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                  excludeBig6 ? "left-5" : "left-0.5"
                }`}
              />
            </button>
            <span className="text-xs text-[#8B949E]">
              Exclude Big 6 clubs (Real Madrid, Man City, Bayern…)
            </span>
          </div>
        </div>
      )}

      {/* Score formula note */}
      <div className="text-[10px] text-[#8B949E] bg-[#0D1117] rounded px-3 py-1.5 border border-white/5">
        Score = Rating(35%) + xG%(var.) + Key Passes%(var.) + Tackles%(var.) + Pass%(var.) + Dribbles%(var.) — weights vary by position
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2 max-h-[640px] overflow-y-auto pr-1">
        {gems.map((p, i) => (
          <GemCard key={`${p.name}__${p.club}`} player={p} rank={i + 1} />
        ))}
        {gems.length === 0 && (
          <div className="text-center text-[#8B949E] text-sm py-12">
            No players found with these filters.
            <br />
            <button onClick={resetFilters} className="text-[#00C9A7] text-xs mt-2 hover:underline">
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
