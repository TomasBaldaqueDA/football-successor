"use client";

import { useCallback, useEffect, useState } from "react";
import {
  StudioPage, StudioInner, StudioHeader,
  Card, CardHeader, CardTitle,
  SectionLabel, ErrorBanner,
  SearchInput, SearchDropdown, SelectedBadge,
  FieldLabel, Select, Button,
  ScoreCard,
  DataTable, THead, TH, TBody, TR, TD, ScoreBadge,
  StatRow, Spinner,
  C,
} from "@/components/ui/studio";

type PlayerHit = { player_id: string; player_name: string; last_club: string | null };

type ControlRow = {
  player_id: number | string;
  name: string | null;
  age: number | null;
  market_value: string | null;
  positions: string | null;
  team: string | null;
  league: string | null;
  nationality: string | null;
  defend_score: number;
  support_score: number;
  create_score: number;
  score_score: number;
  possession_lost_score: number;
};

type TopRow = {
  player_id: string;
  name: string | null;
  age: number | null;
  team: string | null;
  league: string | null;
  positions: string | null;
  market_value: string | null;
  score_value: number | null;
};

function fmtNum(v: number | string | null | undefined, digits = 2): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(digits) : "—";
}

function fmtPct(v: number | string | null | undefined): string {
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toFixed(1)}%` : "—";
}

const SCORE_COLORS: Record<"defend" | "support" | "create" | "score", string> = {
  defend:  "#4FC3F7",
  support: "#81D4FA",
  create:  "#A78BFA",
  score:   "#FF7043",
};

function scoreColor(v: number | null | undefined): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return C.muted;
  if (n >= 75) return "#00C9A7";
  if (n >= 50) return "#FFD54F";
  if (n >= 25) return "#FFAB40";
  return "#FF6B6B";
}

export function ControlScoreStudio() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<PlayerHit[]>([]);
  const [target, setTarget] = useState<PlayerHit | null>(null);
  const [row, setRow] = useState<ControlRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [topLoading, setTopLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topScoreType, setTopScoreType] = useState<"defend" | "support" | "create" | "score">("score");
  const [topRows, setTopRows] = useState<TopRow[]>([]);

  useEffect(() => {
    const qn = q.trim();
    const tn = target?.player_name?.trim() ?? "";
    if (target && tn && qn !== tn) {
      setTarget(null);
      setRow(null);
      setHits([]);
      return;
    }
    if (target && tn && qn === tn) { setHits([]); return; }
    if (qn.length < 2) { setHits([]); return; }
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
    setRow(null);
    setError(null);
  }, []);

  const runControl = useCallback(async () => {
    if (!target) return;
    setLoading(true);
    setError(null);
    setRow(null);
    try {
      const res = await fetch("/api/control-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player_id: target.player_id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Control Score failed");
      setRow(data.row ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Control Score failed");
    } finally {
      setLoading(false);
    }
  }, [target]);

  const runTop50 = useCallback(async () => {
    setTopLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/control-score/top?score=${encodeURIComponent(topScoreType)}&limit=50`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Top 50 failed");
      setTopRows(data.rows ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Top 50 failed");
      setTopRows([]);
    } finally {
      setTopLoading(false);
    }
  }, [topScoreType]);

  return (
    <StudioPage>
      <StudioInner>
        <StudioHeader
          section="Control Score"
          title="Control Score Card"
          description="Perfil de jogador nas dimensões Defend · Support · Create · Score."
        />

        {error && <ErrorBanner message={error} />}

        {/* Step 1 – Player search */}
        <Card>
          <SectionLabel step={1}>Target player</SectionLabel>
          <div className="relative">
            <SearchInput
              value={q}
              onChange={setQ}
              placeholder="Search by name…"
              loading={hits.length === 0 && q.length >= 2 && !target}
            />
            <SearchDropdown hits={hits} onSelect={(p) => void selectPlayer(p)} />
          </div>
          {target && (
            <div className="mt-3">
              <SelectedBadge name={target.player_name} id={target.player_id} />
            </div>
          )}
        </Card>

        {/* Step 2 – Load card */}
        <Card>
          <SectionLabel step={2}>Ver card</SectionLabel>
          <Button onClick={() => void runControl()} disabled={!target || loading}>
            {loading ? <span className="flex items-center gap-2"><Spinner /> Loading…</span> : "Load Control Card"}
          </Button>
        </Card>

        {/* Player summary */}
        {row && (
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold" style={{ color: C.text }}>Summary</h2>
            </div>
            <StatRow items={[
              { label: "Name",          value: row.name        ?? "—" },
              { label: "Age",           value: String(row.age  ?? "—") },
              { label: "Market Value",  value: row.market_value ?? "—" },
              { label: "Positions",     value: row.positions   ?? "—" },
              { label: "Club",          value: row.team        ?? "—" },
              { label: "League",        value: row.league      ?? "—" },
              { label: "Nat.",          value: row.nationality ?? "—" },
            ]} />
          </Card>
        )}

        {/* Score cards */}
        {row && (
          <Card noPad>
            <CardHeader>
              <CardTitle>Profile Cards</CardTitle>
            </CardHeader>
            <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-5">
              <ScoreCard label="Defend Score"          value={fmtNum(row.defend_score, 1)}          color="#4FC3F7" />
              <ScoreCard label="Support Score"         value={fmtNum(row.support_score, 1)}         color="#81D4FA" />
              <ScoreCard label="Create Score"          value={fmtNum(row.create_score, 1)}          color="#A78BFA" />
              <ScoreCard label="Score Score"           value={fmtNum(row.score_score, 1)}           color="#FF7043" />
              <ScoreCard label="Possession Lost Score" value={fmtPct(row.possession_lost_score)}    color="#FFD54F" />
            </div>
          </Card>
        )}

        {/* Top 50 */}
        <Card noPad>
          <CardHeader>
            <CardTitle>Top 50 by score</CardTitle>
          </CardHeader>
          <div className="flex flex-wrap items-end gap-3 px-5 py-4">
            <FieldLabel label="Score">
              <Select
                value={topScoreType}
                onChange={(v) => setTopScoreType(v as "defend" | "support" | "create" | "score")}
              >
                <option value="defend">Defend</option>
                <option value="support">Support</option>
                <option value="create">Create</option>
                <option value="score">Score</option>
              </Select>
            </FieldLabel>
            <Button onClick={() => void runTop50()} disabled={topLoading}>
              {topLoading ? <span className="flex items-center gap-2"><Spinner /> Loading…</span> : "Load Top 50"}
            </Button>
          </div>

          {topRows.length > 0 && (
            <div className="border-t" style={{ borderColor: C.border }}>
              <DataTable>
                <THead>
                  <TH>#</TH>
                  <TH>Player</TH>
                  <TH>Age</TH>
                  <TH>Positions</TH>
                  <TH>Club</TH>
                  <TH>League</TH>
                  <TH>Market Value</TH>
                  <TH>Score</TH>
                </THead>
                <TBody>
                  {topRows.map((r, i) => (
                    <TR key={`${r.player_id}-${i}`}>
                      <TD><span style={{ color: C.muted }}>{i + 1}</span></TD>
                      <TD><span className="font-medium" style={{ color: C.text }}>{r.name ?? "—"}</span></TD>
                      <TD><span className="tabular-nums" style={{ color: C.muted }}>{r.age ?? "—"}</span></TD>
                      <TD><span style={{ color: C.muted }}>{r.positions ?? "—"}</span></TD>
                      <TD><span style={{ color: C.text }}>{r.team ?? "—"}</span></TD>
                      <TD><span style={{ color: C.muted }}>{r.league ?? "—"}</span></TD>
                      <TD><span style={{ color: C.muted }}>{r.market_value ?? "—"}</span></TD>
                      <TD>
                        <ScoreBadge
                          value={fmtNum(r.score_value, 2)}
                          color={SCORE_COLORS[topScoreType]}
                        />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </DataTable>
            </div>
          )}
        </Card>
      </StudioInner>
    </StudioPage>
  );
}
