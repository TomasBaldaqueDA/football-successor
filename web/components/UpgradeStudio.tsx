"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { setLastStudio } from "@/lib/studioNav";
import {
  loadUpgradeStudioSnapshot,
  saveUpgradeStudioSnapshot,
  type StoredUpgradeRow,
} from "@/lib/upgradeStudioStorage";

type PlayerHit = { player_id: string; player_name: string; last_club: string | null };
type ComparisonMetric = { column: string; label: string; weight: number; target: number | null };
type TargetSummary = {
  player_id: string;
  player_name: string | null;
  last_club: string | null;
  nationality_code: string | null;
  age_last_season: number | null;
  market_value_eur?: string | null;
  market_value_text?: string | null;
  metricVals: Record<string, number | null>;
};
type UpgradeRow = {
  upgrade_rank: number | string;
  player_id: number | string;
  player_name: string;
  upgrade_score: number | string;
  upgrade_raw: number | string;
  key_upgrade_bonus: number | string;
  sub_position_bonus: number | string;
  fit_now_score: number | string;
  l2_distance: number | string;
  positive_metrics_count: number | string;
  positive_top_metrics_count: number | string;
  age_last_season?: number | null;
  last_club?: string | null;
  market_value_eur?: string | null;
  market_value_text?: string | null;
  metric_vals?: Record<string, number | null>;
};

