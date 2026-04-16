"use client";

import { useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import type { Player } from "@/lib/scouting/types";
import { METRIC_OPTIONS, POSITION_COLORS, POSITION_GROUPS } from "@/lib/scouting/types";
import { useFilterStore } from "@/lib/scouting/filterStore";

interface ScatterPlotProps {
  players: Player[];
}

export function ScatterPlot({ players }: ScatterPlotProps) {
  const { metricX, metricY, playerSearch, openDetail } = useFilterStore();
  const [warning, setWarning] = useState(false);

  const xLabel = METRIC_OPTIONS.find((m) => m.key === metricX)?.label ?? metricX;
  const yLabel = METRIC_OPTIONS.find((m) => m.key === metricY)?.label ?? metricY;

  const { seriesData, medianX, medianY } = useMemo(() => {
    if (players.length > 500) setWarning(true);
    else setWarning(false);

    const vals = players.map((p) => ({
      p,
      x: p[metricX] as number,
      y: p[metricY] as number,
    }));

    const xs = [...vals.map((v) => v.x)].sort((a, b) => a - b);
    const ys = [...vals.map((v) => v.y)].sort((a, b) => a - b);
    const medX = xs[Math.floor(xs.length / 2)] ?? 0;
    const medY = ys[Math.floor(ys.length / 2)] ?? 0;

    // Group by position
    const byPos = new Map<string, typeof vals>();
    vals.forEach((v) => {
      const pg = v.p.positionGroup;
      if (!byPos.has(pg)) byPos.set(pg, []);
      byPos.get(pg)!.push(v);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const seriesData: any[] = POSITION_GROUPS.filter((pg) => byPos.has(pg)).map((pg) => ({
      name: pg,
      type: "scatter",
      symbolSize: (data: number[]) => {
        const rating = data[2];
        return Math.max(5, Math.min(20, (rating / 10) * 20));
      },
      itemStyle: { color: POSITION_COLORS[pg], opacity: 0.75 },
      emphasis: { itemStyle: { opacity: 1, borderColor: "#fff", borderWidth: 1 } },
      data: byPos.get(pg)!.map((v) => [
        +v.x.toFixed(3),
        +v.y.toFixed(3),
        +v.p.rating_merged.toFixed(2),
        v.p.name,
        v.p.club,
        v.p.age,
        pg,
      ]),
    }));

    // Highlight searched player
    if (playerSearch.trim()) {
      seriesData.push({
        name: "Searched",
        type: "scatter",
        symbolSize: () => 22,
        itemStyle: { color: "#fff", opacity: 1 },
        emphasis: { itemStyle: {} },
        data: vals
          .filter((v) => v.p.name.toLowerCase().includes(playerSearch.toLowerCase()))
          .map((v) => [
            +v.x.toFixed(3),
            +v.y.toFixed(3),
            +v.p.rating_merged.toFixed(2),
            v.p.name,
            v.p.club,
            v.p.age,
            v.p.positionGroup,
          ]),
      } as typeof seriesData[0]);
    }

    return { seriesData, medianX: medX, medianY: medY };
  }, [players, metricX, metricY, playerSearch]);

  const option = useMemo(() => ({
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
      backgroundColor: "#161B22",
      borderColor: "#30363D",
      textStyle: { color: "#E6EDF3", fontSize: 12 },
      formatter: (params: { data: (string | number)[] }) => {
        const d = params.data as [number, number, number, string, string, number, string];
        return `<b>${d[3]}</b><br/>${d[4]} · Age ${d[5]}<br/>Position: ${d[6]} · Rating: ${d[2]}<br/>${xLabel}: ${d[0]}<br/>${yLabel}: ${d[1]}`;
      },
    },
    legend: {
      data: POSITION_GROUPS,
      textStyle: { color: "#8B949E", fontSize: 11 },
      bottom: 0,
    },
    grid: { left: 8, right: 16, top: 20, bottom: 36, containLabel: true },
    xAxis: {
      name: xLabel,
      nameTextStyle: { color: "#8B949E", fontSize: 11 },
      axisLabel: { color: "#8B949E", fontSize: 10 },
      splitLine: { lineStyle: { color: "#21262D" } },
      axisLine: { lineStyle: { color: "#30363D" } },
      markLine: {
        silent: true,
        data: [{ xAxis: medianX }],
        lineStyle: { color: "#8B949E", type: "dashed", opacity: 0.5 },
        label: { show: false },
      },
    },
    yAxis: {
      name: yLabel,
      nameTextStyle: { color: "#8B949E", fontSize: 11 },
      axisLabel: { color: "#8B949E", fontSize: 10 },
      splitLine: { lineStyle: { color: "#21262D" } },
      axisLine: { lineStyle: { color: "#30363D" } },
      markLine: {
        silent: true,
        data: [{ yAxis: medianY }],
        lineStyle: { color: "#8B949E", type: "dashed", opacity: 0.5 },
        label: { show: false },
      },
    },
    series: seriesData,
  }), [seriesData, xLabel, yLabel, medianX, medianY]);

  return (
    <div className="bg-[#161B22] border border-white/10 rounded-lg p-4 flex flex-col gap-2 h-full">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#E6EDF3]">
          Dual-Metric Explorer
          <span className="ml-2 text-[11px] text-[#8B949E] font-normal">
            {xLabel} vs {yLabel}
          </span>
        </h3>
        <span className="text-[11px] text-[#8B949E]">{players.length} players</span>
      </div>

      {warning && (
        <div className="text-xs text-[#FF6B6B] bg-[#FF6B6B]/10 border border-[#FF6B6B]/30 rounded px-2 py-1">
          ⚠ {players.length} points — consider narrowing position or age filters for clearer analysis
        </div>
      )}

      {/* Quadrant labels */}
      <div className="relative">
        <ReactECharts
          option={option}
          style={{ height: 400 }}
          onEvents={{
            click: (params: { data: (string | number)[] }) => {
              const d = params.data as [number, number, number, string, string, number, string];
              const found = players.find((p) => p.name === d[3]);
              if (found) openDetail(found);
            },
          }}
        />
        {/* Quadrant annotations */}
        <div className="absolute top-2 right-4 text-[10px] text-[#FFD54F]/70 font-medium pointer-events-none">Elite ↗</div>
        <div className="absolute top-2 left-10 text-[10px] text-[#81D4FA]/60 pointer-events-none">Creative</div>
        <div className="absolute bottom-10 right-4 text-[10px] text-[#A5D6A7]/60 pointer-events-none">Clinical</div>
        <div className="absolute bottom-10 left-10 text-[10px] text-[#8B949E]/50 pointer-events-none">Below avg</div>
      </div>
    </div>
  );
}
