"use client";

import { useMemo } from "react";
import type { Player } from "@/lib/scouting/types";

interface KPIStripProps {
  players: Player[];
}

export function KPIStrip({ players }: KPIStripProps) {
  const stats = useMemo(() => {
    if (players.length === 0) return null;
    const avgRating = players.reduce((s, p) => s + p.rating_merged, 0) / players.length;
    const avgAge = players.reduce((s, p) => s + p.age, 0) / players.length;
    const top = [...players].sort((a, b) => b.rating_merged - a.rating_merged)[0];
    return { count: players.length, avgRating, avgAge, top };
  }, [players]);

  const cards = [
    {
      label: "Players in View",
      value: stats?.count.toLocaleString() ?? "—",
      sub: "current filters",
      color: "#00C9A7",
    },
    {
      label: "Average Rating",
      value: stats?.avgRating.toFixed(2) ?? "—",
      sub: "out of 10.00",
      color: "#FFD54F",
    },
    {
      label: "Average Age",
      value: stats?.avgAge.toFixed(1) ?? "—",
      sub: "years old",
      color: "#81D4FA",
    },
    {
      label: "Top Performer",
      value: stats?.top.name.split(" ").pop() ?? "—",
      sub: stats ? `${stats.top.rating_merged.toFixed(2)} · ${stats.top.club}` : "—",
      color: "#FFAB40",
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-3 mb-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="bg-[#161B22] border border-white/10 rounded-lg px-4 py-3 flex flex-col gap-1"
        >
          <span className="text-[11px] text-[#8B949E] uppercase tracking-wider">{c.label}</span>
          <span
            className="text-3xl font-bold leading-none truncate"
            style={{ color: c.color }}
          >
            {c.value}
          </span>
          <span className="text-[11px] text-[#8B949E] truncate">{c.sub}</span>
        </div>
      ))}
    </div>
  );
}
