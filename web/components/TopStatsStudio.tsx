"use client";

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
    <StudioPage>
      <StudioInner>
        <StudioHeader
          section="Studio · Top Stats"
          title="Top Stats por Bucket"
          description="The metrics where the player is strongest, weighted by bucket."
        />

        {error ? <ErrorBanner message={error} /> : null}

        {/* Step 1 — player search */}
        <Card>
          <SectionLabel step={1}>Player</SectionLabel>
          <div className="relative">
            <SearchInput
              value={q}
              onChange={setQ}
              placeholder="Search by name (min. 2 chars)..."
            />
            <SearchDropdown hits={hits} onSelect={(p) => void selectPlayer(p)} />
          </div>
          {target ? (
            <div className="mt-3">
              <StatRow
                items={[
                  { label: "Selected", value: target.player_name },
                  ...(target.last_club ? [{ label: "Clube", value: target.last_club }] : []),
                ]}
              />
            </div>
          ) : null}
        </Card>

        {/* Step 2 — configuration */}
        <Card>
          <SectionLabel step={2}>Configuration</SectionLabel>
          <div className="flex flex-wrap items-end gap-4 mt-3">
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

            <FieldLabel label="Top K">
              <Input
                type="number"
                value={topK}
                onChange={(v) => setTopK(Number(v))}
                min={1}
                max={10}
              />
            </FieldLabel>

            <FieldLabel label="Weight version">
              <Input
                value={weightVersion}
                onChange={setWeightVersion}
              />
            </FieldLabel>

            <Button
              onClick={() => void runTopStats()}
              disabled={!target || !bucket || loading}
            >
              {loading ? "Calculating..." : "Calculate Top Stats"}
            </Button>
          </div>
        </Card>

        {/* Player summary */}
        {summary ? (
          <Card>
            <SectionLabel>Player summary</SectionLabel>
            <StatRow
              items={[
                { label: "Name", value: summary.player_name ?? "—" },
                { label: "Club", value: summary.last_club ?? "—" },
                { label: "Age", value: String(summary.age_last_season ?? "—") },
                { label: "Position", value: summary.position_text ?? "—" },
                { label: "Tokens", value: summary.played_positions_short ?? "—" },
                { label: "VM", value: fmtMarketValue(summary.market_value_eur, summary.market_value_text) },
              ]}
            />
          </Card>
        ) : null}

        {/* Results table */}
        {rows.length > 0 ? (
          <Card noPad>
            <div className="px-5 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
              <SectionLabel>Top métricas do jogador</SectionLabel>
            </div>
            <DataTable>
              <THead>
                <TH>#</TH>
                <TH>Métrica</TH>
                <TH>Valor p90</TH>
                <TH>Valor adj</TH>
                <TH>Peso bucket</TH>
                <TH>Strength score</TH>
              </THead>
              <TBody>
                {rows.map((r, idx) => (
                  <TR key={r.column}>
                    <TD>{idx + 1}</TD>
                    <TD className="font-medium">{r.label}</TD>
                    <TD className="tabular-nums">{fmtNum(r.value_p90, 3)}</TD>
                    <TD className="tabular-nums" style={{ color: "#8B949E" }}>{fmtNum(r.value_adj, 3)}</TD>
                    <TD className="tabular-nums">{fmtNum(r.weight, 3)}</TD>
                    <TD className="tabular-nums font-bold" style={{ color: "#00C9A7" }}>{fmtNum(r.strength_score, 4)}</TD>
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
