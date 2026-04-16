"use client";

import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { Player } from "@/lib/scouting/types";
import { POSITION_COLORS } from "@/lib/scouting/types";
import { useFilterStore } from "@/lib/scouting/filterStore";

const PCT_METRICS: { key: keyof Player; label: string }[] = [
  { key: "goals_p90_pct_merged", label: "Goals/90" },
  { key: "assists_p90_pct_merged", label: "Assists/90" },
  { key: "xg_per_90_pct_merged", label: "xG/90" },
  { key: "key_passes_p90_pct_merged", label: "Key Passes" },
  { key: "tackles_p90_pct_merged", label: "Tackles" },
  { key: "interceptions_p90_pct_merged", label: "Interceptions" },
  { key: "pass_success_pct_pct_merged", label: "Pass%" },
  { key: "dribbles_won_p90_pct_merged", label: "Dribbles" },
  { key: "aerial_won_p90_pct_merged", label: "Aerials" },
];

const RAW_METRICS: { key: keyof Player; label: string; fmt: (v: number) => string }[] = [
  { key: "goals_p90_merged", label: "Goals/90", fmt: (v) => v.toFixed(2) },
  { key: "assists_p90_merged", label: "Assists/90", fmt: (v) => v.toFixed(2) },
  { key: "xg_per_90_merged", label: "xG/90", fmt: (v) => v.toFixed(2) },
  { key: "key_passes_p90_merged", label: "Key Passes/90", fmt: (v) => v.toFixed(2) },
  { key: "tackles_p90_merged", label: "Tackles/90", fmt: (v) => v.toFixed(2) },
  { key: "interceptions_p90_merged", label: "Interceptions/90", fmt: (v) => v.toFixed(2) },
  { key: "passes_p90_merged", label: "Passes/90", fmt: (v) => v.toFixed(1) },
  { key: "pass_success_pct_merged", label: "Pass Success%", fmt: (v) => v.toFixed(1) + "%" },
  { key: "dribbles_won_p90_merged", label: "Dribbles Won/90", fmt: (v) => v.toFixed(2) },
  { key: "aerial_won_p90_merged", label: "Aerials Won/90", fmt: (v) => v.toFixed(2) },
  { key: "shots_p90_merged", label: "Shots/90", fmt: (v) => v.toFixed(2) },
  { key: "accurate_crosses_p90_merged", label: "Crosses/90", fmt: (v) => v.toFixed(2) },
  { key: "blocks_p90_merged", label: "Blocks/90", fmt: (v) => v.toFixed(2) },
];

interface PlayerDetailPanelProps {
  player: Player;
}

