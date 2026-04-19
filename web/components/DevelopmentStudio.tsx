"use client";

import { useCallback, useEffect, useState } from "react";
import { setLastStudio } from "@/lib/studioNav";
import {
  loadDevelopmentStudioSnapshot,
  saveDevelopmentStudioSnapshot,
  type StoredDevelopmentRow,
} from "@/lib/developmentStudioStorage";
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

type DevelopmentRow = {
  development_rank: number | string;
  player_id: number | string;
  player_name: string;
  development_score: number | string;
  fit_now_score: number | string;
  upside_score: number | string;
  trajectory_score: number | string;
  readiness_score: number | string;
  readiness_bucket: string;
  development_gap_to_target: number | string;
  minutes_played: number | string;
  last_club?: string | null;
  nationality_code?: string | null;
  age_last_season?: number | null;
  played_positions_short?: string | null;
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

function fmtNum(v: number | string | null | undefined, digits = 2): string {
  if (v === null || v === undefined) return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

function fmtWeight(w: number): string {
  if (!Number.isFinite(w)) return "";
  return `${(w * 100).toFixed(1)}%`;
}

export function DevelopmentStudio() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<PlayerHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [target, setTarget] = useState<PlayerHit | null>(null);
  const [buckets, setBuckets] = useState<string[]>([]);
  const [bucket, setBucket] = useState("");
  const [topN, setTopN] = useState(20);
  const [minAge, setMinAge] = useState("15");
  const [maxAge, setMaxAge] = useState("22");
  const [cbMaxAge, setCbMaxAge] = useState("23");
  const [weightVersion, setWeightVersion] = useState("v1_manual");
  const [rows, setRows] = useState<DevelopmentRow[]>([]);
  const [targetSummary, setTargetSummary] = useState<TargetSummary | null>(null);
  const [comparisonMetrics, setComparisonMetrics] = useState<ComparisonMetric[]>([]);
  const [loadingBuckets, setLoadingBuckets] = useState(false);
  const [loadingDevelopment, setLoadingDevelopment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const snap = loadDevelopmentStudioSnapshot();
    if (snap) {
      setQ(snap.q ?? "");
      setTarget(snap.target);
      setBuckets(snap.buckets ?? []);
      setBucket(snap.bucket ?? "");
      setTopN(snap.topN ?? 20);
      setMinAge(snap.minAge ?? "15");
      setMaxAge(snap.maxAge ?? "22");
      setCbMaxAge(snap.cbMaxAge ?? "23");
      setWeightVersion(snap.weightVersion ?? "v1_manual");
      setRows((snap.rows ?? []) as DevelopmentRow[]);
      setTargetSummary(snap.targetSummary);
      setComparisonMetrics(snap.comparisonMetrics ?? []);
      setError(null);
    }
    setHydrated(true);
  }, []);

  const flushSnapshotToStorage = useCallback(() => {
    if (typeof window === "undefined" || !hydrated) return;
    setLastStudio("development");
    saveDevelopmentStudioSnapshot({
      q,
      target,
      buckets,
      bucket,
      topN,
      minAge,
      maxAge,
      cbMaxAge,
      weightVersion,
      rows: rows as unknown as StoredDevelopmentRow[],
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
    cbMaxAge,
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

  const runDevelopment = useCallback(async () => {
    if (!target || !bucket) return;
    const minAgeN = Number(minAge);
    const maxAgeN = Number(maxAge);
    const cbMaxAgeN = Number(cbMaxAge);
    if (![minAgeN, maxAgeN, cbMaxAgeN].every((n) => Number.isFinite(n))) {
      setError("Invalid parameters (age).");
      return;
    }
    if (minAgeN > maxAgeN) {
      setError("Minimum age cannot be greater than maximum.");
      return;
    }
    setLoadingDevelopment(true);
    setError(null);
    setRows([]);
    setTargetSummary(null);
    setComparisonMetrics([]);
    try {
      const res = await fetch("/api/development", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_player_id: target.player_id,
          selected_bucket: bucket,
          top_n: topN,
          weight_version: weightVersion,
          comparison_metrics: 8,
          min_age: Math.round(minAgeN),
          max_age: Math.round(maxAgeN),
          cb_max_age: Math.round(cbMaxAgeN),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Development failed");
      setRows(data.rows ?? []);
      setTargetSummary(data.targetSummary ?? null);
      setComparisonMetrics(data.comparisonMetrics ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Development failed");
    } finally {
      setLoadingDevelopment(false);
    }
  }, [target, bucket, topN, weightVersion, minAge, maxAge, cbMaxAge]);

  return (
    <StudioPage>
      <StudioInner>
        {/* Header */}
        <StudioHeader
          section="Studio · Development"
          title="Development & Projection"
          description="Find players with the highest growth potential in the target's role."
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

              <FieldLabel label="Min age">
                <Input
                  type="number"
                  value={minAge}
                  onChange={setMinAge}
                  min={10}
                  max={30}
                />
              </FieldLabel>

              <FieldLabel label="Max age">
                <Input
                  type="number"
                  value={maxAge}
                  onChange={setMaxAge}
                  min={10}
                  max={30}
                />
              </FieldLabel>

              <FieldLabel label="CB máx">
                <Input
                  type="number"
                  value={cbMaxAge}
                  onChange={setCbMaxAge}
                  min={10}
                  max={35}
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
                onClick={() => void runDevelopment()}
                disabled={!target || !bucket || loadingDevelopment}
              >
                {loadingDevelopment ? "Calculating…" : "Calculate Development"}
              </Button>
            </div>
          )}
        </Card>

        {/* Warn when no results after run */}
        {!loadingDevelopment && rows.length === 0 && target && bucket && (
          <WarnBanner>No results found. Try adjusting the age filters or bucket.</WarnBanner>
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
                    label={`${m.label} (${fmtWeight(m.weight)})`}
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
              <SectionLabel>Results · Development</SectionLabel>
            </div>
            <DataTable>
              <THead>
                <TH>#</TH>
                <TH>Player</TH>
                <TH>MV</TH>
                <TH>Club</TH>
                <TH>Age</TH>
                <TH>Pos.</TH>
                <TH>Dev Score</TH>
                <TH>Fit Now</TH>
                <TH>Upside</TH>
                <TH>Trajectory</TH>
                <TH>Readiness</TH>
                <TH>Dev Gap</TH>
                <TH>Minutes</TH>
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
                      {String(r.development_rank)}
                    </TD>
                    <TD>
                      <PlayerLink
                        href={`/studio/players/${encodeURIComponent(String(r.player_id))}`}
                        name={r.player_name}
                        onPointerDown={flushSnapshotToStorage}
                      />
                    </TD>
                    <TD className="text-xs">{fmtMarketValue(r.market_value_eur ?? null, r.market_value_text ?? null)}</TD>
                    <TD className="text-xs">{r.last_club ?? "—"}</TD>
                    <TD className="text-xs tabular-nums">{r.age_last_season ?? "—"}</TD>
                    <TD className="text-xs">
                      {r.played_positions_short?.trim()
                        ? r.played_positions_short.trim().split(",").map((pos) => (
                            <span
                              key={pos}
                              className="mr-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium"
                              style={{ background: "rgba(0,201,167,0.12)", color: "#00C9A7" }}
                            >
                              {pos.trim()}
                            </span>
                          ))
                        : "—"}
                    </TD>
                    <TD className="text-xs tabular-nums font-semibold">{fmtNum(r.development_score)}</TD>
                    <TD className="text-xs tabular-nums">{fmtNum(r.fit_now_score)}</TD>
                    <TD className="text-xs tabular-nums">{fmtNum(r.upside_score)}</TD>
                    <TD className="text-xs tabular-nums">{fmtNum(r.trajectory_score)}</TD>
                    <TD className="text-xs tabular-nums">
                      <span className="mr-1.5">{fmtNum(r.readiness_score)}</span>
                      {r.readiness_bucket && (
                        <span
                          className="inline-block rounded px-1.5 py-0.5 text-[10px] font-medium"
                          style={{ background: "rgba(255,213,79,0.12)", color: "#FFD54F" }}
                        >
                          {r.readiness_bucket}
                        </span>
                      )}
                    </TD>
                    <TD className="text-xs tabular-nums">{fmtNum(r.development_gap_to_target)}</TD>
                    <TD className="text-xs tabular-nums">{fmtNum(r.minutes_played, 0)}</TD>
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
