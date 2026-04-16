"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { setLastStudio } from "@/lib/studioNav";
import {
  loadBudgetStudioSnapshot,
  saveBudgetStudioSnapshot,
  type StoredBudgetRow,
} from "@/lib/budgetStudioStorage";

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
type BudgetRow = {
  budget_rank: number | string;
  player_id: number | string;
  player_name: string;
  value_for_money_score: number | string;
  fit_now_score: number | string;
  cost_efficiency_score: number | string;
  readiness_score: number | string;
  league_strength_score: number | string;
  budget_ratio_to_target: number | string;
  candidate_market_value_eur: number | string;
  savings_eur: number | string;
  minutes_played: number | string;
  last_club?: string | null;
  age_last_season?: number | null;
  market_value_eur?: string | null;
  market_value_text?: string | null;
  metric_vals?: Record<string, number | null>;
};

type BudgetPreset = "ultra_budget" | "conservative" | "balanced" | "aggressive";

const PRESET_CONFIG: Record<
  BudgetPreset,
  { budgetRatio: string; fitFloor: string; leagueBonusWeight: string; label: string }
> = {
  ultra_budget: {
    budgetRatio: "0.075",
    fitFloor: "80",
    leagueBonusWeight: "0.15",
    label: "Ultra Budget (7.5%)",
  },
  conservative: {
    budgetRatio: "0.25",
    fitFloor: "85",
    leagueBonusWeight: "0.20",
    label: "Conservative",
  },
  balanced: {
    budgetRatio: "0.30",
    fitFloor: "80",
    leagueBonusWeight: "0.15",
    label: "Balanced",
  },
  aggressive: {
    budgetRatio: "0.40",
    fitFloor: "75",
    leagueBonusWeight: "0.10",
    label: "Aggressive",
  },
};

function coerceBudgetPreset(value: string | null | undefined): BudgetPreset {
  if (value === "ultra_budget" || value === "conservative" || value === "balanced" || value === "aggressive") {
    return value;
  }
  return "balanced";
}

