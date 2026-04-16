"use client";

import { useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import type { Player } from "@/lib/scouting/types";
import { POSITION_COLORS, POSITION_GROUPS } from "@/lib/scouting/types";
import { useFilterStore } from "@/lib/scouting/filterStore";

interface AgeTalentCurveProps {
  players: Player[];
}

export function AgeTalentCurve({ players }: AgeTalentCurveProps) {
  const { openDetail } = useFilterStore();
  const [showGems, setShowGems] = useState(false);

  const option = useMemo(() => {
    // Group by position for scatter series
    const byPos = new Map<string, Player[]>();
    players.forEach((p) => {
      if (!byPos.has(p.positionGroup)) byPos.set(p.positionGroup, []);
      byPos.get(p.positionGroup)!.push(p);
    });

    const regularSeries = POSITION_GROUPS.filter((pg) => byPos.has(pg)).map((pg) => ({
      name: pg,
      type: "scatter",
      symbolSize: (d: number[]) => Math.max(4, Math.min(16, d[2] * 3)),
      itemStyle: { color: POSITION_COLORS[pg], opacity: 0.6 },
      data: byPos.get(pg)!.map((p) => [
        p.age,
        +p.rating_merged.toFixed(3),
        +p.xg_per_90_merged.toFixed(3),
        p.name,
        p.club,
        p.positionGroup,
      ]),
    }));

    // Trend line (LOESS approximation via age-bucketed averages)
    const ageBuckets = new Map<number, number[]>();
    players.forEach((p) => {
      if (!ageBuckets.has(p.age)) ageBuckets.set(p.age, []);
      ageBuckets.get(p.age)!.push(p.rating_merged);
    });
    const trendData = [...ageBuckets.entries()]
      .sort((a, b) => a[0] - b[0])
      .filter(([, vals]) => vals.length >= 2)
      .map(([age, vals]) => [age, +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(3)]);

    const trendSeries = {
      name: "Trend",
      type: "line",
      data: trendData,
      smooth: true,
      symbol: "none",
      lineStyle: { color: "#00C9A7", width: 2, type: "solid" },
      itemStyle: { color: "#00C9A7" },
      tooltip: { show: false },
    };

    // Hidden gems overlay
    const gemSeries = showGems
      ? {
          name: "Hidden Gems ★",
          type: "scatter",
          symbol: "star",
          symbolSize: 18,
          itemStyle: { color: "#FFD54F", borderColor: "#FF6B6B", borderWidth: 1 },
          data: players
            .filter((p) => p.age <= 24 && p.rating_merged >= 7.0)
            .map((p) => [p.age, +p.rating_merged.toFixed(3), 0, p.name, p.club, p.positionGroup]),
        }
      : null;

    const allSeries = [...regularSeries, trendSeries, ...(gemSeries ? [gemSeries] : [])];

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        backgroundColor: "#161B22",
        borderColor: "#30363D",
        textStyle: { color: "#E6EDF3", fontSize: 11 },
        formatter: (params: { seriesName: string; data: (string | number)[] }) => {
          if (params.seriesName === "Trend") return "";
          const d = params.data as [number, number, number, string, string, string];
          return `<b>${d[3]}</b><br/>${d[4]} · Age ${d[0]}<br/>Position: ${d[5]}<br/>Rating: ${d[1]}<br/>xG/90: ${d[2]}`;
        },
      },
      legend: {
        data: [...POSITION_GROUPS, "Trend", ...(showGems ? ["Hidden Gems ★"] : [])],
        textStyle: { color: "#8B949E", fontSize: 10 },
        bottom: 0,
      },
      grid: { left: 8, right: 16, top: 24, bottom: 40, containLabel: true },
      xAxis: {
        type: "value",
        name: "Age",
        min: 16,
        max: 40,
        nameTextStyle: { color: "#8B949E" },
        axisLabel: { color: "#8B949E", fontSize: 10 },
        splitLine: { lineStyle: { color: "#21262D" } },
        axisLine: { lineStyle: { color: "#30363D" } },
        // Age bands
        markLine: {
          silent: true,
          data: [21, 24, 27, 30].map((a) => ({
            xAxis: a,
            lineStyle: { color: "#8B949E", type: "dashed", opacity: 0.35 },
            label: {
              show: true,
              formatter: a === 21 ? "Youth" : a === 24 ? "Emerging" : a === 27 ? "Peak" : "Veteran",
              color: "#8B949E",
              fontSize: 9,
            },
          })),
        },
      },
      yAxis: {
        type: "value",
        name: "Rating",
        nameTextStyle: { color: "#8B949E" },
        axisLabel: { color: "#8B949E", fontSize: 10 },
        splitLine: { lineStyle: { color: "#21262D" } },
        axisLine: { lineStyle: { color: "#30363D" } },
      },
      series: allSeries,
    };
  }, [players, showGems]);

  return (
    <div className="bg-[#161B22] border border-white/10 rounded-lg p-4 flex flex-col gap-2 h-full">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#E6EDF3]">
          Age vs Rating Talent Curve
        </h3>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <div
            onClick={() => setShowGems((v) => !v)}
            className={`w-8 h-4 rounded-full transition relative ${showGems ? "bg-[#FFD54F]" : "bg-white/10"}`}
          >
            <div
              className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${showGems ? "left-4" : "left-0.5"}`}
            />
          </div>
          <span className="text-[11px] text-[#8B949E]">Show Hidden Gems ★</span>
        </label>
      </div>
      <ReactECharts
        option={option}
        style={{ height: 380 }}
        onEvents={{
          click: (params: { seriesName: string; data: (string | number)[] }) => {
            if (params.seriesName === "Trend") return;
            const d = params.data as [number, number, number, string, string, string];
            const found = players.find((p) => p.name === d[3]);
            if (found) openDetail(found);
          },
        }}
      />
    </div>
  );
}
