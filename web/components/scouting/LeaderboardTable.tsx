"use client";

import { useMemo, useState } from "react";
import type { Player, MetricKey } from "@/lib/scouting/types";
import { POSITION_COLORS } from "@/lib/scouting/types";
import { useFilterStore } from "@/lib/scouting/filterStore";

const PAGE_SIZE = 25;

type SortDir = "asc" | "desc";

const COLS: { key: MetricKey | "name" | "age" | "club" | "positionGroup"; label: string; fmt?: (v: number) => string }[] = [
  { key: "name", label: "Player" },
  { key: "age", label: "Age" },
  { key: "club", label: "Club" },
  { key: "positionGroup", label: "Pos" },
  { key: "rating_merged", label: "Rating", fmt: (v) => v.toFixed(2) },
  { key: "goals_p90_merged", label: "G/90", fmt: (v) => v.toFixed(2) },
  { key: "xg_per_90_merged", label: "xG/90", fmt: (v) => v.toFixed(2) },
  { key: "key_passes_p90_merged", label: "KP/90", fmt: (v) => v.toFixed(2) },
  { key: "tackles_p90_merged", label: "Tkl/90", fmt: (v) => v.toFixed(2) },
  { key: "pass_success_pct_merged", label: "Pass%", fmt: (v) => v.toFixed(1) },
  { key: "dribbles_won_p90_merged", label: "Drb/90", fmt: (v) => v.toFixed(2) },
  { key: "aerial_won_p90_merged", label: "Aer/90", fmt: (v) => v.toFixed(2) },
];

// Get min/max for heatmap coloring per numeric column
function useColBounds(players: Player[]) {
  return useMemo(() => {
    const bounds: Partial<Record<string, [number, number]>> = {};
    COLS.filter((c) => c.fmt).forEach(({ key }) => {
      const vals = players.map((p) => p[key as MetricKey] as number);
      bounds[key] = [Math.min(...vals), Math.max(...vals)];
    });
    return bounds;
  }, [players]);
}

function heatColor(val: number, min: number, max: number): string {
  if (max === min) return "transparent";
  const ratio = (val - min) / (max - min);
  const r = Math.round(255 * (1 - ratio) * 0.5 + 107 * ratio);
  const g = Math.round(107 * (1 - ratio) + 201 * ratio);
  const b = Math.round(107 * (1 - ratio) * 0.5 + 167 * ratio);
  return `rgba(${r},${g},${b},0.18)`;
}

interface LeaderboardTableProps {
  players: Player[];
}

