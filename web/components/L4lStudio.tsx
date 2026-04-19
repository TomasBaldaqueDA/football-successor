"use client";

import Link from "next/link";
import {
  loadL4lStudioSnapshot,
  saveL4lStudioSnapshot,
  type StoredL4lRow,
} from "@/lib/l4lStudioStorage";
import { setLastStudio } from "@/lib/studioNav";
import { useCallback, useEffect, useState } from "react";
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
      setError("Invalid minimum age.");
      return;
    }
    if (maxAge.trim() !== "" && !Number.isFinite(maxN)) {
      setError("Invalid maximum age.");
      return;
    }
    if (minN !== null && maxN !== null && minN > maxN) {
      setError("Minimum age cannot be greater than maximum.");
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
    <StudioPage>
      <StudioInner>
        {/* Header */}
        <StudioHeader
          section="Studio · Like-for-Like"
          title="Similar Profile Substitutes"
          description={
            <>
              Select the target player and the <span className="font-medium">bucket</span> (role). The stat columns
              are the most relevant for that role (weight × target value in the{" "}
              <code
                className="rounded px-1 py-0.5 text-xs"
                style={{ background: "rgba(255,255,255,0.08)" }}
              >
                *_adj_merged
              </code>
              ).
            </>
          }
        />

        {/* Error banner */}
        {error ? <ErrorBanner message={error} /> : null}

        {/* Step 1 — Jogador alvo */}
        <Card>
          <SectionLabel step={1}>Target player</SectionLabel>
          <div className="relative">
            <SearchInput
              value={q}
              onChange={setQ}
              placeholder="Search by name (min. 2 chars)…"
              loading={searching}
            />
            <SearchDropdown
              hits={hits}
              onSelect={(p) => void selectPlayer(p)}
            />
          </div>
          {target ? (
            <div className="mt-3">
              <SelectedBadge name={target.player_name} id={target.player_id} />
            </div>
          ) : null}
        </Card>

        {/* Step 2 — Papel (bucket) */}
        <Card>
          <SectionLabel step={2}>Role (bucket)</SectionLabel>
          <p className="mb-4 text-xs" style={{ color: "#8B949E" }}>
            Age filter applies only to <span className="font-medium">candidates</span>, using{" "}
            <code className="text-[11px]">age_last_season</code> in <code className="text-[11px]">player_dim</code>.
            Empty = no limit. Players without age in dim are excluded if a range is set.
          </p>

          {loadingBuckets ? (
            <p className="text-sm" style={{ color: "#8B949E" }}>Loading buckets…</p>
          ) : target && buckets.length === 0 ? (
            <WarnBanner>
              Este jogador não tem buckets em{" "}
              <code className="text-xs">player_position_membership</code>.
            </WarnBanner>
          ) : (
            <div className="flex flex-wrap items-end gap-4">
              <FieldLabel label="Bucket">
                <Select
                  value={bucket}
                  onChange={setBucket}
                  disabled={!target || buckets.length === 0}
                >
                  {buckets.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
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
                  placeholder="—"
                  min={15}
                  max={45}
                  disabled={!target || buckets.length === 0}
                />
              </FieldLabel>

              <FieldLabel label="Max age">
                <Input
                  type="number"
                  value={maxAge}
                  onChange={setMaxAge}
                  placeholder="—"
                  min={15}
                  max={45}
                  disabled={!target || buckets.length === 0}
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
                onClick={() => void runL4l()}
                disabled={!target || !bucket || loadingL4l}
                variant="primary"
              >
                {loadingL4l ? "Calculating…" : "Calculate ranking"}
              </Button>
            </div>
          )}
        </Card>

        {/* Target summary */}
        {targetSummary && comparisonMetrics.length > 0 ? (
          <Card>
            <SectionLabel>Target · summary</SectionLabel>
            <StatRow
              items={[
                { label: "Club", value: targetSummary.last_club ?? "—" },
                {
                  label: "Market value (TM)",
                  value: fmtMarketValue(
                    targetSummary.market_value_eur ?? null,
                    targetSummary.market_value_text ?? null
                  ),
                },
                { label: "Age", value: String(targetSummary.age_last_season ?? "—") },
                { label: "Country", value: targetSummary.nationality_code ?? "—" },
                { label: "Pos.", value: targetSummary.position_text ?? "—" },
                { label: "Tokens", value: targetSummary.played_positions_short ?? "—" },
                {
                  label: "Cm / kg",
                  value: `${targetSummary.height_cm ?? "—"} / ${targetSummary.weight_kg ?? "—"}`,
                },
              ]}
            />
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {comparisonMetrics.map((m) => (
                <MetricCard
                  key={m.column}
                  label={`${m.label} (${fmtWeight(m.weight)})`}
                  value={fmtNum(m.target)}
                />
              ))}
            </div>
          </Card>
        ) : null}

        {/* Empty results warning */}
        {!loadingL4l && targetSummary && comparisonMetrics.length > 0 && rows.length === 0 ? (
          <WarnBanner>
            No candidates in ranking. Check bucket membership or L4L function rules. Target summary is above.
          </WarnBanner>
        ) : null}

        {/* Results table */}
        {rows.length > 0 ? (
          <Card noPad>
            <div
              className="border-b px-5 py-3"
              style={{ borderColor: "rgba(255,255,255,0.08)" }}
            >
              <SectionLabel step={3}>Results</SectionLabel>
              <p className="text-xs" style={{ color: "#8B949E" }}>
                Metric columns: same scale as the target (<code className="text-[11px]">adj merged</code>).
                Subtitle in each header = target value.
              </p>
            </div>
            <DataTable>
              <THead>
                <TH>#</TH>
                <TH>Player</TH>
                <TH>Club</TH>
                <TH>MV</TH>
                <TH>Age</TH>
                <TH>Country</TH>
                <TH className="min-w-[8rem]">Pos. tokens</TH>
                <TH>L2</TH>
                <TH>Score</TH>
                {comparisonMetrics.map((m) => (
                  <TH key={m.column} className="min-w-[6.5rem] normal-case">
                    <div className="leading-tight">
                      <span style={{ color: "#E6EDF3" }} className="font-semibold">{m.label}</span>
                      <div className="mt-1 text-[10px] font-normal normal-case" style={{ color: "#8B949E" }}>
                        target {fmtNum(m.target)}
                      </div>
                    </div>
                  </TH>
                ))}
              </THead>
              <TBody>
                {rows.map((r) => (
                  <TR key={String(r.player_id)}>
                    <TD className="tabular-nums text-xs" style={{ color: "#8B949E" }}>
                      {String(r.l4l_rank)}
                    </TD>
                    <TD className="font-medium">
                      <PlayerLink
                        href={`/studio/players/${encodeURIComponent(String(r.player_id))}`}
                        name={r.player_name}
                        onPointerDown={flushSnapshotToStorage}
                      />
                    </TD>
                    <TD className="max-w-[10rem] truncate text-xs">{r.last_club ?? "—"}</TD>
                    <TD className="max-w-[5rem] truncate text-xs tabular-nums">
                      {fmtMarketValue(r.market_value_eur ?? null, r.market_value_text ?? null)}
                    </TD>
                    <TD className="tabular-nums text-xs">{r.age_last_season ?? "—"}</TD>
                    <TD className="text-xs">{r.nationality_code ?? "—"}</TD>
                    <TD className="max-w-[10rem] truncate font-mono text-[10px]" style={{ color: "#8B949E" }}>
                      {r.played_positions_short ?? "—"}
                    </TD>
                    <TD className="tabular-nums text-xs">{fmtNum(r.l2_distance)}</TD>
                    <TD className="tabular-nums text-xs">{fmtNum(r.l4l_score, 2)}</TD>
                    {comparisonMetrics.map((m) => (
                      <TD key={m.column} className="text-xs tabular-nums">
                        {fmtNum(r.metric_vals?.[m.column])}
                      </TD>
                    ))}
                  </TR>
                ))}
              </TBody>
            </DataTable>
          </Card>
        ) : null}
      </StudioInner>
    </StudioPage>
  );
}
