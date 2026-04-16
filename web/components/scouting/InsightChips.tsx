"use client";

import { useMemo } from "react";
import type { Player } from "@/lib/scouting/types";
import { generateInsights } from "@/lib/scouting/insights";

interface InsightChipsProps {
  players: Player[];
}

export function InsightChips({ players }: InsightChipsProps) {
  const chips = useMemo(() => generateInsights(players), [players]);

  if (chips.length === 0) return null;

  const colors: Record<string, string> = {
    positive: "border-[#00C9A7] text-[#00C9A7] bg-[#00C9A7]/10",
    neutral: "border-[#8B949E] text-[#8B949E] bg-white/5",
    warning: "border-[#FF6B6B] text-[#FF6B6B] bg-[#FF6B6B]/10",
  };

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {chips.map((chip, i) => (
        <div
          key={i}
          className={`border rounded-full px-3 py-1 text-xs font-medium ${colors[chip.type]}`}
        >
          {chip.type === "positive" ? "↑ " : chip.type === "warning" ? "⚠ " : "● "}
          {chip.text}
        </div>
      ))}
    </div>
  );
}