export function LeaderboardTable({ players }: LeaderboardTableProps) {
  const { openDetail, addToShortlist, shortlist } = useFilterStore();
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<string>("rating_merged");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [tableSearch, setTableSearch] = useState("");

  const bounds = useColBounds(players);

  const filtered = useMemo(() => {
    const q = tableSearch.toLowerCase();
    return q
      ? players.filter((p) => p.name.toLowerCase().includes(q) || p.club.toLowerCase().includes(q))
      : players;
  }, [players, tableSearch]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey as keyof Player] as string | number;
      const bv = b[sortKey as keyof Player] as string | number;
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [filtered, sortKey, sortDir]);

  const pageData = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const exportCSV = () => {
    const headers = COLS.map((c) => c.label).join(",");
    const rows = sorted.map((p) =>
      COLS.map((c) => {
        const v = p[c.key as keyof Player];
        return typeof v === "string" ? `"${v}"` : v;
      }).join(",")
    );
    const blob = new Blob([[headers, ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "scouting-export.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-[#161B22] border border-white/10 rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-[#E6EDF3]">
          Leaderboard
          <span className="ml-2 text-[11px] text-[#8B949E] font-normal">{sorted.length} players</span>
        </h3>
        <div className="flex gap-2">
          <input
            className="bg-[#0D1117] border border-white/10 rounded px-2 py-1 text-xs placeholder-[#8B949E] focus:outline-none focus:border-[#00C9A7] w-40"
            placeholder="Search in table…"
            value={tableSearch}
            onChange={(e) => { setTableSearch(e.target.value); setPage(0); }}
          />
          <button
            onClick={exportCSV}
            className="px-3 py-1 rounded text-xs bg-[#0D1117] border border-white/10 text-[#8B949E] hover:border-[#00C9A7] hover:text-[#00C9A7] transition"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-[#E6EDF3]">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left py-1.5 text-[#8B949E] w-6">#</th>
              {COLS.map((c) => (
                <th
                  key={c.key}
                  className="text-left py-1.5 px-1 text-[#8B949E] cursor-pointer hover:text-[#00C9A7] select-none whitespace-nowrap"
                  onClick={() => handleSort(c.key)}
                >
                  {c.label}
                  {sortKey === c.key && (
                    <span className="ml-0.5">{sortDir === "asc" ? "↑" : "↓"}</span>
                  )}
                </th>
              ))}
              <th className="text-left py-1.5 px-1 text-[#8B949E]">Action</th>
            </tr>
          </thead>
          <tbody>
            {pageData.map((p, i) => {
              const rank = page * PAGE_SIZE + i + 1;
              const isShortlisted = shortlist.some((s) => s.name === p.name);
              return (
                <tr
                  key={p.name}
                  className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition"
                  onClick={() => openDetail(p)}
                >
                  <td className="py-1 text-[#8B949E]">{rank}</td>
                  {COLS.map((c) => {
                    const raw = p[c.key as keyof Player];
                    const isNum = c.fmt && typeof raw === "number";
                    const bg = isNum && bounds[c.key]
                      ? heatColor(raw as number, bounds[c.key]![0], bounds[c.key]![1])
                      : "transparent";
                    return (
                      <td
                        key={c.key}
                        className="py-1 px-1 whitespace-nowrap"
                        style={{ backgroundColor: bg }}
                      >
                        {c.key === "positionGroup" ? (
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                            style={{
                              backgroundColor: POSITION_COLORS[p.positionGroup] + "30",
                              color: POSITION_COLORS[p.positionGroup],
                            }}
                          >
                            {p.positionGroup}
                          </span>
                        ) : c.fmt && typeof raw === "number" ? (
                          c.fmt(raw)
                        ) : (
                          <span className="truncate max-w-[120px] block" title={String(raw)}>
                            {String(raw)}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className="py-1 px-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => addToShortlist(p)}
                      disabled={isShortlisted}
                      className={`px-2 py-0.5 rounded text-[10px] border transition ${
                        isShortlisted
                          ? "border-[#00C9A7] text-[#00C9A7] opacity-50 cursor-default"
                          : "border-white/10 text-[#8B949E] hover:border-[#00C9A7] hover:text-[#00C9A7]"
                      }`}
                    >
                      {isShortlisted ? "✓" : "+"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[#8B949E]">
          Page {page + 1} of {totalPages} · {sorted.length} results
        </span>
        <div className="flex gap-1">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="px-2 py-0.5 rounded text-xs border border-white/10 text-[#8B949E] hover:border-[#00C9A7] disabled:opacity-30"
          >
            ←
          </button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, k) => {
            const start = Math.max(0, Math.min(page - 2, totalPages - 5));
            const pg = start + k;
            return (
              <button
                key={pg}
                onClick={() => setPage(pg)}
                className={`px-2 py-0.5 rounded text-xs border transition ${
                  pg === page
                    ? "bg-[#00C9A7] border-[#00C9A7] text-[#0D1117]"
                    : "border-white/10 text-[#8B949E] hover:border-[#00C9A7]"
                }`}
              >
                {pg + 1}
              </button>
            );
          })}
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="px-2 py-0.5 rounded text-xs border border-white/10 text-[#8B949E] hover:border-[#00C9A7] disabled:opacity-30"
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}
