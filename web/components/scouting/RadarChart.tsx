"use client";

import { useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import type { Player } from "@/lib/scouting/types";
import { POSITION_COLORS } from "@/lib/scouting/types";
import { useFilterStore } from "@/lib/scouting/filterStore";

const AXES = [
  { key: "goals_p90_pct_merged", label: "Attack" },
  { key: "key_passes_p90_pct_merged", label: "Chance Creation" },
  { key: "pass_success_pct_pct_merged", label: "Passing Quality" },
  { key: "tackles_p90_pct_merged", label: "Defensive Work" },
  { key: "interceptions_p90_pct_merged", label: "Ball Winning" },
  { key: "aerial_won_p90_pct_merged", label: "Physical Duels" },
  { key: "dribbles_won_p90_pct_merged", label: "Dribbling" },
] as const;

type AxisKey = (typeof AXES)[number]["key"];

const RADAR_COLORS = ["#00C9A7", "#FFD54F", "#FF7043"];

interface RadarChartProps {
  allPlayers: Player[];
}

export function RadarChart({ allPlayers }: RadarChartProps) {
  const { comparisonPlayers, addComparisonPlayer, removeComparisonPlayer, clearComparison } =
    useFilterStore();
  const [search1, setSearch1] = useState("");
  const [search2, setSearch2] = useState("");
  const [search3, setSearch3] = useState("");

  const searches = [search1, search2, search3];
  const setSearches = [setSearch1, setSearch2, setSearch3];

  const hits = searches.map((s) =>
    s.trim().length >= 2
      ? allPlayers.filter((p) => p.name.toLowerCase().includes(s.toLowerCase())).slice(0, 6)
      : []
  );

  const option = useMemo(() => {
    if (comparisonPlayers.length === 0)
      return { backgroundColor: "transparent", radar: { indicator: AXES.map((a) => ({ name: a.label, max: 100 })) } };

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        backgroundColor: "#161B22",
        borderColor: "#30363D",
        textStyle: { color: "#E6EDF3", fontSize: 11 },
      },
      legend: {
        data: comparisonPlayers.map((p) => p.name),
        bottom: 0,
        textStyle: { color: "#8B949E", fontSize: 11 },
      },
      radar: {
        indicator: AXES.map((a) => ({ name: a.label, max: 100 })),
        shape: "polygon",
        splitNumber: 4,
        axisName: { color: "#8B949E", fontSize: 11 },
        splitLine: { lineStyle: { color: "#21262D" } },
        splitArea: { areaStyle: { color: ["#0D1117", "#161B22"] } },
        axisLine: { lineStyle: { color: "#30363D" } },
      },
      series: [
        {
          type: "radar",
          data: comparisonPlayers.map((p, i) => ({
            name: p.name,
            value: AXES.map((a) => +(p[a.key as AxisKey] * 100).toFixed(1)),
            lineStyle: { color: RADAR_COLORS[i], width: 2 },
            areaStyle: { color: RADAR_COLORS[i], opacity: 0.15 },
            itemStyle: { color: RADAR_COLORS[i] },
          })),
        },
      ],
    };
  }, [comparisonPlayers]);

  return (
    <div className="bg-[#161B22] border border-white/10 rounded-lg p-4 flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#E6EDF3]">Player Comparison Radar</h3>
        {comparisonPlayers.length > 0 && (
          <button
            onClick={clearComparison}
            className="text-xs text-[#8B949E] hover:text-[#FF6B6B] transition"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Player selectors */}
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="relative">
            <div className="flex items-center gap-1 mb-1">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: RADAR_COLORS[i] }}
              />
              <span className="text-[10px] text-[#8B949E]">Player {i + 1}</span>
              {comparisonPlayers[i] && (
                <button
                  onClick={() => removeComparisonPlayer(comparisonPlayers[i].name)}
                  className="ml-auto text-[10px] text-[#8B949E] hover:text-[#FF6B6B]"
                >
                  ×
                </button>
              )}
            </div>
            {comparisonPlayers[i] ? (
              <div
                className="text-xs text-[#E6EDF3] bg-[#0D1117] border border-white/10 rounded px-2 py-1 truncate"
                style={{ borderColor: RADAR_COLORS[i] + "80" }}
              >
                {comparisonPlayers[i].name}
                <span className="text-[#8B949E] ml-1">
                  · {comparisonPlayers[i].club.slice(0, 12)}
                </span>
              </div>
            ) : (
              <div className="relative">
                <input
                  className="w-full bg-[#0D1117] border border-white/10 rounded px-2 py-1 text-xs placeholder-[#8B949E] focus:outline-none focus:border-[#00C9A7]"
                  placeholder="Search player…"
                  value={searches[i]}
                  onChange={(e) => setSearches[i](e.target.value)}
                />
                {hits[i].length > 0 && (
                  <div className="absolute z-20 top-full left-0 right-0 bg-[#161B22] border border-white/10 rounded mt-0.5 max-h-32 overflow-y-auto">
                    {hits[i].map((p) => (
                      <button
                        key={`${p.name}__${p.club}`}
                        className="w-full text-left px-2 py-1 text-xs hover:bg-white/5 text-[#E6EDF3]"
                        onClick={() => {
                          addComparisonPlayer(p);
                          setSearches[i]("");
                        }}
                      >
                        {p.name}
                        <span className="text-[#8B949E] ml-1">· {p.club}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {comparisonPlayers.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-[#8B949E] text-sm">
          Search and add players above to compare
        </div>
      ) : (
        <ReactECharts option={option} style={{ height: 340 }} />
      )}

      {/* Mini comparison table */}
      {comparisonPlayers.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-[10px] text-[#8B949E]">
            <thead>
              <tr>
                <th className="text-left py-1">Metric</th>
                {comparisonPlayers.map((p, i) => (
                  <th key={p.name} className="text-right py-1" style={{ color: RADAR_COLORS[i] }}>
                    {p.name.split(" ").pop()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {AXES.map((a) => (
                <tr key={a.key} className="border-t border-white/5">
                  <td className="py-0.5">{a.label}</td>
                  {comparisonPlayers.map((p) => (
                    <td key={p.name} className="text-right text-[#E6EDF3]">
                      {(p[a.key as AxisKey] * 100).toFixed(0)}
                      <span className="text-[#8B949E]">%</span>
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t border-white/10">
                <td className="py-0.5 font-semibold text-[#E6EDF3]">Rating</td>
                {comparisonPlayers.map((p) => (
                  <td key={p.name} className="text-right font-semibold text-[#00C9A7]">
                    {p.rating_merged.toFixed(2)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
