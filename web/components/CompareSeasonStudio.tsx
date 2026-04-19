"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type MetricOpt = { column: string; label: string; weight: number };

type LeaderRow = {
  rank: number;
  player_id: string;
  player_name: string | null;
  last_club: string | null;
  age_last_season: number | null;
  position_text: string | null;
  played_positions_short: string | null;
  market_value_eur: string | null;
  market_value_text: string | null;
  league_name: string;
  minutes_played: number;
  raw_season: number;
  league_strength_coefficient: number;
  adjusted_season: number;
  score_01: number;
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

export function CompareSeasonStudio() {
  const [buckets, setBuckets] = useState<string[]>([]);
  const [bucket, setBucket] = useState("");
  const [weightVersion, setWeightVersion] = useState("v1_manual");
  const [minMinutes, setMinMinutes] = useState(900);
  const [strictDimTokens, setStrictDimTokens] = useState(true);

  const [metrics, setMetrics] = useState<MetricOpt[]>([]);
  const [metricColumn, setMetricColumn] = useState("");

  const [seasonSlug, setSeasonSlug] = useState<string | null>(null);
  const [metricLabel, setMetricLabel] = useState<string | null>(null);
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [count, setCount] = useState<number | null>(null);

  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [loadingRank, setLoadingRank] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/position-buckets");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Buckets failed");
        if (cancelled) return;
        const b: string[] = data.buckets ?? [];
        setBuckets(b);
        setBucket((prev) => (prev === "" && b[0] ? b[0] : prev));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Buckets failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!bucket) {
      setMetrics([]);
      setMetricColumn("");
      return;
    }
    let cancelled = false;
    setLoadingMetrics(true);
    setError(null);
    void (async () => {
      try {
        const q = new URLSearchParams({
          position_bucket: bucket,
          weight_version: weightVersion,
        });
        const res = await fetch(`/api/player-season-leaderboard?${q.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Métricas failed");
        if (cancelled) return;
        const m: MetricOpt[] = data.metrics ?? [];
        setMetrics(m);
        setMetricColumn((prev) => {
          if (prev && m.some((x) => x.column === prev)) return prev;
          return m[0]?.column ?? "";
        });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Métricas failed");
      } finally {
        if (!cancelled) setLoadingMetrics(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bucket, weightVersion]);

  const runRank = useCallback(async () => {
    if (!bucket || !metricColumn) return;
    setLoadingRank(true);
    setError(null);
    setRows([]);
    setCount(null);
    setSeasonSlug(null);
    setMetricLabel(null);
    try {
      const res = await fetch("/api/player-season-leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          position_bucket: bucket,
          metric_column: metricColumn,
          weight_version: weightVersion,
          min_minutes: minMinutes,
          strict_dim_tokens: strictDimTokens,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ranking failed");
      setRows(data.rows ?? []);
      setCount(typeof data.count === "number" ? data.count : (data.rows?.length ?? 0));
      setSeasonSlug(data.season_slug ?? null);
      setMetricLabel(data.metric_label ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ranking failed");
    } finally {
      setLoadingRank(false);
    }
  }, [bucket, metricColumn, weightVersion, minMinutes, strictDimTokens]);

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-4 py-10">
      <header className="space-y-2">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Studio · Big 5 · época</p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Ranking por posição e métrica
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Last season in <code className="text-[11px]">mart.player_pool_clean_tbl</code>,{" "}
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            Premier League, La Liga, Serie A, Bundesliga and Ligue 1
          </span>
          , configurable minimum minutes. By default only players with the correct token in{" "}
          <code className="text-[11px]">played_positions_short</code> (e.g. AM, CAM) are included, to avoid mixing with the L4L
          expansion in <code className="text-[11px]">player_position_membership</code> (which can place centre-backs in AM).
          Select a <span className="font-medium">bucket</span> and a <span className="font-medium">metric</span>:
          all eligible players appear with the raw seasonal value,
          value adjusted by <code className="text-[11px]">league_strength_coefficient</code> (as in the profile pipeline,
          except pct/rate columns) and a <span className="font-medium">score 0–1</span> by min–max in the group (best =
          1).
        </p>
      </header>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-100">
          {error}
        </div>
      ) : null}

      <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Configuration</h2>
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Position (bucket)
            <select
              value={bucket}
              onChange={(e) => setBucket(e.target.value)}
              disabled={buckets.length === 0}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              {buckets.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[14rem] flex-[1.2] flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Metric
            <select
              value={metricColumn}
              onChange={(e) => setMetricColumn(e.target.value)}
              disabled={loadingMetrics || metrics.length === 0}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              {metrics.map((m) => (
                <option key={m.column} value={m.column}>
                  {m.label} (weight {(m.weight * 100).toFixed(1)}%)
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Weight version
            <input
              type="text"
              value={weightVersion}
              onChange={(e) => setWeightVersion(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </label>
          <label className="flex w-28 flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Min. minutes
            <input
              type="number"
              min={1}
              max={4000}
              value={minMinutes}
              onChange={(e) => setMinMinutes(Number(e.target.value))}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </label>
          <label className="flex max-w-[16rem] cursor-pointer items-center gap-2 pt-6 text-xs text-zinc-600 dark:text-zinc-400">
            <input
              type="checkbox"
              checked={strictDimTokens}
              onChange={(e) => setStrictDimTokens(e.target.checked)}
              className="rounded border-zinc-300"
            />
            <span>
              Filter by dim tokens (excludes L4L expansion)
            </span>
          </label>
          <button
            type="button"
            onClick={() => void runRank()}
            disabled={!bucket || !metricColumn || loadingRank}
            className="h-[42px] rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            {loadingRank ? "Calculating…" : "Generate ranking"}
          </button>
        </div>
        {loadingMetrics ? (
          <p className="text-xs text-zinc-500">Loading bucket metrics…</p>
        ) : null}
      </section>

      {seasonSlug !== null && metricLabel !== null && count !== null ? (
        <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
          Season <span className="font-semibold text-zinc-900 dark:text-zinc-100">{seasonSlug}</span>
          {" · "}
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">{metricLabel}</span>
          {" · "}
          <span className="tabular-nums">{count}</span> players
        </p>
      ) : null}

      {rows.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-3 py-3">#</th>
                  <th className="px-3 py-3">Player</th>
                  <th className="px-3 py-3">Club</th>
                  <th className="px-3 py-3">Liga</th>
                  <th className="px-3 py-3">Min</th>
                  <th className="px-3 py-3">Idade</th>
                  <th className="px-3 py-3">VM</th>
                  <th className="px-3 py-3">Bruto época</th>
                  <th className="px-3 py-3">Coef. liga</th>
                  <th className="px-3 py-3">Ajustado</th>
                  <th className="px-3 py-3">Score 0–1</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {rows.map((r) => (
                  <tr key={r.player_id} className="text-zinc-800 dark:text-zinc-200">
                    <td className="px-3 py-2 tabular-nums text-zinc-500">{r.rank}</td>
                    <td className="px-3 py-2 font-medium">
                      <Link
                        href={`/studio/players/${encodeURIComponent(r.player_id)}`}
                        className="text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-600 dark:text-zinc-100"
                      >
                        {r.player_name ?? r.player_id}
                      </Link>
                    </td>
                    <td className="max-w-[9rem] truncate px-3 py-2 text-xs">{r.last_club ?? "—"}</td>
                    <td className="max-w-[7rem] truncate px-3 py-2 text-xs">{r.league_name || "—"}</td>
                    <td className="px-3 py-2 tabular-nums text-xs">{r.minutes_played}</td>
                    <td className="px-3 py-2 tabular-nums text-xs">{r.age_last_season ?? "—"}</td>
                    <td className="px-3 py-2 text-xs tabular-nums">
                      {fmtMarketValue(r.market_value_eur, r.market_value_text)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-xs">{fmtNum(r.raw_season)}</td>
                    <td className="px-3 py-2 tabular-nums text-xs">{fmtNum(r.league_strength_coefficient, 4)}</td>
                    <td className="px-3 py-2 tabular-nums text-xs font-medium text-zinc-900 dark:text-zinc-100">
                      {fmtNum(r.adjusted_season)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      {fmtNum(r.score_01, 4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {!loadingRank && seasonSlug !== null && rows.length === 0 && count === 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          No players with a numeric value for this metric in the pool (or missing data). Try another metric.
        </p>
      ) : null}
    </div>
  );
}
