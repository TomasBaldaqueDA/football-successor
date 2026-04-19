"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { setLastStudio } from "@/lib/studioNav";
import {
  loadUpgradeStudioSnapshot,
  saveUpgradeStudioSnapshot,
  type StoredUpgradeRow,
} from "@/lib/upgradeStudioStorage";
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

  const flushSnapshotToStorage = useCallback(() => {
    persist();
  }, [persist]);

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
    <StudioPage>
      <StudioInner>
        <StudioHeader
          section="Studio · Upgrade"
          title="Upgrade Finder"
          description="Identifies players who are a real upgrade over the target."
        />

        {error ? <ErrorBanner message={error} /> : null}

        {/* Step 1 — target player search */}
        <Card>
          <SectionLabel step={1}>Target player</SectionLabel>
          <div className="relative">
            <SearchInput
              value={q}
              onChange={setQ}
              placeholder="Search by name…"
            />
            <SearchDropdown hits={hits} onSelect={(p) => void selectPlayer(p)} />
          </div>
          {target ? (
            <div className="mt-3">
              <SelectedBadge name={target.player_name} id={String(target.player_id)} />
            </div>
          ) : null}
        </Card>

        {/* Step 2 — configuration */}
        <Card>
          <SectionLabel step={2}>Configuration</SectionLabel>
          {!buckets.length && target ? (
            <WarnBanner>No buckets available for this player.</WarnBanner>
          ) : null}
          <div className="flex flex-wrap items-end gap-4 mt-3">
            <FieldLabel label="Bucket">
              <Select value={bucket} onChange={setBucket} disabled={!buckets.length}>
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

            <FieldLabel label="Weight version">
              <Input
                value={weightVersion}
                onChange={setWeightVersion}
              />
            </FieldLabel>

            <FieldLabel label="Fit Floor">
              <Input
                type="number"
                value={fitFloor}
                onChange={setFitFloor}
                min={1}
                max={99}
              />
            </FieldLabel>

            <FieldLabel label="Min Positive Metrics">
              <Input
                type="number"
                value={minPositiveMetrics}
                onChange={setMinPositiveMetrics}
                min={1}
                max={20}
              />
            </FieldLabel>

            <FieldLabel label="Min Positive Top Metrics">
              <Input
                type="number"
                value={minPositiveTopMetrics}
                onChange={setMinPositiveTopMetrics}
                min={0}
                max={4}
              />
            </FieldLabel>

            <FieldLabel label="Subpos Bonus Weight">
              <Input
                type="number"
                value={subposBonusWeight}
                onChange={setSubposBonusWeight}
                min={0}
                max={0.3}
                step={0.01}
              />
            </FieldLabel>

            <Button
              onClick={() => void runUpgrade()}
              disabled={!target || !bucket || loading}
            >
              {loading ? "Calculating..." : "Calculate Upgrade"}
            </Button>
          </div>
        </Card>

        {/* Empty results warning */}
        {!loading && rows.length === 0 && target && (
          <WarnBanner>No results found. Adjust the filters and try again.</WarnBanner>
        )}

        {/* Target summary */}
        {targetSummary ? (
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
            {comparisonMetrics.length > 0 ? (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
                {comparisonMetrics.map((m) => (
                  <MetricCard
                    key={m.column}
                    label={m.label}
                    value={fmtNum(m.target, 3)}
                    sub={`w: ${m.weight.toFixed(3)}`}
                  />
                ))}
              </div>
            ) : null}
          </Card>
        ) : null}

        {/* Results table */}
        {rows.length > 0 ? (
          <Card noPad>
            <div className="px-5 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
              <SectionLabel>Results — {rows.length} players</SectionLabel>
            </div>
            <DataTable>
              <THead>
                <TH>#</TH>
                <TH>Player</TH>
                <TH>Club</TH>
                <TH>MV</TH>
                <TH>Age</TH>
                <TH>Upgrade</TH>
                <TH>Fit</TH>
                <TH>Raw</TH>
                <TH>Key Bonus</TH>
                <TH>Subpos</TH>
                <TH>Metrics+</TH>
                <TH>Top+</TH>
                {comparisonMetrics.map((m) => (
                  <TH key={m.column} className="normal-case">{m.label}</TH>
                ))}
              </THead>
              <TBody>
                {rows.map((r) => (
                  <TR key={String(r.player_id)}>
                    <TD>{String(r.upgrade_rank)}</TD>
                    <TD>
                      <PlayerLink
                        href={`/studio/players/${encodeURIComponent(String(r.player_id))}`}
                        name={r.player_name}
                        onPointerDown={flushSnapshotToStorage}
                      />
                    </TD>
                    <TD className="text-xs">{r.last_club ?? "—"}</TD>
                    <TD className="text-xs">{fmtMarketValue(r.market_value_eur ?? null, r.market_value_text ?? null)}</TD>
                    <TD className="text-xs">{r.age_last_season ?? "—"}</TD>
                    <TD className="tabular-nums font-semibold" style={{ color: "#00C9A7" }}>{fmtNum(r.upgrade_score)}</TD>
                    <TD className="tabular-nums">{fmtNum(r.fit_now_score)}</TD>
                    <TD className="tabular-nums">{fmtNum(r.upgrade_raw, 4)}</TD>
                    <TD className="tabular-nums">{fmtNum(r.key_upgrade_bonus)}</TD>
                    <TD className="tabular-nums">{fmtNum(r.sub_position_bonus)}</TD>
                    <TD className="tabular-nums">{fmtNum(r.positive_metrics_count, 0)}</TD>
                    <TD className="tabular-nums">{fmtNum(r.positive_top_metrics_count, 0)}</TD>
                    {comparisonMetrics.map((m) => (
                      <TD key={m.column} className="text-xs tabular-nums">{fmtNum(r.metric_vals?.[m.column], 3)}</TD>
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
