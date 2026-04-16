"use client";

const RADAR_AXES = [
  {
    label: "Attack",
    color: "#FF7043",
    icon: "⚽",
    description: "Capacidade de finalização e contribuição ofensiva direta.",
    metrics: [
      { name: "Goals / 90", column: "goals_p90_merged", weight: 100, note: "Golos marcados por 90 minutos. Único indicador — peso total no eixo." },
    ],
    formula: "Percentil de Goals/90 vs todos os jogadores de campo",
  },
  {
    label: "Chance Creation",
    color: "#FFAB40",
    icon: "🎯",
    description: "Capacidade de criar oportunidades de golo para a equipa.",
    metrics: [
      { name: "Key Passes / 90", column: "key_passes_p90_merged", weight: 100, note: "Passes que resultam diretamente numa oportunidade de golo. Único indicador — peso total no eixo." },
    ],
    formula: "Percentil de Key Passes/90 vs todos os jogadores de campo",
  },
  {
    label: "Passing Quality",
    color: "#C5E1A5",
    icon: "📐",
    description: "Precisão e fiabilidade na circulação de bola.",
    metrics: [
      { name: "Pass Success %", column: "pass_success_pct_merged", weight: 100, note: "Percentagem de passes completados com sucesso. Único indicador — peso total no eixo." },
    ],
    formula: "Percentil de Pass Success% vs todos os jogadores de campo",
  },
  {
    label: "Defensive Work",
    color: "#A5D6A7",
    icon: "🛡️",
    description: "Volume e eficácia do trabalho defensivo — pressão e recuperação de bola.",
    metrics: [
      { name: "Tackles / 90", column: "tackles_p90_merged", weight: 100, note: "Número de desarmes bem-sucedidos por 90 minutos. Único indicador — peso total no eixo." },
    ],
    formula: "Percentil de Tackles/90 vs todos os jogadores de campo",
  },
  {
    label: "Ball Winning",
    color: "#4FC3F7",
    icon: "✂️",
    description: "Capacidade de intercetar passes e cortar linhas de jogo do adversário.",
    metrics: [
      { name: "Interceptions / 90", column: "interceptions_p90_merged", weight: 100, note: "Interceções realizadas por 90 minutos. Único indicador — peso total no eixo." },
    ],
    formula: "Percentil de Interceptions/90 vs todos os jogadores de campo",
  },
  {
    label: "Physical Duels",
    color: "#81D4FA",
    icon: "💪",
    description: "Domínio nos duelos aéreos — relevante para CB, FW e jogadores físicos.",
    metrics: [
      { name: "Aerial Duels Won / 90", column: "aerial_won_p90_merged", weight: 100, note: "Disputas aéreas ganhas por 90 minutos. Único indicador — peso total no eixo." },
    ],
    formula: "Percentil de Aerial Won/90 vs todos os jogadores de campo",
  },
  {
    label: "Dribbling",
    color: "#FFD54F",
    icon: "🌀",
    description: "Capacidade de superar adversários em 1v1 e progredir com bola.",
    metrics: [
      { name: "Dribbles Won / 90", column: "dribbles_won_p90_merged", weight: 100, note: "Dribles bem-sucedidos por 90 minutos. Único indicador — peso total no eixo." },
    ],
    formula: "Percentil de Dribbles Won/90 vs todos os jogadores de campo",
  },
];

const GEM_WEIGHTS = [
  {
    pos: "FW / AM",
    color: "#FF7043",
    weights: [
      { metric: "Rating", w: 35 },
      { metric: "xG/90 pct", w: 20 },
      { metric: "Dribbles Won pct", w: 10 },
      { metric: "Key Passes pct", w: 15 },
      { metric: "Pass Success pct", w: 15 },
      { metric: "Tackles pct", w: 0 },
      { metric: "Interceptions pct", w: 5 },
    ],
  },
  {
    pos: "Winger",
    color: "#FFD54F",
    weights: [
      { metric: "Rating", w: 35 },
      { metric: "xG/90 pct", w: 15 },
      { metric: "Dribbles Won pct", w: 15 },
      { metric: "Key Passes pct", w: 15 },
      { metric: "Pass Success pct", w: 10 },
      { metric: "Tackles pct", w: 5 },
      { metric: "Interceptions pct", w: 5 },
    ],
  },
  {
    pos: "CM / FB",
    color: "#C5E1A5",
    weights: [
      { metric: "Rating", w: 35 },
      { metric: "xG/90 pct", w: 10 },
      { metric: "Dribbles Won pct", w: 0 },
      { metric: "Key Passes pct", w: 20 },
      { metric: "Pass Success pct", w: 20 },
      { metric: "Tackles pct", w: 10 },
      { metric: "Interceptions pct", w: 5 },
    ],
  },
  {
    pos: "DM / CB",
    color: "#A5D6A7",
    weights: [
      { metric: "Rating", w: 35 },
      { metric: "xG/90 pct", w: 5 },
      { metric: "Dribbles Won pct", w: 0 },
      { metric: "Key Passes pct", w: 5 },
      { metric: "Pass Success pct", w: 15 },
      { metric: "Tackles pct", w: 20 },
      { metric: "Interceptions pct", w: 20 },
    ],
  },
];

