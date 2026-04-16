"use client";

import { useCallback, useEffect, useState } from "react";

type PlayerHit = { player_id: string; player_name: string; last_club: string | null };

type TopMetricRow = {
  column: string;
  source_metric_column: string;
  label: string;
  weight: number;
  value_p90: number | null;
  value_adj: number | null;
  strength_score: number;
};

type PlayerSummary = {
  player_id: string;
  player_name: string | null;
  last_club: string | null;
  age_last_season: number | null;
  position_text: string | null;
  played_positions_short: string | null;
  market_value_eur: string | null;
  market_value_text: string | null;
};

function fmtNum(v: number | null | undefined, digits = 3): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return v.toFixed(digits);
}

function fmtMarketValue(eur: string | null | undefined, text: string | null | undefined): string {
  if (text && text.trim()) return text.trim();
  if (!eur) return "—";
  const n = Number(eur);
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, "")} M €`;
  if (n >= 1000) return `${Math.round(n / 1000)} k €`;
  return `${n} €`;
}

export function TopStatsStudio() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<PlayerHit[]>([]);
  const [target, setTarget] = useState<PlayerHit | null>(null);
  const [buckets, setBuckets] = useState<string[]>([]);
  const [bucket, setBucket] = useState("");
  const [weightVersion, setWeightVersion] = useState("v1_manual");
  const [topK, setTopK] = useState(5);
  const [rows, setRows] = useState<TopMetricRow[]>([]);
  const [summary, setSummary] = useState<PlayerSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const qn = q.trim();
    const tn = target?.player_name?.trim() ?? "";
    if (target && tn && qn !== tn) {
      setTarget(null);
      setBuckets([]);
      setBucket("");
      setRows([]);
      setSummary(null);
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
    setRows([]);
    setSummary(null);
    setError(null);
    try {
      const res = await fetch(`/api/players/buckets?player_id=${encodeURIComponent(p.player_id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Buckets failed");
      const b: string[] = data.buckets ?? [];
      setBuckets(b);
      setBucket(b[0] ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Buckets failed");
      setBuckets([]);
      setBucket("");
    }
  }, []);

  const runTopStats = useCallback(async () => {
    if (!target || !bucket) return;
    setLoading(true);
    setError(null);
    setRows([]);
    setSummary(null);
    try {
      const res = await fetch("/api/player-top-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player_id: target.player_id,
          selected_bucket: bucket,
          weight_version: weightVersion,
          top_k: topK,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Top stats failed");
      setRows(data.rows ?? []);
      setSummary(data.playerSummary ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Top stats failed");
    } finally {
      setLoading(false);
    }
  }, [target, bucket, weightVersion, topK]);

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-8 px-4 py-10">
      <header className="space-y-2">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Studio · Top Stats</p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Top 5 stats por bucket
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Mostra as métricas em que o jogador é mais forte, ponderadas pela importância do bucket.
        </p>
      </header>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">1. Jogador</h2>
        <div className="relative">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Pesquisar por nome (mín. 2 caracteres)..."
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

      <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">2. Configuração</h2>
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs font-medium text-zinc-600">
            Bucket
            <select
              value={bucket}
              onChange={(e) => setBucket(e.target.value)}
              disabled={!target || buckets.length === 0}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
            >
              {buckets.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>

          <label className="flex w-24 flex-col gap-1 text-xs font-medium text-zinc-600">
            Top K
            <input
              type="number"
              min={1}
              max={10}
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
            />
          </label>

          <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs font-medium text-zinc-600">
            Versão pesos
            <input
              type="text"
              value={weightVersion}
              onChange={(e) => setWeightVersion(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
            />
          </label>

          <button
            type="button"
            onClick={() => void runTopStats()}
            disabled={!target || !bucket || loading}
            className="h-[42px] rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? "A calcular..." : "Calcular Top Stats"}
          </button>
        </div>
      </section>

      {summary ? (
        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Resumo do jogador</h2>
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-zinc-700 dark:text-zinc-300">
            <span><span className="text-zinc-500">Nome</span> <span className="font-medium">{summary.player_name ?? "—"}</span></span>
            <span><span className="text-zinc-500">Clube</span> <span className="font-medium">{summary.last_club ?? "—"}</span></span>
            <span><span className="text-zinc-500">Idade</span> <span className="font-medium">{summary.age_last_season ?? "—"}</span></span>
            <span><span className="text-zinc-500">Posição</span> <span className="font-medium">{summary.position_text ?? "—"}</span></span>
            <span><span className="text-zinc-500">Tokens</span> <span className="font-medium">{summary.played_positions_short ?? "—"}</span></span>
            <span><span className="text-zinc-500">VM</span> <span className="font-medium">{fmtMarketValue(summary.market_value_eur, summary.market_value_text)}</span></span>
          </div>
        </section>
      ) : null}

      {rows.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Top métricas do jogador</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-3 py-3">#</th>
                  <th className="px-3 py-3">Métrica</th>
                  <th className="px-3 py-3">Valor p90 (raw)</th>
                  <th className="px-3 py-3">Valor adj (ref)</th>
                  <th className="px-3 py-3">Peso bucket</th>
                  <th className="px-3 py-3">Strength score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {rows.map((r, idx) => (
                  <tr key={r.column}>
                    <td className="px-3 py-2.5">{idx + 1}</td>
                    <td className="px-3 py-2.5 font-medium">{r.label}</td>
                    <td className="px-3 py-2.5 tabular-nums">{fmtNum(r.value_p90, 3)}</td>
                    <td className="px-3 py-2.5 tabular-nums text-zinc-500">{fmtNum(r.value_adj, 3)}</td>
                    <td className="px-3 py-2.5 tabular-nums">{fmtNum(r.weight, 3)}</td>
                    <td className="px-3 py-2.5 tabular-nums font-semibold">{fmtNum(r.strength_score, 4)}</td>
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

