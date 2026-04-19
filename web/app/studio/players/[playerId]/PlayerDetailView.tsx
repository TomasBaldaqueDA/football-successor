"use client";

import type { PlayerDetailData } from "@/lib/playerDetail";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getLastStudio, studioBackHref, studioBackLabel, type Studio } from "@/lib/studioNav";

function fmtCell(v: string | number | null): string {
  if (v === null) return "—";
  if (typeof v === "number" && Number.isFinite(v)) return v.toFixed(3);
  return String(v);
}

function DefinitionList({
  items,
  empty,
}: {
  items: { label: string; value: string }[];
  empty?: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-zinc-500">{empty ?? "Sem dados."}</p>;
  }
  return (
    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((row) => (
        <div key={row.label} className="border-b border-zinc-100 pb-2 dark:border-zinc-800">
          <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{row.label}</dt>
          <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-100">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function PlayerDetailView({ data }: { data: PlayerDetailData }) {
  const title =
    (data.dim?.player_name as string | undefined) ?? `Player ${data.playerId}`;

  const [studio, setStudio] = useState<Studio>("l4l");
  useEffect(() => {
    setStudio(getLastStudio());
  }, []);

  const dimItems =
    data.dim === null
      ? []
      : Object.entries(data.dim).map(([key, val]) => ({
          label: key.replace(/_/g, " "),
          value: val === null || val === undefined || val === "" ? "—" : String(val),
        }));

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-10">
      <header className="space-y-1">
        <div className="mb-4">
          <Link
            href={studioBackHref(studio)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <span aria-hidden>←</span>
            {studioBackLabel(studio)}
          </Link>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{title}</h1>
        <p className="font-mono text-sm text-zinc-500">player_id · {data.playerId}</p>
        <p className="max-w-2xl pt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          <span className="font-medium">p90 / per 90</span> values come from the merged profile (
          <code className="text-xs">*_p90_merged</code>, <code className="text-xs">*_per_90_merged</code>) —
          time-weighted average of raw rates,{" "}
          <span className="font-medium">without</span> percentiles or league adjustment.
        </p>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Identity & context (<code className="text-xs font-normal">mart.player_dim</code>)
        </h2>
        <DefinitionList items={dimItems} empty="No row in player_dim." />
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Aggregated metadata (<code className="text-xs font-normal">player_profile_merged_v1</code>)
        </h2>
        {data.meta.length === 0 ? (
          <p className="text-sm text-zinc-500">No meta fields in this profile.</p>
        ) : (
          <DefinitionList
            items={data.meta.map((m) => ({
              label: `${m.label} (${m.key})`,
              value: fmtCell(m.value),
            }))}
          />
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Stats · raw merged p90</h2>
          <p className="mt-1 text-xs text-zinc-500">
            One row per metric; values are per-90 rates after temporal merging (minutes × recency).
          </p>
        </div>
        <div className="max-h-[70vh] overflow-auto">
          {data.p90Stats.length === 0 ? (
            <p className="p-5 text-sm text-zinc-500">No *_p90_merged / *_per_90_merged columns in this record.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-2">Métrica</th>
                  <th className="px-4 py-2">Chave</th>
                  <th className="px-4 py-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {data.p90Stats.map((r) => (
                  <tr key={r.key} className="text-zinc-800 dark:text-zinc-200">
                    <td className="px-4 py-2 font-medium">{r.label}</td>
                    <td className="px-4 py-2 font-mono text-xs text-zinc-500">{r.key}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmtCell(r.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {data.latestPoolSeason && data.latestPoolSeason.length > 0 ? (
        <details className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm open:ring-1 open:ring-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 dark:open:ring-zinc-700">
          <summary className="cursor-pointer text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Última época no pool limpo ({data.latestPoolSeason.length} campos)
          </summary>
          <p className="mt-2 text-xs text-zinc-500">
            Uma linha de <code className="text-[11px]">mart.player_pool_clean_tbl</code> (época mais recente por{" "}
            <code className="text-[11px]">season_slug</code>). Só campos escalares; pode incluir minutos, clube,
            ratings brutos, etc.
          </p>
          <div className="mt-4 max-h-[50vh] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-zinc-50 text-xs font-semibold text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-3 py-2">Campo</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {data.latestPoolSeason.map((r) => (
                  <tr key={r.key}>
                    <td className="px-3 py-1.5 font-mono text-xs text-zinc-700 dark:text-zinc-300">{r.key}</td>
                    <td className="max-w-lg truncate px-3 py-1.5 text-right text-xs text-zinc-600 dark:text-zinc-400">
                      {r.value === null ? "—" : String(r.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}

      {data.otherMerged.length > 0 ? (
        <details className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm open:ring-1 open:ring-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 dark:open:ring-zinc-700">
          <summary className="cursor-pointer text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Outros campos no perfil fundido ({data.otherMerged.length})
          </summary>
          <p className="mt-2 text-xs text-zinc-500">
            Colunas restantes da tabela de merge que não são adj/norm/pct nem p90 explícitos — por exemplo totais ou
            chaves antigas.
          </p>
          <div className="mt-4 max-h-[40vh] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-zinc-50 text-xs font-semibold text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-3 py-2">Chave</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {data.otherMerged.map((r) => (
                  <tr key={r.key}>
                    <td className="px-3 py-1.5 font-mono text-xs text-zinc-700 dark:text-zinc-300">{r.key}</td>
                    <td className="max-w-md truncate px-3 py-1.5 text-right text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
                      {fmtCell(r.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </div>
  );
}
