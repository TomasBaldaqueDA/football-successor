"use client";

import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { Player } from "@/lib/scouting/types";
import { useFilterStore } from "@/lib/scouting/filterStore";

interface ClubDensityChartProps {
  players: Player[];
}

export function ClubDensityChart({ players }: ClubDensityChartProps) {
  const { selectedClubMetric, setSelectedClubMetric, setClubs, clubs } = useFilterStore();

  const { top20, maxVal } = useMemo(() => {
    const clubMap = new Map<string, { players: Player[] }>();
    players.forEach((p) => {
      if (!clubMap.has(p.club)) clubMap.set(p.club, { players: [] });
      clubMap.get(p.club)!.players.push(p);
    });

    const entries = [...clubMap.entries()].map(([club, { players: ps }]) => {
      const avgRating = ps.reduce((s, p) => s + p.rating_merged, 0) / ps.length;
      const avgXg = ps.reduce((s, p) => s + p.xg_per_90_merged, 0) / ps.length;
      const squadDepth = ps.filter((p) => p.rating_merged >= 7.0).length;
      const topPlayer = [...ps].sort((a, b) => b.rating_merged - a.rating_merged)[0];
      return { club, count: ps.length, avgRating, avgXg, squadDepth, topPlayer };
    });

    const metricKey = selectedClubMetric === "avgRating"
      ? "avgRating"
      : selectedClubMetric === "avgXg"
      ? "avgXg"
      : "squadDepth";

    const top20 = entries
      .filter((e) => e.count >= 2)
      .sort((a, b) => b[metricKey] - a[metricKey])
      .slice(0, 20);

    const maxVal = Math.max(...top20.map((e) => e[metricKey]));

    return { top20, maxVal };
  }, [players, selectedClubMetric]);

  const option = useMemo(() => {
    const metricKey = selectedClubMetric === "avgRating"
      ? "avgRating"
      : selectedClubMetric === "avgXg"
      ? "avgXg"
      : "squadDepth";

    const metricLabel = selectedClubMetric === "avgRating"
      ? "Avg Rating"
      : selectedClubMetric === "avgXg"
      ? "Avg xG/90"
      : "Squad Depth (≥7.0 rating)";

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        backgroundColor: "#161B22",
        borderColor: "#30363D",
        textStyle: { color: "#E6EDF3", fontSize: 11 },
        formatter: (params: { dataIndex: number; value: number }[]) => {
          const i = params[0].dataIndex;
          const e = top20[i];
          return `<b>${e.club}</b><br/>${e.count} players in dataset<br/>Avg Rating: ${e.avgRating.toFixed(2)}<br/>Squad Depth: ${e.squadDepth}<br/>Best: ${e.topPlayer?.name} (${e.topPlayer?.rating_merged.toFixed(2)})`;
        },
      },
      grid: { left: 8, right: 24, top: 8, bottom: 4, containLabel: true },
      xAxis: {
        type: "value",
        max: maxVal * 1.05,
        axisLabel: { color: "#8B949E", fontSize: 10 },
        splitLine: { lineStyle: { color: "#21262D" } },
        axisLine: { lineStyle: { color: "#30363D" } },
      },
      yAxis: {
        type: "category",
        data: top20.map((e) => e.club.length > 18 ? e.club.slice(0, 16) + "…" : e.club),
        inverse: true,
        axisLabel: { color: "#E6EDF3", fontSize: 10 },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: "#30363D" } },
      },
      series: [
        {
          name: metricLabel,
          type: "bar",
          data: top20.map((e, i) => ({
            value: +e[metricKey].toFixed(3),
            itemStyle: {
              color: clubs.includes(e.club)
                ? "#FFD54F"
                : `rgba(0, 201, 167, ${0.4 + 0.6 * (1 - i / top20.length)})`,
              borderRadius: [0, 4, 4, 0],
            },
          })),
          label: {
            show: true,
            position: "right",
            color: "#8B949E",
            fontSize: 9,
            formatter: (p: { value: number }) =>
              selectedClubMetric === "squadDepth" ? p.value.toString() : p.value.toFixed(2),
          },
        },
      ],
    };
  }, [top20, selectedClubMetric, maxVal, clubs]);

  const toggleClub = (club: string) => {
    if (clubs.includes(club)) {
      setClubs(clubs.filter((c) => c !== club));
    } else {
      setClubs([...clubs, club]);
    }
  };

  return (
    <div className="bg-[#161B22] border border-white/10 rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#E6EDF3]">Club Talent Density</h3>
        <select
          className="bg-[#0D1117] border border-white/10 rounded text-xs px-2 py-1 text-[#E6EDF3] focus:outline-none focus:border-[#00C9A7]"
          value={selectedClubMetric}
          onChange={(e) => setSelectedClubMetric(e.target.value as typeof selectedClubMetric)}
        >
          <option value="avgRating">Avg Rating</option>
          <option value="avgXg">Avg xG/90</option>
          <option value="squadDepth">Squad Depth</option>
        </select>
      </div>
      <ReactECharts
        option={option}
        style={{ height: 400 }}
        onEvents={{
          click: (params: { dataIndex: number }) => toggleClub(top20[params.dataIndex].club),
        }}
      />
      {clubs.length > 0 && (
        <div className="text-xs text-[#FFD54F]">
          Club filter: {clubs.join(", ")}
          <button onClick={() => setClubs([])} className="ml-2 text-[#8B949E] hover:text-[#FF6B6B]">Clear</button>
        </div>
      )}
    </div>
  );
}
