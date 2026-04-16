"use client";

import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { Player } from "@/lib/scouting/types";
import { POSITION_GROUPS } from "@/lib/scouting/types";

// Primary metric per position group
const POSITION_METRIC: Record<string, { key: keyof Player; label: string }> = {
  CB: { key: "interceptions_p90_merged", label: "Interceptions/90" },
  FB: { key: "accurate_crosses_p90_merged", label: "Crosses/90" },
  DM: { key: "tackles_p90_merged", label: "Tackles/90" },
  CM: { key: "passes_p90_merged", label: "Passes/90" },
  Winger: { key: "dribbles_won_p90_merged", label: "Dribbles Won/90" },
  AM: { key: "key_passes_p90_merged", label: "Key Passes/90" },
  FW: { key: "goals_p90_merged", label: "Goals/90" },
};

interface HeatmapChartProps {
  allPlayers: Player[];
}

export function HeatmapChart({ allPlayers }: HeatmapChartProps) {
  // Derive clubs/leagues axis (top 20 by player count)
  const { topClubs, heatData, maxVal } = useMemo(() => {
    const clubCounts = new Map<string, number>();
    allPlayers.forEach((p) => clubCounts.set(p.club, (clubCounts.get(p.club) ?? 0) + 1));
    const topClubs = [...clubCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([c]) => c);

    // Build heat data: [clubIdx, posIdx, avgVal]
    const data: [number, number, number][] = [];
    let maxVal = 0;

    topClubs.forEach((club, ci) => {
      POSITION_GROUPS.forEach((pos, pi) => {
        const metric = POSITION_METRIC[pos];
        const group = allPlayers.filter(
          (p) => p.club === club && p.positionGroup === pos
        );
        if (group.length === 0) { data.push([ci, pi, 0]); return; }
        const avg = group.reduce((s, p) => s + (p[metric.key] as number), 0) / group.length;
        data.push([ci, pi, +avg.toFixed(3)]);
        if (avg > maxVal) maxVal = avg;
      });
    });

    return { topClubs, heatData: data, maxVal };
  }, [allPlayers]);

  const option = useMemo(() => ({
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
      backgroundColor: "#161B22",
      borderColor: "#30363D",
      textStyle: { color: "#E6EDF3", fontSize: 11 },
      formatter: (params: { data: [number, number, number] }) => {
        const [ci, pi, val] = params.data;
        const pos = POSITION_GROUPS[pi];
        return `${topClubs[ci]}<br/>${pos}: ${POSITION_METRIC[pos].label}<br/>Avg: <b>${val}</b>`;
      },
    },
    grid: { left: 100, right: 16, top: 8, bottom: 60, containLabel: false },
    xAxis: {
      type: "category",
      data: POSITION_GROUPS,
      axisLabel: { color: "#8B949E", fontSize: 11 },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: "#30363D" } },
    },
    yAxis: {
      type: "category",
      data: topClubs,
      axisLabel: { color: "#E6EDF3", fontSize: 10 },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: "#30363D" } },
    },
    visualMap: {
      min: 0,
      max: maxVal || 1,
      calculable: true,
      orient: "horizontal",
      bottom: 0,
      left: "center",
      inRange: { color: ["#0D1117", "#00C9A7"] },
      textStyle: { color: "#8B949E", fontSize: 10 },
    },
    series: [
      {
        type: "heatmap",
        data: heatData,
        label: {
          show: true,
          formatter: (p: { data: [number, number, number] }) =>
            p.data[2] > 0 ? p.data[2].toFixed(1) : "",
          fontSize: 9,
          color: "#E6EDF3",
        },
        emphasis: { itemStyle: { shadowBlur: 6, shadowColor: "#00C9A7" } },
      },
    ],
  }), [topClubs, heatData, maxVal]);

  return (
    <div className="bg-[#161B22] border border-white/10 rounded-lg p-4 flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-[#E6EDF3]">
        League Talent Map
        <span className="ml-2 text-[11px] text-[#8B949E] font-normal">
          Avg key metric by club × position
        </span>
      </h3>
      <ReactECharts option={option} style={{ height: 420 }} />
    </div>
  );
}