function fmtNum(v: number | string | null | undefined, digits = 2): string {
  if (v === null || v === undefined) return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
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

export function UpgradeStudio() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<PlayerHit[]>([]);
  const [target, setTarget] = useState<PlayerHit | null>(null);
  const [buckets, setBuckets] = useState<string[]>([]);
  const [bucket, setBucket] = useState("");
  const [topN, setTopN] = useState(20);
  const [weightVersion, setWeightVersion] = useState("v1_manual");
  const [fitFloor, setFitFloor] = useState("70");
  const [minPositiveMetrics, setMinPositiveMetrics] = useState("2");
  const [minPositiveTopMetrics, setMinPositiveTopMetrics] = useState("1");
  const [subposBonusWeight, setSubposBonusWeight] = useState("0.15");
  const [rows, setRows] = useState<UpgradeRow[]>([]);
  const [targetSummary, setTargetSummary] = useState<TargetSummary | null>(null);
  const [comparisonMetrics, setComparisonMetrics] = useState<ComparisonMetric[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const snap = loadUpgradeStudioSnapshot();
    if (snap) {
      setQ(snap.q ?? "");
      setTarget(snap.target);
      setBuckets(snap.buckets ?? []);
      setBucket(snap.bucket ?? "");
      setTopN(snap.topN ?? 20);
      setWeightVersion(snap.weightVersion ?? "v1_manual");
      setFitFloor(snap.fitFloor ?? "70");
      setMinPositiveMetrics(snap.minPositiveMetrics ?? "2");
      setMinPositiveTopMetrics(snap.minPositiveTopMetrics ?? "1");
      setSubposBonusWeight(snap.subposBonusWeight ?? "0.15");
      setRows((snap.rows ?? []) as UpgradeRow[]);
      setTargetSummary(snap.targetSummary);
      setComparisonMetrics(snap.comparisonMetrics ?? []);
    }
    setHydrated(true);
  }, []);

  const persist = useCallback(() => {
    if (!hydrated) return;
    setLastStudio("upgrade");
    saveUpgradeStudioSnapshot({
      q,
      target,
      buckets,
      bucket,
      topN,
      weightVersion,
      fitFloor,
      minPositiveMetrics,
      minPositiveTopMetrics,
      subposBonusWeight,
      rows: rows as unknown as StoredUpgradeRow[],
      targetSummary,
      comparisonMetrics,
    });
  }, [hydrated, q, target, buckets, bucket, topN, weightVersion, fitFloor, minPositiveMetrics, minPositiveTopMetrics, subposBonusWeight, rows, targetSummary, comparisonMetrics]);
  useEffect(() => {
    persist();
  }, [persist]);

  useEffect(() => {
    const qn = q.trim();
    if (qn.length < 2 || (target && qn === target.player_name.trim())) {
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
    }, 250);
    return () => clearTimeout(t);
  }, [q, target]);

  const selectPlayer = useCallback(async (p: PlayerHit) => {
    setTarget(p);
    setQ(p.player_name);
    setHits([]);
    setRows([]);
    setTargetSummary(null);
    setComparisonMetrics([]);
    try {
      const res = await fetch(`/api/players/buckets?player_id=${encodeURIComponent(p.player_id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Buckets failed");
      const b: string[] = data.buckets ?? [];
      setBuckets(b);
      setBucket(b[0] ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Buckets failed");
    }
  }, []);

  const runUpgrade = useCallback(async () => {
    if (!target || !bucket) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_player_id: target.player_id,
          selected_bucket: bucket,
          top_n: topN,
          weight_version: weightVersion,
          fit_floor: Number(fitFloor),
          min_positive_metrics: Number(minPositiveMetrics),
          min_positive_top_metrics: Number(minPositiveTopMetrics),
          subpos_bonus_weight: Number(subposBonusWeight),
          comparison_metrics: 8,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upgrade failed");
      setRows(data.rows ?? []);
      setTargetSummary(data.targetSummary ?? null);
      setComparisonMetrics(data.comparisonMetrics ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upgrade failed");
    } finally {
      setLoading(false);
    }
  }, [target, bucket, topN, weightVersion, fitFloor, minPositiveMetrics, minPositiveTopMetrics, subposBonusWeight]);

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-8 px-4 py-10">
      <header className="space-y-2">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Studio · Upgrade</p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Substitutos (upgrade positivo)</h1>
      </header>
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}

      <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">1. Jogador alvo</h2>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Pesquisar por nome…"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
        />
        {hits.length > 0 ? (
          <ul className="max-h-56 overflow-auto rounded-lg border border-zinc-200 bg-white py-1 text-sm">
            {hits.map((p) => (
              <li key={p.player_id}>
                <button type="button" className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-zinc-100" onClick={() => void selectPlayer(p)}>
                  <span className="font-medium">{p.player_name}</span>
                  {p.last_club ? <span className="text-xs text-zinc-500">{p.last_club}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">2. Configuração</h2>
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex min-w-[10rem] flex-col gap-1 text-xs font-medium">Bucket
            <select value={bucket} onChange={(e) => setBucket(e.target.value)} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm">
              {buckets.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </label>
          <label className="flex w-24 flex-col gap-1 text-xs font-medium">Top N
            <input type="number" min={1} max={100} value={topN} onChange={(e) => setTopN(Number(e.target.value))} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
          </label>
          <label className="flex w-28 flex-col gap-1 text-xs font-medium">Fit floor
            <input type="number" min={1} max={99} value={fitFloor} onChange={(e) => setFitFloor(e.target.value)} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
          </label>
          <label className="flex w-32 flex-col gap-1 text-xs font-medium">Métricas +
            <input type="number" min={1} max={20} value={minPositiveMetrics} onChange={(e) => setMinPositiveMetrics(e.target.value)} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
          </label>
          <label className="flex w-36 flex-col gap-1 text-xs font-medium">Top métricas +
            <input type="number" min={0} max={4} value={minPositiveTopMetrics} onChange={(e) => setMinPositiveTopMetrics(e.target.value)} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
          </label>
          <label className="flex w-32 flex-col gap-1 text-xs font-medium">Bónus subpos
            <input type="number" min={0} max={0.3} step={0.01} value={subposBonusWeight} onChange={(e) => setSubposBonusWeight(e.target.value)} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
          </label>
          <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs font-medium">Versão pesos
            <input type="text" value={weightVersion} onChange={(e) => setWeightVersion(e.target.value)} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
          </label>
          <button type="button" onClick={() => void runUpgrade()} disabled={!target || !bucket || loading} className="h-[42px] rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white disabled:opacity-50">
            {loading ? "A calcular..." : "Calcular Upgrade"}
          </button>
        </div>
      </section>

      {targetSummary ? (
        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-3 text-sm font-semibold">Alvo · resumo</h2>
          <div className="flex flex-wrap gap-6 text-sm">
            <span>Clube <b>{targetSummary.last_club ?? "—"}</b></span>
            <span>Idade <b>{targetSummary.age_last_season ?? "—"}</b></span>
            <span>VM <b>{fmtMarketValue(targetSummary.market_value_eur ?? null, targetSummary.market_value_text ?? null)}</b></span>
          </div>
        </section>
      ) : null}

      {rows.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[68rem] text-left text-sm">
              <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-3">#</th><th className="px-3 py-3">Jogador</th><th className="px-3 py-3">Clube</th><th className="px-3 py-3">VM</th><th className="px-3 py-3">Idade</th>
                  <th className="px-3 py-3">Upgrade</th><th className="px-3 py-3">Fit</th><th className="px-3 py-3">Raw</th><th className="px-3 py-3">Key bonus</th><th className="px-3 py-3">Subpos</th><th className="px-3 py-3">Métricas+</th><th className="px-3 py-3">Top+</th>
                  {comparisonMetrics.map((m) => <th key={m.column} className="px-2 py-3 normal-case">{m.label}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((r) => (
                  <tr key={String(r.player_id)}>
                    <td className="px-3 py-2.5">{String(r.upgrade_rank)}</td>
                    <td className="px-3 py-2.5 font-medium">
                      <Link href={`/studio/players/${encodeURIComponent(String(r.player_id))}`} onPointerDown={persist} className="underline decoration-zinc-300 underline-offset-2">{r.player_name}</Link>
                    </td>
                    <td className="px-3 py-2.5 text-xs">{r.last_club ?? "—"}</td>
                    <td className="px-3 py-2.5 text-xs">{fmtMarketValue(r.market_value_eur ?? null, r.market_value_text ?? null)}</td>
                    <td className="px-3 py-2.5 text-xs">{r.age_last_season ?? "—"}</td>
                    <td className="px-3 py-2.5 tabular-nums font-semibold">{fmtNum(r.upgrade_score)}</td>
                    <td className="px-3 py-2.5 tabular-nums">{fmtNum(r.fit_now_score)}</td>
                    <td className="px-3 py-2.5 tabular-nums">{fmtNum(r.upgrade_raw, 4)}</td>
                    <td className="px-3 py-2.5 tabular-nums">{fmtNum(r.key_upgrade_bonus)}</td>
                    <td className="px-3 py-2.5 tabular-nums">{fmtNum(r.sub_position_bonus)}</td>
                    <td className="px-3 py-2.5 tabular-nums">{fmtNum(r.positive_metrics_count, 0)}</td>
                    <td className="px-3 py-2.5 tabular-nums">{fmtNum(r.positive_top_metrics_count, 0)}</td>
                    {comparisonMetrics.map((m) => (
                      <td key={m.column} className="px-2 py-2.5 text-xs tabular-nums">{fmtNum(r.metric_vals?.[m.column], 3)}</td>
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

