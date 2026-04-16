"use client";

import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { Player } from "@/lib/scouting/types";
import { METRIC_OPTIONS, POSITION_COLORS } from "@/lib/scouting/types";
import { useFilterStore } from "@/lib/scouting/filterStore";

interface TopPlayersBarProps {
  players: Player[];
}

export function TopPlayersBar({ players }: TopPlayersBarProps) {
  const { selectedBarMetric, setSelectedBarMetric, topN, openDetail } = useFilterStore();

  const metricLabel = METRIC_OPTIONS.find((m) => m.key === selectedBarMetric)?.label ?? selectedBarMetric;

  const topPlayers = useMemo(() => {
    return [...players]
      .sort((a, b) => (b[selectedBarMetric] as number) - (a[selectedBarMetric] as number))
      .slice(0, topN);
  }, [players, selectedBarMetric, topN]);

  const option = useMemo(() => {
    const names = topPlayers.map((p) => p.name.length > 18 ? p.name.slice(0, 16) + "…" : p.name);
    const values = topPlayers.map((p) => +(p[selectedBarMetric] as number).toFixed(3));
    const colors = topPlayers.map((p) => POSITION_COLORS[p.positionGroup]);

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        backgroundColor: "#161B22",
        borderColor: "#30363D",
        textStyle: { color: "#E6EDF3", fontSize: 12 },
        formatter: (params: { dataIndex: number }[]) => {
          const i = params[0].dataIndex;
          const p = topPlayers[i];
          return `<b>${p.name}</b><br/>Age: ${p.age} · ${p.club}<br/>Rating: ${p.rating_merged.toFixed(2)}<br/>${metricLabel}: <b>${values[i]}</b>`;
        },
      },
      grid: { left: 8, right: 24, top: 8, bottom: 4, containLabel: true },
      xAxis: {
        type: "value",
        axisLabel: { color: "#8B949E", fontSize: 11 },
        splitLine: { lineStyle: { color: "#21262D" } },
      },
      yAxis: {
        type: "category",
        data: names,
        inverse: true,
        axisLabel: { color: "#E6EDF3", fontSize: 11 },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: "#30363D" } },
      },
      series: [
        {
          type: "bar",
          data: values.map((v, i) => ({
            value: v,
            itemStyle: { color: colors[i], borderRadius: [0, 4, 4, 0] },
          })),
          label: {
            show: true,
            position: "right",
            color: "#8B949E",
            fontSize: 10,
            formatter: (p: { value: number }) => p.value.toFixed(2),
          },
        },
      ],
    };
  }, [topPlayers, selectedBarMetric, metricLabel]);

  return (
    <div className="bg-[#161B22] border border-white/10 rounded-lg p-4 flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#E6EDF3]">Top {topN} Players</h3>
        <select
          className="bg-[#0D1117] border border-white/10 rounded text-xs px-2 py-1 text-[#E6EDF3] focus:outline-none focus:border-[#00C9A7]"
          value={selectedBarMetric}
          onChange={(e) => setSelectedBarMetric(e.target.value as typeof selectedBarMetric)}
        >
          {METRIC_OPTIONS.map((m) => (
            <option key={m.key} value={m.key}>{m.label}</option>
          ))}
        </select>
      </div>
      <ReactECharts
        option={option}
        style={{ height: 420 }}
        onEvents={{
          click: (params: { dataIndex: number }) => openDetail(topPlayers[params.dataIndex]),
        }}
      />
    </div>
  );
}
