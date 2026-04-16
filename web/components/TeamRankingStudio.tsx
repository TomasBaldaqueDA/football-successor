"use client";

import { useEffect, useState } from "react";

type SortBy = "defend" | "support" | "create" | "score" | "overall_avg" | "market_value";
type RankingRow = {
  player_id: string;
  name: string | null;
  age: number | null;
  positions: string | null;
  team: string | null;
  league: string | null;
  nationality: string | null;
  market_value: string | null;
  defend_score: number;
  support_score: number;
  create_score: number;
  score_score: number;
  possession_lost_score: number;
  ranking_score: number;
};

function fmtNum(v: number | null | undefined, digits = 2): string {
  return Number.isFinite(Number(v)) ? Number(v).toFixed(digits) : "—";
}

function fmtMarketValue(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  const raw = String(v).trim();
  if (!raw) return "—";

  // Accept values like "40,00 M €", "40000000", "40"
  const cleaned = raw.replace(/[^\d,.-]/g, "");
  const normalized = cleaned.includes(",") && !cleaned.includes(".") ? cleaned.replace(",", ".") : cleaned;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return "—";

  // Heuristic: values > 1000 are likely stored in EUR, smaller values in millions.
  const valueInMillions = parsed > 1000 ? parsed / 1_000_000 : parsed;
  return `€${valueInMillions.toFixed(2)}M`;
}

export function TeamRankingStudio() {
  const [teamQ, setTeamQ] = useState("");
  const [teamHits, setTeamHits] = useState<string[]>([]);
  const [team, setTeam] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("overall_avg");
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = teamQ.trim();
    if (q.length < 2 || (team && q === team)) {
      setTeamHits([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/teams/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Team search failed");
        setTeamHits(data.teams ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Team search failed");
      }
    }, 250);
    return () => clearTimeout(t);
  }, [teamQ, team]);

  async function runRanking(nextTeam?: string) {
    const chosen = (nextTeam ?? team).trim();
    if (!chosen) return;
    setLoading(true);
    setError(null);
    setRows([]);
    try {
      const res = await fetch(
        `/api/team-ranking?team=${encodeURIComponent(chosen)}&sort_by=${encodeURIComponent(sortBy)}&limit=200`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ranking failed");
      setRows(data.rows ?? []);
      setTeam(chosen);
      setTeamQ(chosen);
      setTeamHits([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ranking failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-8 px-4 py-10">
      <header className="space-y-2">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Studio · Team Ranking</p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Ranking por equipa
        </h1>
      </header>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">1. Equipa + ordenação</h2>
        <div className="flex flex-wrap items-end gap-4">
          <div className="relative min-w-[18rem] flex-1">
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
              Equipa
              <input
                type="search"
                value={teamQ}
                onChange={(e) => setTeamQ(e.target.value)}
                placeholder="Pesquisar equipa..."
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
              />
            </label>
            {teamHits.length > 0 ? (
              <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-zinc-200 bg-white py-1 text-sm shadow-lg">
                {teamHits.map((t) => (
                  <li key={t}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left hover:bg-zinc-100"
                      onClick={() => void runRanking(t)}
                    >
                      {t}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <label className="flex w-48 flex-col gap-1 text-xs font-medium text-zinc-600">
            Ordenar por
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
            >
              <option value="overall_avg">Overall Avg</option>
              <option value="defend">Defend</option>
              <option value="support">Support</option>
              <option value="create">Create</option>
              <option value="score">Score</option>
              <option value="market_value">Market Value</option>
            </select>
          </label>

          <button
            type="button"
            onClick={() => void runRanking()}
            disabled={!teamQ.trim() || loading}
            className="h-[42px] rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? "A carregar..." : "Carregar ranking"}
          </button>
        </div>
      </section>

      {rows.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">Resultados · {team}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[88rem] text-left text-sm">
              <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-3">#</th>
                  <th className="px-3 py-3">Jogador</th>
                  <th className="px-3 py-3">Idade</th>
                  <th className="px-3 py-3">Posições</th>
                  <th className="px-3 py-3">Nacionalidade</th>
                  <th className="px-3 py-3">Team</th>
                  <th className="px-3 py-3">League</th>
                  <th className="px-3 py-3">Market Value</th>
                  <th className="px-3 py-3">Defend</th>
                  <th className="px-3 py-3">Support</th>
                  <th className="px-3 py-3">Create</th>
                  <th className="px-3 py-3">Score</th>
                  <th className="px-3 py-3">Poss. Lost</th>
                  <th className="px-3 py-3">Rank Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((r, i) => (
                  <tr key={`${r.player_id}-${i}`}>
                    <td className="px-3 py-2.5">{i + 1}</td>
                    <td className="px-3 py-2.5 font-medium">{r.name ?? "—"}</td>
                    <td className="px-3 py-2.5 tabular-nums">{r.age ?? "—"}</td>
                    <td className="px-3 py-2.5">{r.positions ?? "—"}</td>
                    <td className="px-3 py-2.5">{r.nationality ?? "—"}</td>
                    <td className="px-3 py-2.5">{r.team ?? "—"}</td>
                    <td className="px-3 py-2.5">{r.league ?? "—"}</td>
                    <td className="px-3 py-2.5">{fmtMarketValue(r.market_value)}</td>
                    <td className="px-3 py-2.5 tabular-nums">{fmtNum(r.defend_score, 2)}</td>
                    <td className="px-3 py-2.5 tabular-nums">{fmtNum(r.support_score, 2)}</td>
                    <td className="px-3 py-2.5 tabular-nums">{fmtNum(r.create_score, 2)}</td>
                    <td className="px-3 py-2.5 tabular-nums">{fmtNum(r.score_score, 2)}</td>
                    <td className="px-3 py-2.5 tabular-nums">{fmtNum(r.possession_lost_score, 2)}</td>
                    <td className="px-3 py-2.5 tabular-nums font-semibold">{fmtNum(r.ranking_score, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