function fmtMarketValue(eur: string | number | null | undefined, text: string | null | undefined): string {
  if (text != null && String(text).trim() !== "") return String(text).trim();
  if (eur == null || String(eur).trim() === "") return "—";
  const n = Number(eur);
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, "")} M €`;
  if (n >= 1000) return `${Math.round(n / 1000)} k €`;
  return `${n} €`;
}
function fmtNum(v: number | string | null | undefined, digits = 2): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(digits) : "—";
}
function fmtPct(v: number | string | null | undefined): string {
  const n = Number(v);
  return Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : "—";
}

export function BudgetStudio() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<PlayerHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [target, setTarget] = useState<PlayerHit | null>(null);
  const [buckets, setBuckets] = useState<string[]>([]);
  const [bucket, setBucket] = useState("");
  const [topN, setTopN] = useState(20);
  const [preset, setPreset] = useState<BudgetPreset>("balanced");
  const [budgetRatio, setBudgetRatio] = useState(PRESET_CONFIG.balanced.budgetRatio);
  const [fitFloor, setFitFloor] = useState(PRESET_CONFIG.balanced.fitFloor);
  const [leagueBonusWeight, setLeagueBonusWeight] = useState(PRESET_CONFIG.balanced.leagueBonusWeight);
  const [weightVersion, setWeightVersion] = useState("v1_manual");
  const [rows, setRows] = useState<BudgetRow[]>([]);
  const [targetSummary, setTargetSummary] = useState<TargetSummary | null>(null);
  const [comparisonMetrics, setComparisonMetrics] = useState<ComparisonMetric[]>([]);
  const [loadingBuckets, setLoadingBuckets] = useState(false);
  const [loadingBudget, setLoadingBudget] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const snap = loadBudgetStudioSnapshot();
    if (snap) {
      setQ(snap.q ?? "");
      setTarget(snap.target);
      setBuckets(snap.buckets ?? []);
      setBucket(snap.bucket ?? "");
      setTopN(snap.topN ?? 20);
      const presetFromStorage = coerceBudgetPreset(snap.preset);
      setPreset(presetFromStorage);
      setBudgetRatio(snap.budgetRatio ?? PRESET_CONFIG[presetFromStorage].budgetRatio);
      setFitFloor(snap.fitFloor ?? PRESET_CONFIG[presetFromStorage].fitFloor);
      setLeagueBonusWeight(snap.leagueBonusWeight ?? PRESET_CONFIG[presetFromStorage].leagueBonusWeight);
      setWeightVersion(snap.weightVersion ?? "v1_manual");
      setRows((snap.rows ?? []) as BudgetRow[]);
      setTargetSummary(snap.targetSummary);
      setComparisonMetrics(snap.comparisonMetrics ?? []);
    }
    setHydrated(true);
  }, []);

  const flushSnapshotToStorage = useCallback(() => {
    if (typeof window === "undefined" || !hydrated) return;
    setLastStudio("budget");
    saveBudgetStudioSnapshot({
      q, target, buckets, bucket, topN, preset, budgetRatio, fitFloor, leagueBonusWeight, weightVersion,
      rows: rows as unknown as StoredBudgetRow[],
      targetSummary, comparisonMetrics,
    });
  }, [hydrated, q, target, buckets, bucket, topN, preset, budgetRatio, fitFloor, leagueBonusWeight, weightVersion, rows, targetSummary, comparisonMetrics]);

  const onPresetChange = useCallback((nextPreset: BudgetPreset) => {
    setPreset(nextPreset);
    setBudgetRatio(PRESET_CONFIG[nextPreset].budgetRatio);
    setFitFloor(PRESET_CONFIG[nextPreset].fitFloor);
    setLeagueBonusWeight(PRESET_CONFIG[nextPreset].leagueBonusWeight);
  }, []);

  useEffect(() => {
    flushSnapshotToStorage();
  }, [flushSnapshotToStorage]);

  useEffect(() => {
    const qn = q.trim();
    const tn = target?.player_name?.trim() ?? "";
    if (target && tn && qn !== tn) {
      setTarget(null); setBuckets([]); setBucket(""); setRows([]); setTargetSummary(null); setComparisonMetrics([]); setHits([]);
      return;
    }
    if (target && tn && qn === tn) { setHits([]); return; }
    if (qn.length < 2) { setHits([]); return; }
    const t = setTimeout(async () => {
      setSearching(true); setError(null);
      try {
        const res = await fetch(`/api/players/search?q=${encodeURIComponent(qn)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Search failed");
        setHits(data.players ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Search failed");
        setHits([]);
      } finally { setSearching(false); }
    }, 320);
    return () => clearTimeout(t);
  }, [q, target]);

  const selectPlayer = useCallback(async (p: PlayerHit) => {
    setTarget(p); setHits([]); setQ(p.player_name); setBucket("");
    setRows([]); setTargetSummary(null); setComparisonMetrics([]);
    setLoadingBuckets(true); setError(null);
    try {
      const res = await fetch(`/api/players/buckets?player_id=${encodeURIComponent(p.player_id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Buckets failed");
      const b: string[] = data.buckets ?? [];
      setBuckets(b); setBucket(b[0] ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Buckets failed");
      setBuckets([]);
    } finally { setLoadingBuckets(false); }
  }, []);

  const runBudget = useCallback(async () => {
    if (!target || !bucket) return;
    const ratio = Number(budgetRatio);
    const floor = Number(fitFloor);
    const leagueWeight = Number(leagueBonusWeight);
    if (!Number.isFinite(ratio) || !Number.isFinite(floor) || !Number.isFinite(leagueWeight)) {
      setError("Parâmetros inválidos (budget/fit/liga).");
      return;
    }
    setLoadingBudget(true); setError(null); setRows([]); setTargetSummary(null); setComparisonMetrics([]);
    try {
      const res = await fetch("/api/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_player_id: target.player_id,
          selected_bucket: bucket,
          top_n: topN,
          weight_version: weightVersion,
          comparison_metrics: 8,
          budget_ratio: ratio,
          fit_floor: floor,
          league_bonus_weight: leagueWeight,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Budget failed");
      setRows(data.rows ?? []);
      setTargetSummary(data.targetSummary ?? null);
      setComparisonMetrics(data.comparisonMetrics ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Budget failed");
    } finally { setLoadingBudget(false); }
  }, [target, bucket, topN, weightVersion, budgetRatio, fitFloor, leagueBonusWeight]);

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-8 px-4 py-10">
      <header className="space-y-2">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Studio · Budget</p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Substitutos (value for money)</h1>
      </header>
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}

      <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">1. Jogador alvo</h2>
        <div className="relative">
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar por nome…" className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm" />
          {searching ? <span className="absolute right-3 top-2.5 text-xs text-zinc-400">A pesquisar…</span> : null}
          {hits.length > 0 ? (
            <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-zinc-200 bg-white py-1 text-sm shadow-lg">
              {hits.map((p) => (
                <li key={p.player_id}>
                  <button type="button" className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-zinc-100" onClick={() => void selectPlayer(p)}>
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
        <h2 className="text-sm font-semibold text-zinc-900">2. Configuração</h2>
        {loadingBuckets ? <p className="text-sm text-zinc-500">A carregar buckets…</p> : (
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs font-medium text-zinc-600">
              Bucket
              <select value={bucket} onChange={(e) => setBucket(e.target.value)} disabled={!target || buckets.length === 0} className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm">
                {buckets.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </label>
            <label className="flex w-24 flex-col gap-1 text-xs font-medium text-zinc-600">
              Top N
              <input type="number" min={1} max={100} value={topN} onChange={(e) => setTopN(Number(e.target.value))} className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm" />
            </label>
            <label className="flex w-[8rem] flex-col gap-1 text-xs font-medium text-zinc-600">
              Preset
              <select
                value={preset}
                onChange={(e) => onPresetChange(e.target.value as BudgetPreset)}
                className="rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm"
              >
                <option value="ultra_budget">{PRESET_CONFIG.ultra_budget.label}</option>
                <option value="conservative">{PRESET_CONFIG.conservative.label}</option>
                <option value="balanced">{PRESET_CONFIG.balanced.label}</option>
                <option value="aggressive">{PRESET_CONFIG.aggressive.label}</option>
              </select>
            </label>
            <label className="flex w-[6rem] flex-col gap-1 text-xs font-medium text-zinc-600">
              Budget ratio
              <input type="text" value={budgetRatio} readOnly className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-2 text-sm text-zinc-700" />
            </label>
            <label className="flex w-[5rem] flex-col gap-1 text-xs font-medium text-zinc-600">
              Fit floor
              <input type="text" value={fitFloor} readOnly className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-2 text-sm text-zinc-700" />
            </label>
            <label className="flex w-[5.5rem] flex-col gap-1 text-xs font-medium text-zinc-600">
              Liga w
              <input type="text" value={leagueBonusWeight} readOnly className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-2 text-sm text-zinc-700" />
            </label>
            <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs font-medium text-zinc-600">
              Versão pesos
              <input type="text" value={weightVersion} onChange={(e) => setWeightVersion(e.target.value)} className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm" />
            </label>
            <button type="button" onClick={() => void runBudget()} disabled={!target || !bucket || loadingBudget} className="h-[42px] rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white disabled:opacity-50">
              {loadingBudget ? "A calcular…" : "Calcular Budget"}
            </button>
          </div>
        )}
      </section>

      {rows.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 px-5 py-3"><h2 className="text-sm font-semibold text-zinc-900">Resultados · Budget</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[70rem] text-left text-sm">
              <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-3">#</th><th className="px-3 py-3">Jogador</th><th className="px-3 py-3">Clube</th><th className="px-3 py-3">VM</th>
                  <th className="px-3 py-3">Age</th><th className="px-3 py-3">Min</th><th className="px-3 py-3">VFM</th><th className="px-3 py-3">Fit</th><th className="px-3 py-3">Cost</th>
                  <th className="px-3 py-3">Ready</th><th className="px-3 py-3">Liga</th><th className="px-3 py-3">Ratio</th><th className="px-3 py-3">Savings €</th>
                  {comparisonMetrics.map((m) => <th key={m.column} className="min-w-[6rem] px-2 py-3 normal-case">{m.label}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((r) => (
                  <tr key={String(r.player_id)}>
                    <td className="px-3 py-2.5">{String(r.budget_rank)}</td>
                    <td className="px-3 py-2.5 font-medium">
                      <Link href={`/studio/players/${encodeURIComponent(String(r.player_id))}`} onPointerDown={flushSnapshotToStorage} className="underline">
                        {r.player_name}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-xs">{r.last_club ?? "—"}</td>
                    <td className="px-3 py-2.5 text-xs">{fmtMarketValue(r.market_value_eur ?? null, r.market_value_text ?? null)}</td>
                    <td className="px-3 py-2.5 text-xs tabular-nums">{r.age_last_season ?? "—"}</td>
                    <td className="px-3 py-2.5 text-xs tabular-nums">{fmtNum(r.minutes_played, 0)}</td>
                    <td className="px-3 py-2.5 text-xs tabular-nums font-semibold">{fmtNum(r.value_for_money_score)}</td>
                    <td className="px-3 py-2.5 text-xs tabular-nums">{fmtNum(r.fit_now_score)}</td>
                    <td className="px-3 py-2.5 text-xs tabular-nums">{fmtNum(r.cost_efficiency_score)}</td>
                    <td className="px-3 py-2.5 text-xs tabular-nums">{fmtNum(r.readiness_score)}</td>
                    <td className="px-3 py-2.5 text-xs tabular-nums">{fmtNum(r.league_strength_score)}</td>
                    <td className="px-3 py-2.5 text-xs tabular-nums">{fmtPct(r.budget_ratio_to_target)}</td>
                    <td className="px-3 py-2.5 text-xs tabular-nums">{fmtNum(r.savings_eur, 0)}</td>
                    {comparisonMetrics.map((m) => <td key={m.column} className="px-2 py-2.5 text-xs tabular-nums">{fmtNum(r.metric_vals?.[m.column], 3)}</td>)}
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

