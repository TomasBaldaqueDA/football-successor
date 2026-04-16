"use client";

import { useCallback, useEffect, useState } from "react";

type PlayerHit = { player_id: string; player_name: string; last_club: string | null };

type ControlRow = {
  player_id: number | string;
  name: string | null;
  age: number | null;
  market_value: string | null;
  positions: string | null;
  team: string | null;
  league: string | null;
  nationality: string | null;
  defend_score: number;
  support_score: number;
  create_score: number;
  score_score: number;
  possession_lost_score: number;
};

type TopRow = {
  player_id: string;
  name: string | null;
  age: number | null;
  team: string | null;
  league: string | null;
  positions: string | null;
  market_value: string | null;
  score_value: number | null;
};

function fmtNum(v: number | string | null | undefined, digits = 2): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(digits) : "—";
}

function fmtPct(v: number | string | null | undefined): string {
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toFixed(1)}%` : "—";
}

export function ControlScoreStudio() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<PlayerHit[]>([]);
  const [target, setTarget] = useState<PlayerHit | null>(null);
  const [row, setRow] = useState<ControlRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [topLoading, setTopLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topScoreType, setTopScoreType] = useState<"defend" | "support" | "create" | "score">("score");
  const [topRows, setTopRows] = useState<TopRow[]>([]);

  useEffect(() => {
    const qn = q.trim();
    const tn = target?.player_name?.trim() ?? "";
    if (target && tn && qn !== tn) {
      setTarget(null);
      setRow(null);
      setHits([]);
      return;
    }
    if (target && tn && qn === tn) {
      setHits([]);
      return;
    }
    if (qn.length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/players/search?q=${encodeURIComponent(qn)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Search failed");
        setHits(data.players ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Search failed");
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q, target]);

  const selectPlayer = useCallback(async (p: PlayerHit) => {
    setTarget(p);
    setQ(p.player_name);
    setHits([]);
    setRow(null);
    setError(null);
  }, []);

  const runControl = useCallback(async () => {
    if (!target) return;
    setLoading(true);
    setError(null);
    setRow(null);
    try {
      const res = await fetch("/api/control-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player_id: target.player_id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Control Score failed");
      setRow(data.row ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Control Score failed");
    } finally {
      setLoading(false);
    }
  }, [target]);

  const runTop50 = useCallback(async () => {
    setTopLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/control-score/top?score=${encodeURIComponent(topScoreType)}&limit=50`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Top 50 failed");
      setTopRows(data.rows ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Top 50 failed");
      setTopRows([]);
    } finally {
      setTopLoading(false);
    }
  }, [topScoreType]);

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-8 px-4 py-10">
      <header className="space-y-2">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Studio · Control Score</p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Control Score Card</h1>
      </header>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}

      <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">1. Jogador alvo</h2>
        <div className="relative">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Pesquisar por nome..."
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
          />
          {hits.length > 0 ? (
            <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-zinc-200 bg-white py-1 text-sm shadow-lg">
              {hits.map((p) => (
                <li key={p.player_id}>
                  <button
                    type="button"
                    className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-zinc-100"
                    onClick={() => void selectPlayer(p)}
                  >
                    <span className="font-medium">{p.player_name}</span>
                    {p.last_club ? <span className="text-xs text-zinc-500">{p.last_club}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">2. Ver card</h2>
        <button type="button" onClick={() => void runControl()} disabled={!target || loading} className="h-[42px] rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white disabled:opacity-50">
          {loading ? "A carregar..." : "Carregar Control Card"}
        </button>
      </section>

      {row ? (
        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">Resumo</h2>
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-zinc-700">
            <span><span className="text-zinc-500">Nome</span> <span className="font-medium">{row.name ?? "—"}</span></span>
            <span><span className="text-zinc-500">Idade</span> <span className="font-medium">{row.age ?? "—"}</span></span>
            <span><span className="text-zinc-500">Market Value</span> <span className="font-medium">{row.market_value ?? "—"}</span></span>
            <span><span className="text-zinc-500">Positions</span> <span className="font-medium">{row.positions ?? "—"}</span></span>
            <span><span className="text-zinc-500">Nationality</span> <span className="font-medium">{row.nationality ?? "—"}</span></span>
            <span><span className="text-zinc-500">Team</span> <span className="font-medium">{row.team ?? "—"}</span></span>
            <span><span className="text-zinc-500">League</span> <span className="font-medium">{row.league ?? "—"}</span></span>
          </div>
        </section>
      ) : null}

      {row ? (
        <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">Card de perfis</h2>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <div className="text-xs text-emerald-700">Defend Score</div>
              <div className="text-3xl font-bold text-emerald-900">{fmtNum(row.defend_score, 1)}</div>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <div className="text-xs text-blue-700">Support Score</div>
              <div className="text-3xl font-bold text-blue-900">{fmtNum(row.support_score, 1)}</div>
            </div>
            <div className="rounded-lg border border-violet-200 bg-violet-50 p-3">
              <div className="text-xs text-violet-700">Create Score</div>
              <div className="text-3xl font-bold text-violet-900">{fmtNum(row.create_score, 1)}</div>
            </div>
            <div className="rounded-lg border border-fuchsia-200 bg-fuchsia-50 p-3">
              <div className="text-xs text-fuchsia-700">Score Score</div>
              <div className="text-3xl font-bold text-fuchsia-900">{fmtNum(row.score_score, 1)}</div>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <div className="text-xs text-zinc-700">Possession Lost Score</div>
              <div className="text-3xl font-bold text-zinc-900">{fmtPct(row.possession_lost_score)}</div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-zinc-900">Top 50 por score (v2)</h2>
        </div>
        <div className="flex flex-wrap items-end gap-3 px-5 py-4">
          <label className="flex w-40 flex-col gap-1 text-xs font-medium text-zinc-600">
            Score
            <select
              value={topScoreType}
              onChange={(e) => setTopScoreType(e.target.value as "defend" | "support" | "create" | "score")}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
            >
              <option value="defend">Defend</option>
              <option value="support">Support</option>
              <option value="create">Create</option>
              <option value="score">Score</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => void runTop50()}
            disabled={topLoading}
            className="h-[42px] rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white disabled:opacity-50"
          >
            {topLoading ? "A carregar..." : "Carregar Top 50"}
          </button>
        </div>
        {topRows.length > 0 ? (
          <div className="overflow-x-auto border-t border-zinc-200">
            <table className="w-full min-w-[68rem] text-left text-sm">
              <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-3">#</th>
                  <th className="px-3 py-3">Jogador</th>
                  <th className="px-3 py-3">Idade</th>
                  <th className="px-3 py-3">Posições</th>
                  <th className="px-3 py-3">Team</th>
                  <th className="px-3 py-3">League</th>
                  <th className="px-3 py-3">Market Value</th>
                  <th className="px-3 py-3">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {topRows.map((r, i) => (
                  <tr key={`${r.player_id}-${i}`}>
                    <td className="px-3 py-2.5">{i + 1}</td>
                    <td className="px-3 py-2.5 font-medium">{r.name ?? "—"}</td>
                    <td className="px-3 py-2.5 tabular-nums">{r.age ?? "—"}</td>
                    <td className="px-3 py-2.5">{r.positions ?? "—"}</td>
                    <td className="px-3 py-2.5">{r.team ?? "—"}</td>
                    <td className="px-3 py-2.5">{r.league ?? "—"}</td>
                    <td className="px-3 py-2.5">{r.market_value ?? "—"}</td>
                    <td className="px-3 py-2.5 tabular-nums font-semibold">{fmtNum(r.score_value, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}

