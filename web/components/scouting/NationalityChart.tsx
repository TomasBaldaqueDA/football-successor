"use client";

import { useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import type { Player } from "@/lib/scouting/types";
import { POSITION_COLORS, POSITION_GROUPS } from "@/lib/scouting/types";
import { useFilterStore } from "@/lib/scouting/filterStore";

interface NationalityChartProps {
  players: Player[];
}

export function NationalityChart({ players }: NationalityChartProps) {
  const { setNationalities, nationalities } = useFilterStore();
  const [view, setView] = useState<"bar" | "bubble">("bar");

  const { top20, posBreakdown } = useMemo(() => {
    const natMap = new Map<string, { count: number; totalRating: number; topPlayer: Player | null; byPos: Record<string, number> }>();

    players.forEach((p) => {
      if (!natMap.has(p.nationality)) {
        natMap.set(p.nationality, { count: 0, totalRating: 0, topPlayer: null, byPos: {} });
      }
      const e = natMap.get(p.nationality)!;
      e.count++;
      e.totalRating += p.rating_merged;
      e.byPos[p.positionGroup] = (e.byPos[p.positionGroup] ?? 0) + 1;
      if (!e.topPlayer || p.rating_merged > e.topPlayer.rating_merged) {
        e.topPlayer = p;
      }
    });

    const top20 = [...natMap.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 20)
      .map(([nat, d]) => ({ nat, ...d, avgRating: d.totalRating / d.count }));

    const posBreakdown = top20.map((d) =>
      POSITION_GROUPS.map((pg) => d.byPos[pg] ?? 0)
    );

    return { top20, posBreakdown };
  }, [players]);

  const option = useMemo(() => {
    const nats = top20.map((d) => d.nat.toUpperCase());

    if (view === "bar") {
      return {
        backgroundColor: "transparent",
        tooltip: {
          trigger: "axis",
          axisPointer: { type: "shadow" },
          backgroundColor: "#161B22",
          borderColor: "#30363D",
          textStyle: { color: "#E6EDF3", fontSize: 11 },
          formatter: (params: { seriesName: string; name: string; value: number }[]) => {
            const nat = params[0].name;
            const entry = top20.find((d) => d.nat.toUpperCase() === nat);
            const total = params.reduce((s, p) => s + p.value, 0);
            const topName = entry?.topPlayer?.name ?? "—";
            return `<b>${nat}</b><br/>Total: ${total}<br/>Avg Rating: ${entry?.avgRating.toFixed(2)}<br/>Top: ${topName}`;
          },
        },
        legend: {
          data: POSITION_GROUPS,
          textStyle: { color: "#8B949E", fontSize: 10 },
          bottom: 0,
        },
        grid: { left: 8, right: 16, top: 8, bottom: 40, containLabel: true },
        xAxis: {
          type: "category",
          data: nats,
          axisLabel: { color: "#8B949E", fontSize: 10, rotate: 30 },
          axisTick: { show: false },
          axisLine: { lineStyle: { color: "#30363D" } },
        },
        yAxis: {
          type: "value",
          axisLabel: { color: "#8B949E", fontSize: 10 },
          splitLine: { lineStyle: { color: "#21262D" } },
          axisLine: { lineStyle: { color: "#30363D" } },
        },
        series: POSITION_GROUPS.map((pg, pi) => ({
          name: pg,
          type: "bar",
          stack: "total",
          data: posBreakdown.map((row) => row[pi]),
          itemStyle: { color: POSITION_COLORS[pg] },
        })),
      };
    }

    // Bubble view: x = avg rating, y = count, size = count
    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        backgroundColor: "#161B22",
        borderColor: "#30363D",
        textStyle: { color: "#E6EDF3", fontSize: 11 },
        formatter: (params: { data: (string | number)[] }) => {
          const d = params.data as [number, number, number, string];
          return `<b>${d[3]}</b><br/>Avg Rating: ${(d[0] as number).toFixed(2)}<br/>Players: ${d[1]}`;
        },
      },
      grid: { left: 8, right: 16, top: 8, bottom: 16, containLabel: true },
      xAxis: {
        type: "value",
        name: "Avg Rating",
        nameTextStyle: { color: "#8B949E" },
        axisLabel: { color: "#8B949E", fontSize: 10 },
        splitLine: { lineStyle: { color: "#21262D" } },
      },
      yAxis: {
        type: "value",
        name: "Player Count",
        nameTextStyle: { color: "#8B949E" },
        axisLabel: { color: "#8B949E", fontSize: 10 },
        splitLine: { lineStyle: { color: "#21262D" } },
      },
      series: [
        {
          type: "scatter",
          symbolSize: (d: number[]) => Math.max(8, Math.min(40, d[1] * 1.5)),
          itemStyle: { color: "#00C9A7", opacity: 0.7 },
          label: {
            show: true,
            formatter: (p: { data: (string | number)[] }) => (p.data as [number, number, number, string])[3].toUpperCase(),
            fontSize: 8,
            color: "#E6EDF3",
          },
          data: top20.map((d) => [
            +d.avgRating.toFixed(2),
            d.count,
            d.count,
            d.nat.toUpperCase(),
          ]),
        },
      ],
    };
  }, [top20, posBreakdown, view]);

  const toggleNat = (nat: string) => {
    const code = nat.toLowerCase();
    if (nationalities.includes(code)) {
      setNationalities(nationalities.filter((n) => n !== code));
    } else {
      setNationalities([...nationalities, code]);
    }
  };

  return (
    <div className="bg-[#161B22] border border-white/10 rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#E6EDF3]">Nationality Breakdown</h3>
        <div className="flex gap-1">
          {(["bar", "bubble"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-2 py-0.5 rounded text-xs border transition ${
                view === v
                  ? "bg-[#00C9A7] border-[#00C9A7] text-[#0D1117]"
                  : "border-white/10 text-[#8B949E]"
              }`}
            >
              {v === "bar" ? "Stacked" : "Bubble"}
            </button>
          ))}
        </div>
      </div>
      <ReactECharts
        option={option}
        style={{ height: 340 }}
        onEvents={{
          click: (params: { name?: string; data?: (string | number)[] }) => {
            const nat = params.name ?? (params.data as [number, number, number, string])?.[3];
            if (nat) toggleNat(nat);
          },
        }}
      />
      {nationalities.length > 0 && (
        <div className="text-xs text-[#00C9A7]">
          Filtering: {nationalities.map((n) => n.toUpperCase()).join(", ")}
        </div>
      )}
    </div>
  );
}