export function PlayerDetailPanel({ player }: PlayerDetailPanelProps) {
  const { closeDetail, addComparisonPlayer, addToShortlist, shortlist } = useFilterStore();

  const isShortlisted = shortlist.some((s) => s.name === player.name);

  const { topStrength, mainWeakness } = useMemo(() => {
    const sorted = [...PCT_METRICS].sort(
      (a, b) => (player[b.key] as number) - (player[a.key] as number)
    );
    const top = sorted[0];
    const weak = sorted[sorted.length - 1];
    const topPct = Math.round((1 - (player[top.key] as number)) * 100);
    const weakPct = Math.round((player[weak.key] as number) * 100);
    return {
      topStrength: `TOP STRENGTH: ${top.label} — Top ${topPct}% of all outfield players`,
      mainWeakness: `MAIN WEAKNESS: ${weak.label} — ${weakPct}th percentile`,
    };
  }, [player]);

  const overallPct = useMemo(() => {
    const avg = PCT_METRICS.reduce((s, m) => s + (player[m.key] as number), 0) / PCT_METRICS.length;
    return Math.round(avg * 100);
  }, [player]);

  const gaugeOption = useMemo(() => ({
    backgroundColor: "transparent",
    series: [
      {
        type: "gauge",
        radius: "90%",
        startAngle: 210,
        endAngle: -30,
        min: 0,
        max: 100,
        axisLine: {
          lineStyle: {
            width: 12,
            color: [
              [0.3, "#FF6B6B"],
              [0.6, "#FFD54F"],
              [0.8, "#00C9A7"],
              [1, "#4FC3F7"],
            ],
          },
        },
        pointer: { itemStyle: { color: "#E6EDF3" }, length: "60%", width: 5 },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        detail: {
          formatter: `{value}`,
          fontSize: 22,
          fontWeight: "bold",
          color: "#E6EDF3",
          offsetCenter: [0, "40%"],
        },
        data: [{ value: overallPct }],
      },
    ],
  }), [overallPct]);

  const barOption = useMemo(() => ({
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      backgroundColor: "#161B22",
      textStyle: { color: "#E6EDF3", fontSize: 10 },
    },
    grid: { left: 8, right: 24, top: 4, bottom: 4, containLabel: true },
    xAxis: { type: "value", max: 1, axisLabel: { show: false }, splitLine: { show: false }, axisLine: { show: false } },
    yAxis: {
      type: "category",
      data: PCT_METRICS.map((m) => m.label),
      inverse: true,
      axisLabel: { color: "#8B949E", fontSize: 10 },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    series: [
      {
        type: "bar",
        data: PCT_METRICS.map((m) => ({
          value: +(player[m.key] as number).toFixed(3),
          itemStyle: {
            color: (player[m.key] as number) >= 0.75
              ? "#00C9A7"
              : (player[m.key] as number) >= 0.5
              ? "#FFD54F"
              : "#FF6B6B",
            borderRadius: [0, 3, 3, 0],
          },
        })),
        label: {
          show: true,
          position: "right",
          formatter: (p: { value: number }) => `${Math.round(p.value * 100)}%`,
          fontSize: 9,
          color: "#8B949E",
        },
        barMaxWidth: 12,
        background: { show: true, itemStyle: { color: "#0D1117" } },
      },
    ],
  }), [player]);

  const posColor = POSITION_COLORS[player.positionGroup];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end pointer-events-none">
      <div
        className="h-full w-[420px] bg-[#0D1117] border-l border-white/10 flex flex-col overflow-y-auto pointer-events-auto shadow-2xl"
        style={{ maxHeight: "100dvh" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-white/10 sticky top-0 bg-[#0D1117] z-10">
          <div>
            <h2 className="text-lg font-bold text-[#E6EDF3]">{player.name}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] text-[#8B949E]">{player.club}</span>
              <span className="text-[#8B949E]">·</span>
              <span className="text-[11px] text-[#8B949E]">Age {player.age}</span>
              <span className="text-[#8B949E]">·</span>
              <span className="text-[11px] text-[#8B949E] uppercase">{player.nationality}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="px-2 py-0.5 rounded text-sm font-bold"
              style={{ backgroundColor: posColor + "25", color: posColor }}
            >
              {player.positionGroup}
            </div>
            <div className="bg-[#00C9A7]/20 text-[#00C9A7] px-2 py-0.5 rounded text-sm font-bold">
              {player.rating_merged.toFixed(2)}
            </div>
            <button
              onClick={closeDetail}
              className="text-[#8B949E] hover:text-[#E6EDF3] text-lg leading-none ml-1"
            >
              ×
            </button>
          </div>
        </div>

        {/* Percentile wheel */}
        <div className="px-4 pt-3 pb-0">
          <h3 className="text-xs text-[#8B949E] uppercase tracking-widest mb-1">Overall Percentile</h3>
          <ReactECharts option={gaugeOption} style={{ height: 140 }} />
        </div>

        {/* Strengths / Weaknesses */}
        <div className="px-4 py-2 flex flex-col gap-1.5">
          <div className="bg-[#00C9A7]/10 border border-[#00C9A7]/30 rounded px-3 py-2 text-[11px] text-[#00C9A7]">
            ↑ {topStrength}
          </div>
          <div className="bg-[#FF6B6B]/10 border border-[#FF6B6B]/30 rounded px-3 py-2 text-[11px] text-[#FF6B6B]">
            ↓ {mainWeakness}
          </div>
        </div>

        {/* Percentile bars */}
        <div className="px-4 pb-2">
          <h3 className="text-xs text-[#8B949E] uppercase tracking-widest mb-1">Percentile Ranks</h3>
          <ReactECharts option={barOption} style={{ height: 200 }} />
        </div>

        {/* Raw stats */}
        <div className="px-4 pb-2">
          <h3 className="text-xs text-[#8B949E] uppercase tracking-widest mb-2">Raw Stats per 90</h3>
          <div className="grid grid-cols-2 gap-1">
            {RAW_METRICS.map((m) => (
              <div
                key={m.key}
                className="bg-[#161B22] rounded px-2 py-1.5 flex justify-between items-center"
              >
                <span className="text-[10px] text-[#8B949E]">{m.label}</span>
                <span className="text-[11px] font-semibold text-[#E6EDF3]">
                  {m.fmt(player[m.key] as number)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="px-4 pb-4 pt-2 flex gap-2 mt-auto">
          <button
            onClick={() => { addComparisonPlayer(player); closeDetail(); }}
            className="flex-1 py-2 rounded text-xs font-medium bg-[#00C9A7]/10 border border-[#00C9A7]/50 text-[#00C9A7] hover:bg-[#00C9A7]/20 transition"
          >
            + Compare Radar
          </button>
          <button
            onClick={() => addToShortlist(player)}
            disabled={isShortlisted}
            className={`flex-1 py-2 rounded text-xs font-medium border transition ${
              isShortlisted
                ? "border-white/10 text-[#8B949E] cursor-default"
                : "bg-[#FFD54F]/10 border-[#FFD54F]/50 text-[#FFD54F] hover:bg-[#FFD54F]/20"
            }`}
          >
            {isShortlisted ? "✓ Shortlisted" : "★ Add to Shortlist"}
          </button>
        </div>
      </div>
    </div>
  );
}
