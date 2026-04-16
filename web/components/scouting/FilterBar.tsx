"use client";

import { useMemo } from "react";
import type { Player, PositionGroup } from "@/lib/scouting/types";
import { POSITION_GROUPS, POSITION_COLORS, METRIC_OPTIONS } from "@/lib/scouting/types";
import { useFilterStore } from "@/lib/scouting/filterStore";

interface FilterBarProps {
  allPlayers: Player[];
}

export function FilterBar({ allPlayers }: FilterBarProps) {
  const store = useFilterStore();

  const allNationalities = useMemo(
    () => [...new Set(allPlayers.map((p) => p.nationality))].sort(),
    [allPlayers]
  );
  const allClubs = useMemo(
    () => [...new Set(allPlayers.map((p) => p.club))].sort(),
    [allPlayers]
  );

  const togglePosition = (pos: PositionGroup) => {
    const cur = store.positionGroups;
    if (cur.includes(pos)) {
      store.setPositionGroups(cur.filter((p) => p !== pos));
    } else {
      store.setPositionGroups([...cur, pos]);
    }
  };

  return (
    <aside className="w-64 shrink-0 bg-[#161B22] border-r border-white/10 flex flex-col gap-4 p-4 overflow-y-auto text-[#E6EDF3]">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#00C9A7] uppercase tracking-widest">Filters</h2>
        <button
          onClick={store.resetFilters}
          className="text-xs text-[#8B949E] hover:text-[#E6EDF3] transition"
        >
          Reset All
        </button>
      </div>

      {/* Player Search */}
      <div>
        <label className="text-xs text-[#8B949E] mb-1 block">Player Search</label>
        <input
          className="w-full bg-[#0D1117] border border-white/10 rounded px-2 py-1.5 text-sm placeholder-[#8B949E] focus:outline-none focus:border-[#00C9A7]"
          placeholder="Search player..."
          value={store.playerSearch}
          onChange={(e) => store.setPlayerSearch(e.target.value)}
        />
      </div>

      {/* Position Groups */}
      <div>
        <label className="text-xs text-[#8B949E] mb-2 block">Position Group</label>
        <div className="flex flex-wrap gap-1.5">
          {POSITION_GROUPS.map((pos) => {
            const active = store.positionGroups.includes(pos);
            return (
              <button
                key={pos}
                onClick={() => togglePosition(pos)}
                className="px-2 py-0.5 rounded text-xs font-medium transition border"
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
        </div>
        {store.positionGroups.length > 0 && (
          <button
            onClick={() => store.setPositionGroups([])}
            className="text-xs text-[#8B949E] mt-1 hover:text-[#E6EDF3]"
          >
            Clear selection (show all)
          </button>
        )}
      </div>

      {/* Age Range */}
      <div>
        <label className="text-xs text-[#8B949E] mb-1 block">
          Age Range: {store.ageMin} – {store.ageMax}
        </label>
        <div className="flex gap-2 items-center">
          <input
            type="range"
            min={16}
            max={40}
            value={store.ageMin}
            onChange={(e) => store.setAgeMin(Math.min(Number(e.target.value), store.ageMax - 1))}
            className="w-full accent-[#00C9A7]"
          />
          <input
            type="range"
            min={16}
            max={40}
            value={store.ageMax}
            onChange={(e) => store.setAgeMax(Math.max(Number(e.target.value), store.ageMin + 1))}
            className="w-full accent-[#00C9A7]"
          />
        </div>
        <div className="flex justify-between text-[10px] text-[#8B949E] mt-0.5">
          <span>16</span><span>40</span>
        </div>
      </div>

      {/* Min Rating */}
      <div>
        <label className="text-xs text-[#8B949E] mb-1 block">
          Min Rating: {store.minRating.toFixed(1)}
        </label>
        <input
          type="range"
          min={5.0}
          max={8.5}
          step={0.1}
          value={store.minRating}
          onChange={(e) => store.setMinRating(Number(e.target.value))}
          className="w-full accent-[#00C9A7]"
        />
        <div className="flex justify-between text-[10px] text-[#8B949E] mt-0.5">
          <span>5.0</span><span>8.5</span>
        </div>
      </div>

      {/* Nationality */}
      <div>
        <label className="text-xs text-[#8B949E] mb-1 block">
          Nationality {store.nationalities.length > 0 && `(${store.nationalities.length})`}
        </label>
        <select
          multiple
          className="w-full bg-[#0D1117] border border-white/10 rounded text-xs text-[#E6EDF3] h-24 px-1 focus:outline-none focus:border-[#00C9A7]"
          value={store.nationalities}
          onChange={(e) => {
            const vals = Array.from(e.target.selectedOptions).map((o) => o.value);
            store.setNationalities(vals);
          }}
        >
          {allNationalities.map((n) => (
            <option key={n} value={n} className="py-0.5">
              {n.toUpperCase()}
            </option>
          ))}
        </select>
        {store.nationalities.length > 0 && (
          <button
            onClick={() => store.setNationalities([])}
            className="text-xs text-[#8B949E] mt-1 hover:text-[#E6EDF3]"
          >
            Clear
          </button>
        )}
      </div>

      {/* Metric X / Y */}
      <div>
        <label className="text-xs text-[#8B949E] mb-1 block">Scatter X Axis</label>
        <select
          className="w-full bg-[#0D1117] border border-white/10 rounded text-xs px-2 py-1.5 focus:outline-none focus:border-[#00C9A7]"
          value={store.metricX}
          onChange={(e) => store.setMetricX(e.target.value as typeof store.metricX)}
        >
          {METRIC_OPTIONS.map((m) => (
            <option key={m.key} value={m.key}>{m.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs text-[#8B949E] mb-1 block">Scatter Y Axis</label>
        <select
          className="w-full bg-[#0D1117] border border-white/10 rounded text-xs px-2 py-1.5 focus:outline-none focus:border-[#00C9A7]"
          value={store.metricY}
          onChange={(e) => store.setMetricY(e.target.value as typeof store.metricY)}
        >
          {METRIC_OPTIONS.map((m) => (
            <option key={m.key} value={m.key}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* Top N */}
      <div>
        <label className="text-xs text-[#8B949E] mb-1 block">Top N Players: {store.topN}</label>
        <div className="flex gap-2">
          {[10, 15, 20, 30].map((n) => (
            <button
              key={n}
              onClick={() => store.setTopN(n)}
              className={`flex-1 py-0.5 rounded text-xs border transition ${
                store.topN === n
                  ? "bg-[#00C9A7] border-[#00C9A7] text-[#0D1117]"
                  : "border-white/10 text-[#8B949E] hover:border-[#00C9A7]"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
