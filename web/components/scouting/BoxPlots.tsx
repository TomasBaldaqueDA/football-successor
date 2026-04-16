"use client";

import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { Player } from "@/lib/scouting/types";
import { METRIC_OPTIONS, POSITION_COLORS, POSITION_GROUPS } from "@/lib/scouting/types";
import { useFilterStore } from "@/lib/scouting/filterStore";

function boxStats(vals: number[]): [number, number, number, number, number] {
  const sorted = [...vals].sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return [0, 0, 0, 0, 0];
  const q1 = sorted[Math.floor(n * 0.25)];
  const median = sorted[Math.floor(n * 0.5)];
  const q3 = sorted[Math.floor(n * 0.75)];
  const iqr = q3 - q1;
  const min = Math.max(sorted[0], q1 - 1.5 * iqr);
  const max = Math.min(sorted[n - 1], q3 + 1.5 * iqr);
  return [min, q1, median, q3, max];
}

interface BoxPlotsProps {
  players: Player[];
}

export function BoxPlots({ players }: BoxPlotsProps) {
  const { selectedBoxMetric, setSelectedBoxMetric, openDetail } = useFilterStore();

  const metricLabel = METRIC_OPTIONS.find((m) => m.key === selectedBoxMetric)?.label ?? selectedBoxMetric;

  const { boxData, outlierData, meanData, globalAvg } = useMemo(() => {
    const byPos = new Map<string, Player[]>();
    players.forEach((p) => {
      if (!byPos.has(p.positionGroup)) byPos.set(p.positionGroup, []);
      byPos.get(p.positionGroup)!.push(p);
    });

    const boxes: [number, number, number, number, number][] = [];
    const outliers: [number, number, string, string, number][] = [];
    const means: [number, number][] = [];

    POSITION_GROUPS.forEach((pos, i) => {
      const group = byPos.get(pos) ?? [];
      const vals = group.map((p) => p[selectedBoxMetric] as number);
      if (vals.length === 0) {
        boxes.push([0, 0, 0, 0, 0]);
        means.push([i, 0]);
        return;
      }
      const stats = boxStats(vals);
      boxes.push(stats);
      means.push([i, +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(3)]);

      // Outliers
      const iqr = stats[3] - stats[1];
      const lower = stats[1] - 1.5 * iqr;
      const upper = stats[3] + 1.5 * iqr;
      group.forEach((p) => {
        const v = p[selectedBoxMetric] as number;
        if (v < lower || v > upper) {
          outliers.push([i, +v.toFixed(3), p.name, p.club, p.rating_merged]);
        }
      });
    });

    const all = players.map((p) => p[selectedBoxMetric] as number);
    const globalAvg = all.length ? all.reduce((s, v) => s + v, 0) / all.length : 0;

    return { boxData: boxes, outlierData: outliers, meanData: means, globalAvg };
  }, [players, selectedBoxMetric]);

  const option = useMemo(() => ({
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
      backgroundColor: "#161B22",
      borderColor: "#30363D",
      textStyle: { color: "#E6EDF3", fontSize: 11 },
      formatter: (params: { seriesName: string; data: (string | number)[] }) => {
        if (params.seriesName === "Outliers") {
          const d = params.data as [number, number, string, string, number];
          return `<b>${d[2]}</b><br/>${d[3]}<br/>Rating: ${d[4]}<br/>${metricLabel}: <b>${d[1]}</b>`;
        }
        if (params.seriesName === "Mean") {
          const d = params.data as [number, number];
          return `Mean: ${d[1]}`;
        }
        const d = params.data as number[];
        return `Min: ${d[1].toFixed(2)}<br/>Q1: ${d[2].toFixed(2)}<br/>Median: ${d[3].toFixed(2)}<br/>Q3: ${d[4].toFixed(2)}<br/>Max: ${d[5].toFixed(2)}`;
      },
    },
    grid: { left: 8, right: 16, top: 16, bottom: 32, containLabel: true },
    xAxis: {
      type: "category",
      data: POSITION_GROUPS,
      axisLabel: {
        color: "#8B949E",
        fontSize: 11,
        formatter: (val: string, i: number) =>
          `{${val}|${val}}`,
        rich: Object.fromEntries(
          POSITION_GROUPS.map((pg) => [pg, { color: POSITION_COLORS[pg], fontSize: 11, fontWeight: 600 }])
        ),
      },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: "#30363D" } },
    },
    yAxis: {
      type: "value",
      name: metricLabel,
      nameTextStyle: { color: "#8B949E", fontSize: 10 },
      axisLabel: { color: "#8B949E", fontSize: 10 },
      splitLine: { lineStyle: { color: "#21262D" } },
      axisLine: { lineStyle: { color: "#30363D" } },
      markLine: {
        silent: true,
        data: [{ yAxis: +globalAvg.toFixed(3) }],
        lineStyle: { color: "#FF6B6B", type: "dashed", width: 1, opacity: 0.7 },
        label: {
          show: true,
          formatter: `Dataset avg: ${globalAvg.toFixed(2)}`,
          color: "#FF6B6B",
          fontSize: 9,
        },
      },
    },
    series: [
      {
        name: "Box",
        type: "boxplot",
        data: boxData,
        itemStyle: { color: "#00C9A7", borderColor: "#00C9A7", opacity: 0.6 },
      },
      {
        name: "Outliers",
        type: "scatter",
        data: outlierData,
        symbolSize: 6,
        itemStyle: { color: "#FFD54F", opacity: 0.8 },
        encode: { x: 0, y: 1 },
      },
      {
        name: "Mean",
        type: "scatter",
        data: meanData,
        symbol: "diamond",
        symbolSize: 10,
        itemStyle: { color: "#FF7043" },
      },
    ],
  }), [boxData, outlierData, meanData, metricLabel, globalAvg]);

  return (
    <div className="bg-[#161B22] border border-white/10 rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#E6EDF3]">Metric Distribution by Position</h3>
        <select
          className="bg-[#0D1117] border border-white/10 rounded text-xs px-2 py-1 text-[#E6EDF3] focus:outline-none focus:border-[#00C9A7]"
          value={selectedBoxMetric}
          onChange={(e) => setSelectedBoxMetric(e.target.value as typeof selectedBoxMetric)}
        >
          {METRIC_OPTIONS.map((m) => (
            <option key={m.key} value={m.key}>{m.label}</option>
          ))}
        </select>
      </div>
      <div className="text-[10px] text-[#8B949E] flex gap-3">
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#00C9A7] inline-block" /> Box = IQR</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-[#FF7043] rotate-45 inline-block" /> Mean</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#FFD54F] inline-block" /> Outlier</span>
        <span className="flex items-center gap-1"><span className="w-4 h-0.5 border-dashed border-b border-[#FF6B6B] inline-block" /> Dataset avg</span>
      </div>
      <ReactECharts
        option={option}
        style={{ height: 340 }}
        onEvents={{
          click: (params: { seriesName: string; data: (string | number)[] }) => {
            if (params.seriesName === "Outliers") {
              const name = params.data[2] as string;
              const found = players.find((p) => p.name === name);
              if (found) openDetail(found);
            }
          },
        }}
      />
    </div>
  );
}
