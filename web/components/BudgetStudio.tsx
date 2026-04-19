"use client";

import { useCallback, useEffect, useState } from "react";
import { setLastStudio } from "@/lib/studioNav";
import {
  loadBudgetStudioSnapshot,
  saveBudgetStudioSnapshot,
  type StoredBudgetRow,
} from "@/lib/budgetStudioStorage";
import {
  StudioPage,
  StudioInner,
  StudioHeader,
  Card,
  SectionLabel,
  ErrorBanner,
  WarnBanner,
  SearchInput,
  SearchDropdown,
  SelectedBadge,
  FieldLabel,
  Select,
  Input,
  Button,
  DataTable,
  THead,
  TH,
  TBody,
  TR,
  TD,
  MetricCard,
  StatRow,
  PlayerLink,
} from "@/components/ui/studio";

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
    label: "Ultra Budget",
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

const PRESET_ORDER: BudgetPreset[] = ["ultra_budget", "conservative", "balanced", "aggressive"];

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
    <StudioPage>
      <StudioInner>
        {/* Header */}
        <StudioHeader
          section="Studio · Budget"
          title="Value for Money"
          description="Find quality substitutes within budget — balancing fit, cost and market depth."
        />

        {/* Error */}
        {error && <ErrorBanner message={error} />}

        {/* Step 1 — Target player */}
        <Card>
          <SectionLabel step={1}>Target player</SectionLabel>
          <div className="relative">
            <SearchInput
              value={q}
              onChange={setQ}
              placeholder="Search by name (min. 2 chars)…"
              loading={searching}
            />
            <SearchDropdown hits={hits} onSelect={(p) => void selectPlayer(p)} />
          </div>
          {target && (
            <div className="mt-3">
              <SelectedBadge name={target.player_name} id={target.player_id} />
            </div>
          )}
        </Card>

        {/* Step 2 — Config */}
        <Card>
          <SectionLabel step={2}>Configuration</SectionLabel>

          {/* Preset pills */}
          <div className="mb-5 flex flex-wrap gap-2">
            {PRESET_ORDER.map((p) => {
              const isActive = preset === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPresetChange(p)}
                  className="rounded-lg border px-4 py-1.5 text-xs font-semibold transition"
                  style={
                    isActive
                      ? { background: "#00C9A7", borderColor: "#00C9A7", color: "#0D1117" }
                      : { background: "transparent", borderColor: "#00C9A7", color: "#00C9A7" }
                  }
                >
                  {PRESET_CONFIG[p].label}
                </button>
              );
            })}
          </div>

          {loadingBuckets ? (
            <p className="text-sm" style={{ color: "#8B949E" }}>Loading buckets…</p>
          ) : (
            <div className="flex flex-wrap items-end gap-4">
              <FieldLabel label="Bucket">
                <Select
                  value={bucket}
                  onChange={setBucket}
                  disabled={!target || buckets.length === 0}
                >
                  {buckets.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </Select>
              </FieldLabel>

              <FieldLabel label="Top N">
                <Input
                  type="number"
                  value={topN}
                  onChange={(v) => setTopN(Number(v))}
                  min={1}
                  max={100}
                />
              </FieldLabel>

              <FieldLabel label="Budget Ratio">
                <Input
                  type="text"
                  value={budgetRatio}
                  onChange={setBudgetRatio}
                />
              </FieldLabel>

              <FieldLabel label="Fit Floor">
                <Input
                  type="text"
                  value={fitFloor}
                  onChange={setFitFloor}
                />
              </FieldLabel>

              <FieldLabel label="League Bonus Weight">
                <Input
                  type="text"
                  value={leagueBonusWeight}
                  onChange={setLeagueBonusWeight}
                />
              </FieldLabel>

              <FieldLabel label="Weight version">
                <Input
                  type="text"
                  value={weightVersion}
                  onChange={setWeightVersion}
                />
              </FieldLabel>

              <Button
                onClick={() => void runBudget()}
                disabled={!target || !bucket || loadingBudget}
              >
                {loadingBudget ? "Calculating…" : "Calculate Budget"}
              </Button>
            </div>
          )}
        </Card>

        {/* Warn when no results after run */}
        {!loadingBudget && rows.length === 0 && target && bucket && (
          <WarnBanner>No results found. Try adjusting the budget ratio or fit floor.</WarnBanner>
        )}

        {/* Target summary */}
        {targetSummary && (
          <Card>
            <SectionLabel>Target · summary</SectionLabel>
            <StatRow
              items={[
                { label: "Player", value: targetSummary.player_name ?? "—" },
                { label: "Club", value: targetSummary.last_club ?? "—" },
                { label: "Age", value: String(targetSummary.age_last_season ?? "—") },
                { label: "MV", value: fmtMarketValue(targetSummary.market_value_eur ?? null, targetSummary.market_value_text ?? null) },
              ]}
            />
            {comparisonMetrics.length > 0 && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {comparisonMetrics.map((m) => (
                  <MetricCard
                    key={m.column}
                    label={m.label}
                    value={fmtNum(m.target, 3)}
                  />
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Results table */}
        {rows.length > 0 && (
          <Card noPad>
            <div
              className="flex items-center justify-between border-b px-5 py-3"
              style={{ borderColor: "rgba(255,255,255,0.08)" }}
            >
              <SectionLabel>Results · Budget</SectionLabel>
            </div>
            <DataTable>
              <THead>
                <TH>#</TH>
                <TH>Player</TH>
                <TH>Club</TH>
                <TH>MV Candidate</TH>
                <TH>MV Target</TH>
                <TH>Saving</TH>
                <TH>Budget Rank</TH>
                <TH>Value for Money</TH>
                <TH>Fit Now</TH>
                <TH>Cost Eff.</TH>
                <TH>Readiness</TH>
                <TH>League Str.</TH>
                {comparisonMetrics.map((m) => (
                  <TH key={m.column} className="min-w-[6rem] normal-case">
                    <div className="leading-tight">
                      <span>{m.label}</span>
                      <div className="mt-0.5 text-[10px] font-normal normal-case" style={{ color: "#8B949E" }}>
                        target {fmtNum(m.target, 3)}
                      </div>
                    </div>
                  </TH>
                ))}
              </THead>
              <TBody>
                {rows.map((r) => (
                  <TR key={String(r.player_id)}>
                    <TD className="tabular-nums text-xs" style={{ color: "#8B949E" }}>
                      {String(r.budget_rank)}
                    </TD>
                    <TD>
                      <PlayerLink
                        href={`/studio/players/${encodeURIComponent(String(r.player_id))}`}
                        name={r.player_name}
                        onPointerDown={flushSnapshotToStorage}
                      />
                    </TD>
                    <TD className="text-xs">{r.last_club ?? "—"}</TD>
                    <TD className="text-xs tabular-nums">
                      {fmtMarketValue(r.candidate_market_value_eur ?? null, null)}
                    </TD>
                    <TD className="text-xs tabular-nums">
                      {fmtMarketValue(r.market_value_eur ?? null, r.market_value_text ?? null)}
                    </TD>
                    <TD className="text-xs tabular-nums">{fmtMarketValue(r.savings_eur ?? null, null)}</TD>
                    <TD className="text-xs tabular-nums" style={{ color: "#8B949E" }}>
                      {String(r.budget_rank)}
                    </TD>
                    <TD className="text-xs tabular-nums font-semibold">{fmtNum(r.value_for_money_score)}</TD>
                    <TD className="text-xs tabular-nums">{fmtNum(r.fit_now_score)}</TD>
                    <TD className="text-xs tabular-nums">{fmtNum(r.cost_efficiency_score)}</TD>
                    <TD className="text-xs tabular-nums">{fmtNum(r.readiness_score)}</TD>
                    <TD className="text-xs tabular-nums">{fmtNum(r.league_strength_score)}</TD>
                    {comparisonMetrics.map((m) => (
                      <TD key={m.column} className="text-xs tabular-nums">
                        {fmtNum(r.metric_vals?.[m.column], 3)}
                      </TD>
                    ))}
                  </TR>
                ))}
              </TBody>
            </DataTable>
          </Card>
        )}
      </StudioInner>
    </StudioPage>
  );
}
