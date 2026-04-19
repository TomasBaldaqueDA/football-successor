"use client";

import { useEffect, useState } from "react";
import {
  StudioPage, StudioInner, StudioHeader,
  Card, CardHeader, CardTitle,
  SectionLabel, ErrorBanner,
  FieldLabel, Select, Button,
  DataTable, THead, TH, TBody, TR, TD, ScoreBadge,
  Spinner,
  C,
} from "@/components/ui/studio";

type SortBy = "defend" | "support" | "create" | "score" | "overall_avg" | "market_value";

type RankingRow = {
  player_id: string;
  name: string | null;
  age: number | null;
  positions: string | null;
  team: string | null;
  league: string | null;
  nationality: string | null;
  market_value: string | null;
  defend_score: number;
  support_score: number;
  create_score: number;
  score_score: number;
  possession_lost_score: number;
  ranking_score: number;
};

function fmtNum(v: number | null | undefined, digits = 2): string {
  return Number.isFinite(Number(v)) ? Number(v).toFixed(digits) : "—";
}

function fmtMarketValue(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  const raw = String(v).trim();
  if (!raw) return "—";
  const cleaned = raw.replace(/[^\d,.-]/g, "");
  const normalized = cleaned.includes(",") && !cleaned.includes(".") ? cleaned.replace(",", ".") : cleaned;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return "—";
  const valueInMillions = parsed > 1000 ? parsed / 1_000_000 : parsed;
  return `€${valueInMillions.toFixed(2)}M`;
}

function scoreColor(v: number | null | undefined): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return C.muted;
  if (n >= 75) return "#00C9A7";
  if (n >= 50) return "#FFD54F";
  if (n >= 25) return "#FFAB40";
  return "#FF6B6B";
}

export function TeamRankingStudio() {
  const [teamQ, setTeamQ] = useState("");
  const [teamHits, setTeamHits] = useState<string[]>([]);
  const [team, setTeam] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("overall_avg");
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = teamQ.trim();
    if (q.length < 2 || (team && q === team)) { setTeamHits([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/teams/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Team search failed");
        setTeamHits(data.teams ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Team search failed");
      }
    }, 250);
    return () => clearTimeout(t);
  }, [teamQ, team]);

  async function runRanking(nextTeam?: string) {
    const chosen = (nextTeam ?? team).trim();
    if (!chosen) return;
    setLoading(true);
    setError(null);
    setRows([]);
    try {
      const res = await fetch(
        `/api/team-ranking?team=${encodeURIComponent(chosen)}&sort_by=${encodeURIComponent(sortBy)}&limit=200`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ranking failed");
      setRows(data.rows ?? []);
      setTeam(chosen);
      setTeamQ(chosen);
      setTeamHits([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ranking failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <StudioPage>
      <StudioInner>
        <StudioHeader
          section="Team Ranking"
          title="Ranking por Equipa"
          description="Ranking interno dos jogadores de uma equipa por score composto (Defend · Support · Create · Score)."
        />

        {error && <ErrorBanner message={error} />}

        {/* Step 1 – Team + sort */}
        <Card>
          <SectionLabel step={1}>Equipa + ordenação</SectionLabel>
          <div className="flex flex-wrap items-end gap-4">

            {/* Team search */}
            <div className="relative min-w-[18rem] flex-1">
              <FieldLabel label="Equipa">
                <input
                  type="search"
                  value={teamQ}
                  onChange={(e) => setTeamQ(e.target.value)}
                  placeholder="Search team…"
                  autoComplete="off"
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-[#00C9A7]"
                  style={{ background: C.bg, borderColor: C.border, color: C.text }}
                />
              </FieldLabel>
              {teamHits.length > 0 && (
                <ul
                  className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border py-1 text-sm shadow-2xl"
                  style={{ background: C.card2 ?? "#1C2128", borderColor: C.border }}
                >
                  {teamHits.map((t) => (
                    <li key={t}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left transition hover:bg-white/5"
                        style={{ color: C.text }}
                        onClick={() => void runRanking(t)}
                      >
                        {t}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Sort */}
            <FieldLabel label="Sort by">
              <Select value={sortBy} onChange={(v) => setSortBy(v as SortBy)}>
                <option value="overall_avg">Overall Avg</option>
                <option value="defend">Defend</option>
                <option value="support">Support</option>
                <option value="create">Create</option>
                <option value="score">Score</option>
                <option value="market_value">Market Value</option>
              </Select>
            </FieldLabel>

            <Button onClick={() => void runRanking()} disabled={!teamQ.trim() || loading}>
              {loading
                ? <span className="flex items-center gap-2"><Spinner /> Loading…</span>
                : "Load ranking"}
            </Button>
          </div>
        </Card>

        {/* Results table */}
        {rows.length > 0 && (
          <Card noPad>
            <CardHeader>
              <CardTitle>Results · {team}</CardTitle>
              <span className="text-xs" style={{ color: C.muted }}>{rows.length} players</span>
            </CardHeader>
            <DataTable>
              <THead>
                <TH>#</TH>
                <TH>Player</TH>
                <TH>Age</TH>
                <TH>Positions</TH>
                <TH>Nat.</TH>
                <TH>League</TH>
                <TH>Market Value</TH>
                <TH>Defend</TH>
                <TH>Support</TH>
                <TH>Create</TH>
                <TH>Score</TH>
                <TH>Poss. Lost</TH>
                <TH>Rank Score</TH>
              </THead>
              <TBody>
                {rows.map((r, i) => (
                  <TR key={`${r.player_id}-${i}`}>
                    <TD><span style={{ color: C.muted }}>{i + 1}</span></TD>
                    <TD><span className="font-medium" style={{ color: C.text }}>{r.name ?? "—"}</span></TD>
                    <TD><span className="tabular-nums" style={{ color: C.muted }}>{r.age ?? "—"}</span></TD>
                    <TD><span style={{ color: C.muted }}>{r.positions ?? "—"}</span></TD>
                    <TD><span style={{ color: C.muted }}>{r.nationality ?? "—"}</span></TD>
                    <TD><span style={{ color: C.muted }}>{r.league ?? "—"}</span></TD>
                    <TD><span style={{ color: C.muted }}>{fmtMarketValue(r.market_value)}</span></TD>
                    <TD>
                      <ScoreBadge value={fmtNum(r.defend_score, 2)}          color="#4FC3F7" />
                    </TD>
                    <TD>
                      <ScoreBadge value={fmtNum(r.support_score, 2)}         color="#81D4FA" />
                    </TD>
                    <TD>
                      <ScoreBadge value={fmtNum(r.create_score, 2)}          color="#A78BFA" />
                    </TD>
                    <TD>
                      <ScoreBadge value={fmtNum(r.score_score, 2)}           color="#FF7043" />
                    </TD>
                    <TD>
                      <ScoreBadge value={fmtNum(r.possession_lost_score, 2)} color="#FFD54F" />
                    </TD>
                    <TD>
                      <ScoreBadge
                        value={fmtNum(r.ranking_score, 2)}
                        color={scoreColor(r.ranking_score)}
                      />
                    </TD>
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