export function MetricsGuide() {
  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* Header */}
      <div className="bg-[#161B22] border border-white/10 rounded-lg p-5">
        <h2 className="text-base font-bold text-[#E6EDF3] mb-1">Guia de Métricas</h2>
        <p className="text-sm text-[#8B949E] leading-relaxed max-w-3xl">
          Todos os valores do radar e do score de Hidden Gems são baseados em{" "}
          <span className="text-[#00C9A7] font-medium">percentis (0–100)</span> calculados
          contra o universo completo de ~4.100 jogadores de campo das 12 principais ligas nas últimas 5
          temporadas. Um valor de <span className="text-[#E6EDF3]">80</span> significa que o
          jogador supera 80% de todos os jogadores de campo nessa métrica.
        </p>
        <div className="mt-3 flex gap-3 flex-wrap">
          <div className="bg-[#0D1117] rounded px-3 py-1.5 text-xs text-[#8B949E] border border-white/5">
            <span className="text-[#00C9A7] font-semibold">Verde</span> ≥ 75º percentil
          </div>
          <div className="bg-[#0D1117] rounded px-3 py-1.5 text-xs text-[#8B949E] border border-white/5">
            <span className="text-[#FFD54F] font-semibold">Amarelo</span> 50–74º percentil
          </div>
          <div className="bg-[#0D1117] rounded px-3 py-1.5 text-xs text-[#8B949E] border border-white/5">
            <span className="text-[#FF6B6B] font-semibold">Vermelho</span> &lt; 50º percentil
          </div>
          <div className="bg-[#0D1117] rounded px-3 py-1.5 text-xs text-[#8B949E] border border-white/5">
            Coluna de sufixo <code className="text-[#E6EDF3]">_pct_merged</code> = percentil (0–1) já calculado
          </div>
        </div>
      </div>

      {/* Radar axes */}
      <section>
        <h3 className="text-sm font-semibold text-[#8B949E] uppercase tracking-widest mb-3">
          Eixos do Radar de Comparação
        </h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {RADAR_AXES.map((axis) => (
            <div
              key={axis.label}
              className="bg-[#161B22] border border-white/10 rounded-lg p-4 flex gap-4"
            >
              {/* Icon + color bar */}
              <div className="flex flex-col items-center gap-2 shrink-0">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                  style={{ backgroundColor: axis.color + "25" }}
                >
                  {axis.icon}
                </div>
                <div
                  className="w-1 flex-1 rounded-full min-h-[24px]"
                  style={{ backgroundColor: axis.color + "40" }}
                />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-bold" style={{ color: axis.color }}>
                    {axis.label}
                  </h4>
                  <span className="text-[10px] text-[#8B949E] bg-[#0D1117] px-1.5 py-0.5 rounded border border-white/5">
                    100% peso único
                  </span>
                </div>
                <p className="text-xs text-[#8B949E] mb-3 leading-relaxed">{axis.description}</p>

                {/* Metrics table */}
                <div className="bg-[#0D1117] rounded border border-white/5 overflow-hidden">
                  <div className="grid grid-cols-[1fr_auto] text-[10px] text-[#8B949E] px-2 py-1 border-b border-white/5">
                    <span>Métrica fonte</span>
                    <span className="text-right">Peso</span>
                  </div>
                  {axis.metrics.map((m) => (
                    <div
                      key={m.name}
                      className="grid grid-cols-[1fr_auto] px-2 py-1.5 items-center"
                    >
                      <div>
                        <div className="text-xs font-medium text-[#E6EDF3]">{m.name}</div>
                        <div className="text-[10px] text-[#8B949E]">
                          <code className="text-[#FFD54F]">{m.column}</code>
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className="text-sm font-bold"
                          style={{ color: axis.color }}
                        >
                          {m.weight}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-[10px] text-[#8B949E] mt-2 italic">
                  Fórmula: {axis.formula}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Hidden Gems score */}
      <section>
        <h3 className="text-sm font-semibold text-[#8B949E] uppercase tracking-widest mb-3">
          Score Hidden Gems — Pesos por Posição
        </h3>
        <div className="bg-[#161B22] border border-white/10 rounded-lg p-5">
          <p className="text-sm text-[#8B949E] mb-4 leading-relaxed">
            O algoritmo de Hidden Gems pondera as métricas de forma diferente consoante a posição —
            um CB não deve ser penalizado por não marcar golos, nem um avançado por ter poucas
            interceções. Elegibilidade:{" "}
            <span className="text-[#E6EDF3]">Idade ≤ 26 · Rating ≥ 6.5 · Clube fora do top 6</span> de cada liga.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 text-[#8B949E] font-medium">Métrica</th>
                  {GEM_WEIGHTS.map((g) => (
                    <th
                      key={g.pos}
                      className="text-right py-2 px-3 font-bold"
                      style={{ color: g.color }}
                    >
                      {g.pos}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {GEM_WEIGHTS[0].weights.map((_, wi) => {
                  const metricName = GEM_WEIGHTS[0].weights[wi].metric;
                  return (
                    <tr key={metricName} className="border-b border-white/5">
                      <td className="py-2 text-[#E6EDF3] font-medium">{metricName}</td>
                      {GEM_WEIGHTS.map((g) => {
                        const w = g.weights[wi].w;
                        return (
                          <td key={g.pos} className="py-2 px-3 text-right">
                            {w === 0 ? (
                              <span className="text-[#8B949E]/40">—</span>
                            ) : (
                              <span
                                className="font-semibold"
                                style={{
                                  color:
                                    w >= 20
                                      ? "#00C9A7"
                                      : w >= 10
                                      ? "#FFD54F"
                                      : "#8B949E",
                                }}
                              >
                                {w}%
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                <tr className="border-t border-white/10">
                  <td className="py-2 text-[#8B949E] font-bold">Total</td>
                  {GEM_WEIGHTS.map((g) => (
                    <td key={g.pos} className="py-2 px-3 text-right font-bold text-[#00C9A7]">
                      {g.weights.reduce((s, w) => s + w.w, 0)}%
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-4 bg-[#0D1117] rounded px-3 py-2 text-[10px] text-[#8B949E] border border-white/5 font-mono">
            Score = (rating / 10 × peso_rating) + (xG_pct × peso_xg) + (key_passes_pct × peso_kp) + (tackles_pct × peso_tkl) + (interceptions_pct × peso_int) + (pass_success_pct × peso_pass) + (dribbles_pct × peso_drb)
          </div>
        </div>
      </section>

      {/* All raw columns */}
      <section>
        <h3 className="text-sm font-semibold text-[#8B949E] uppercase tracking-widest mb-3">
          Glossário de Colunas
        </h3>
        <div className="bg-[#161B22] border border-white/10 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-[#0D1117]">
                <th className="text-left px-4 py-2.5 text-[#8B949E] font-medium">Coluna</th>
                <th className="text-left px-4 py-2.5 text-[#8B949E] font-medium">Tipo</th>
                <th className="text-left px-4 py-2.5 text-[#8B949E] font-medium">Descrição</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["goals_p90_merged", "Por 90 min", "Golos marcados por 90 minutos"],
                ["assists_p90_merged", "Por 90 min", "Assistências por 90 minutos"],
                ["xg_per_90_merged", "Por 90 min", "Expected Goals por 90 minutos"],
                ["shots_p90_merged", "Por 90 min", "Remates por 90 minutos"],
                ["key_passes_p90_merged", "Por 90 min", "Passes-chave (que criam oportunidades) por 90 min"],
                ["passes_p90_merged", "Por 90 min", "Total de passes por 90 minutos"],
                ["accurate_crosses_p90_merged", "Por 90 min", "Cruzamentos precisos por 90 minutos"],
                ["interceptions_p90_merged", "Por 90 min", "Interceções por 90 minutos"],
                ["tackles_p90_merged", "Por 90 min", "Desarmes por 90 minutos"],
                ["blocks_p90_merged", "Por 90 min", "Blocos (remates/passes bloqueados) por 90 min"],
                ["dribbles_won_p90_merged", "Por 90 min", "Dribles bem-sucedidos por 90 minutos"],
                ["aerial_won_p90_merged", "Por 90 min", "Duelos aéreos ganhos por 90 minutos"],
                ["pass_success_pct_merged", "Percentagem", "Taxa de sucesso nos passes (%)"],
                ["dispossessed_p90_merged", "Por 90 min", "Vezes que perdeu a bola por pressão adversária por 90 min"],
                ["turnovers_p90_merged", "Por 90 min", "Perdas de bola totais por 90 minutos"],
                ["*_pct_merged", "Percentil (0–1)", "Versão percentil da métrica vs universo completo de jogadores"],
                ["rating_merged", "Score (0–10)", "Rating composto global do jogador (média ponderada multi-métrica)"],
              ].map(([col, type, desc]) => (
                <tr key={col} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-2">
                    <code className="text-[#FFD54F] text-[10px]">{col}</code>
                  </td>
                  <td className="px-4 py-2 text-[#8B949E] whitespace-nowrap">{type}</td>
                  <td className="px-4 py-2 text-[#E6EDF3]">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
