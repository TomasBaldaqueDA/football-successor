"use client";

import Link from "next/link";
import {
  loadL4lStudioSnapshot,
  saveL4lStudioSnapshot,
  type StoredL4lRow,
} from "@/lib/l4lStudioStorage";
import { setLastStudio } from "@/lib/studioNav";
import { useCallback, useEffect, useState } from "react";

type PlayerHit = { player_id: string; player_name: string; last_club: string | null };

type ComparisonMetric = {
  column: string;
  label: string;
  weight: number;
  target: number | null;
};

type TargetSummary = {
  player_id: string;
  player_name: string | null;
  last_club: string | null;
  nationality_code: string | null;
  age_last_season: number | null;
  position_text: string | null;
  played_positions_short: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  market_value_eur?: string | null;
  market_value_text?: string | null;
  metricVals: Record<string, number | null>;
};

type L4lRow = {
  l4l_rank: number | string;
  player_id: number | string;
  player_name: string;
  l2_distance: number | string;
  l4l_score: number | string;
  last_club?: string | null;
  nationality_code?: string | null;
  age_last_season?: number | null;
  position_text?: string | null;
  played_positions_short?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  market_value_eur?: string | null;
  market_value_text?: string | null;
  metric_vals?: Record<string, number | null>;
};

function fmtMarketValue(eur: string | null | undefined, text: string | null | undefined): string {
  if (text != null && String(text).trim() !== "") return String(text).trim();
  if (eur == null || String(eur).trim() === "") return "—";
  const n = Number(eur);
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, "")} M €`;
  if (n >= 1000) return `${Math.round(n / 1000)} k €`;
  return `${n} €`;
}

function fmtNum(v: number | string | null | undefined, digits = 3): string {
  if (v === null || v === undefined) return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

function fmtWeight(w: number): string {
  if (!Number.isFinite(w)) return "";
  return `${(w * 100).toFixed(1)}%`;
}

export function L4lStudio() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<PlayerHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [target, setTarget] = useState<PlayerHit | null>(null);
  const [buckets, setBuckets] = useState<string[]>([]);
  const [bucket, setBucket] = useState("");
  const [topN, setTopN] = useState(20);
  const [minAge, setMinAge] = useState("");
  const [maxAge, setMaxAge] = useState("");
  const [weightVersion, setWeightVersion] = useState("v1_manual");
  const [rows, setRows] = useState<L4lRow[]>([]);
  const [targetSummary, setTargetSummary] = useState<TargetSummary | null>(null);
  const [comparisonMetrics, setComparisonMetrics] = useState<ComparisonMetric[]>([]);
  const [loadingBuckets, setLoadingBuckets] = useState(false);
  const [loadingL4l, setLoadingL4l] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const snap = loadL4lStudioSnapshot();
    if (snap) {
      setQ(snap.q ?? "");
      setTarget(snap.target);
      setBuckets(snap.buckets ?? []);
      setBucket(snap.bucket ?? "");
      setTopN(snap.topN ?? 20);
      setMinAge(snap.minAge ?? "");
      setMaxAge(snap.maxAge ?? "");
      setWeightVersion(snap.weightVersion ?? "v1_manual");
      setRows((snap.rows ?? []) as L4lRow[]);
      setTargetSummary(snap.targetSummary);
      setComparisonMetrics(snap.comparisonMetrics ?? []);
      setError(null);
    }
    setHydrated(true);
  }, []);

  const flushSnapshotToStorage = useCallback(() => {
    if (typeof window === "undefined" || !hydrated) return;
    setLastStudio("l4l");
    saveL4lStudioSnapshot({
      q,
      target,
      buckets,
      bucket,
      topN,
      minAge,
      maxAge,
      weightVersion,
      rows: rows as unknown as StoredL4lRow[],
      targetSummary,
      comparisonMetrics,
    });
  }, [
    hydrated,
    q,
    target,
    buckets,
    bucket,
    topN,
    minAge,
    maxAge,
    weightVersion,
    rows,
    targetSummary,
    comparisonMetrics,
  ]);

  useEffect(() => {
    flushSnapshotToStorage();
  }, [flushSnapshotToStorage]);

  useEffect(() => {
    const qn = q.trim();
    const tn = target?.player_name?.trim() ?? "";

    if (target && tn && qn !== tn) {
      setTarget(null);
      setBuckets([]);
      setBucket("");
      setRows([]);
      setTargetSummary(null);
      setComparisonMetrics([]);
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
      setSearching(true);
      setError(null);
      try {
        const res = await fetch(`/api/players/search?q=${encodeURIComponent(qn)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Search failed");
        setHits(data.players ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Search failed");
        setHits([]);
      } finally {
        setSearching(false);
      }
    }, 320);
    return () => clearTimeout(t);
  }, [q, target]);

  const selectPlayer = useCallback(async (p: PlayerHit) => {
    setTarget(p);
    setHits([]);
    setQ(p.player_name);
    setBucket("");
    setRows([]);
    setTargetSummary(null);
    setComparisonMetrics([]);
    setLoadingBuckets(true);
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
    } finally {
      setLoadingBuckets(false);
    }
  }, []);

  const runL4l = useCallback(async () => {
    if (!target || !bucket) return;
    const minN = minAge.trim() === "" ? null : Number(minAge);
    const maxN = maxAge.trim() === "" ? null : Number(maxAge);
    if (minAge.trim() !== "" && !Number.isFinite(minN)) {
      setError("Idade mínima inválida.");
      return;
    }
    if (maxAge.trim() !== "" && !Number.isFinite(maxN)) {
      setError("Idade máxima inválida.");
      return;
    }
    if (minN !== null && maxN !== null && minN > maxN) {
      setError("A idade mínima não pode ser maior que a máxima.");
      return;
    }
    setLoadingL4l(true);
    setError(null);
    setRows([]);
    setTargetSummary(null);
    setComparisonMetrics([]);
    try {
      const res = await fetch("/api/l4l", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_player_id: target.player_id,
          selected_bucket: bucket,
          top_n: topN,
          weight_version: weightVersion,
          comparison_metrics: 8,
          min_age: minN,
          max_age: maxN,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "L4L failed");
      setRows(data.rows ?? []);
      setTargetSummary(data.targetSummary ?? null);
      setComparisonMetrics(data.comparisonMetrics ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "L4L failed");
    } finally {
      setLoadingL4l(false);
    }
  }, [target, bucket, topN, minAge, maxAge, weightVersion]);

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-8 px-4 py-10">
      <header className="space-y-2">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Studio · Like-for-Like</p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Substitutos (perfil parecido)
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          Escolhe o jogador alvo e o <span className="font-medium">bucket</span> (papel). As colunas de estatística
          são as mais relevantes para esse papel (peso × valor do alvo nas métricas{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">*_adj_merged</code>).
        </p>
      </header>

      {error ? (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">1. Jogador alvo</h2>
        <div className="relative">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Pesquisar por nome (mín. 2 caracteres)…"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            autoComplete="off"
          />
          {searching ? (
            <span className="absolute right-3 top-2.5 text-xs text-zinc-400">A pesquisar…</span>
          ) : null}
          {hits.length > 0 ? (
            <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              {hits.map((p) => (
                <li key={p.player_id}>
                  <button
                    type="button"
                    className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    onClick={() => void selectPlayer(p)}
                  >
                    <span className="font-medium text-zinc-900 dark:text-zinc-50">{p.player_name}</span>
                    {p.last_club ? (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">{p.last_club}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {target ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Selecionado:{" "}
            <span className="font-medium text-zinc-900 dark:text-zinc-100">{target.player_name}</span>
            <span className="text-zinc-400"> · id </span>
            <code className="text-xs text-zinc-500">{target.player_id}</code>
          </p>
        ) : null}
      </section>

      <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">2. Papel (bucket)</h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Filtro de idade aplica-se só aos <span className="font-medium">candidatos</span>, usando{" "}
            <code className="text-[11px]">age_last_season</code> em <code className="text-[11px]">player_dim</code>.
            Vazio = sem limite. Jogadores sem idade na dim são excluídos se definires um intervalo.
          </p>
        </div>
        {loadingBuckets ? (
          <p className="text-sm text-zinc-500">A carregar buckets…</p>
        ) : target && buckets.length === 0 ? (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Este jogador não tem buckets em <code className="text-xs">player_position_membership</code>.
          </p>
        ) : (
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Bucket
              <select
                value={bucket}
                onChange={(e) => setBucket(e.target.value)}
                disabled={!target || buckets.length === 0}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              >
                {buckets.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex w-24 flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Top N
              <input
                type="number"
                min={1}
                max={100}
                value={topN}
                onChange={(e) => setTopN(Number(e.target.value))}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </label>
            <label className="flex w-[4.5rem] flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Idade mín
              <input
                type="number"
                min={15}
                max={45}
                placeholder="—"
                value={minAge}
                onChange={(e) => setMinAge(e.target.value)}
                disabled={!target || buckets.length === 0}
                className="rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </label>
            <label className="flex w-[4.5rem] flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Idade máx
              <input
                type="number"
                min={15}
                max={45}
                placeholder="—"
                value={maxAge}
                onChange={(e) => setMaxAge(e.target.value)}
                disabled={!target || buckets.length === 0}
                className="rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </label>
            <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Versão pesos
              <input
                type="text"
                value={weightVersion}
                onChange={(e) => setWeightVersion(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </label>
            <button
              type="button"
              onClick={() => void runL4l()}
              disabled={!target || !bucket || loadingL4l}
              className="h-[42px] rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              {loadingL4l ? "A calcular…" : "Calcular ranking"}
            </button>
          </div>
        )}
      </section>

      {targetSummary && comparisonMetrics.length > 0 ? (
        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Alvo · resumo</h2>
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-zinc-700 dark:text-zinc-300">
            <span>
              <span className="text-zinc-500">Clube</span>{" "}
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {targetSummary.last_club ?? "—"}
              </span>
            </span>
            <span>
              <span className="text-zinc-500">Valor mercado (TM)</span>{" "}
              <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                {fmtMarketValue(targetSummary.market_value_eur ?? null, targetSummary.market_value_text ?? null)}
              </span>
            </span>
            <span>
              <span className="text-zinc-500">Idade</span>{" "}
              <span className="font-medium tabular-nums">{targetSummary.age_last_season ?? "—"}</span>
            </span>
            <span>
              <span className="text-zinc-500">País</span>{" "}
              <span className="font-medium">{targetSummary.nationality_code ?? "—"}</span>
            </span>
            <span>
              <span className="text-zinc-500">Pos.</span>{" "}
              <span className="font-medium">{targetSummary.position_text ?? "—"}</span>
            </span>
            <span>
              <span className="text-zinc-500">Tokens</span>{" "}
              <span className="max-w-md font-mono text-xs">{targetSummary.played_positions_short ?? "—"}</span>
            </span>
            <span>
              <span className="text-zinc-500">Cm / kg</span>{" "}
              <span className="tabular-nums">
                {targetSummary.height_cm ?? "—"} / {targetSummary.weight_kg ?? "—"}
              </span>
            </span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {comparisonMetrics.map((m) => (
              <div
                key={m.column}
                className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/50"
              >
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {m.label}{" "}
                  <span className="font-normal text-zinc-400">({fmtWeight(m.weight)})</span>
                </p>
                <p className="mt-0.5 text-lg tabular-nums font-semibold text-zinc-900 dark:text-zinc-50">
                  {fmtNum(m.target)}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {!loadingL4l && targetSummary && comparisonMetrics.length > 0 && rows.length === 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          Nenhum candidato no ranking. Verifica membership no bucket ou regras da função L4L. O resumo do alvo está em
          cima.
        </p>
      ) : null}

      {rows.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">3. Resultados</h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Colunas de métricas: mesma escala que o alvo (<code className="text-[11px]">adj merged</code>). Subtítulo
              em cada cabeçalho = valor do alvo.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-3 py-3">#</th>
                  <th className="px-3 py-3">Jogador</th>
                  <th className="px-3 py-3">Clube</th>
                  <th className="px-3 py-3">VM</th>
                  <th className="px-3 py-3">Idade</th>
                  <th className="px-3 py-3">País</th>
                  <th className="min-w-[8rem] px-3 py-3">Pos. tokens</th>
                  <th className="px-3 py-3">L2</th>
                  <th className="px-3 py-3">Score</th>
                  {comparisonMetrics.map((m) => (
                    <th key={m.column} className="min-w-[6.5rem] px-2 py-3 text-left normal-case">
                      <div className="leading-tight">
                        <span className="font-semibold text-zinc-700 dark:text-zinc-200">{m.label}</span>
                        <div className="mt-1 text-[10px] font-normal normal-case text-zinc-400">
                          alvo {fmtNum(m.target)}
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {rows.map((r) => (
                  <tr key={String(r.player_id)} className="text-zinc-800 dark:text-zinc-200">
                    <td className="px-3 py-2.5 tabular-nums text-zinc-500">{String(r.l4l_rank)}</td>
                    <td className="px-3 py-2.5 font-medium">
                      <Link
                        href={`/studio/players/${encodeURIComponent(String(r.player_id))}`}
                        onPointerDown={flushSnapshotToStorage}
                        className="text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-600 dark:text-zinc-100 dark:decoration-zinc-600 dark:hover:decoration-zinc-400"
                      >
                        {r.player_name}
                      </Link>
                    </td>
                    <td className="max-w-[10rem] truncate px-3 py-2.5 text-xs">{r.last_club ?? "—"}</td>
                    <td className="max-w-[5rem] truncate px-3 py-2.5 text-xs tabular-nums">
                      {fmtMarketValue(r.market_value_eur ?? null, r.market_value_text ?? null)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-xs">{r.age_last_season ?? "—"}</td>
                    <td className="px-3 py-2.5 text-xs">{r.nationality_code ?? "—"}</td>
                    <td className="max-w-[10rem] truncate font-mono text-[10px] text-zinc-600 dark:text-zinc-400">
                      {r.played_positions_short ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-xs">{fmtNum(r.l2_distance)}</td>
                    <td className="px-3 py-2.5 tabular-nums text-xs">{fmtNum(r.l4l_score, 2)}</td>
                    {comparisonMetrics.map((m) => (
                      <td
                        key={m.column}
                        className="px-2 py-2.5 text-xs tabular-nums text-zinc-800 dark:text-zinc-200"
                      >
                        {fmtNum(r.metric_vals?.[m.column])}
                      </td>
                    ))}
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
