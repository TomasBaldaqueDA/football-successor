"use client";

const RADAR_AXES = [
  {
    label: "Attack",
    color: "#FF7043",
    icon: "⚽",
    description: "Finishing ability and direct offensive contribution.",
    metrics: [
      { name: "Goals / 90", column: "goals_p90_merged", weight: 100, note: "Goals scored per 90 minutes. Single indicator — full weight on the axis." },
    ],
    formula: "Percentile of Goals/90 vs all outfield players",
  },
  {
    label: "Chance Creation",
    color: "#FFAB40",
    icon: "🎯",
    description: "Ability to create goal-scoring opportunities for the team.",
    metrics: [
      { name: "Key Passes / 90", column: "key_passes_p90_merged", weight: 100, note: "Passes that directly lead to a goal-scoring opportunity. Single indicator — full weight on the axis." },
    ],
    formula: "Percentile of Key Passes/90 vs all outfield players",
  },
  {
    label: "Passing Quality",
    color: "#C5E1A5",
    icon: "📐",
    description: "Accuracy and reliability in ball circulation.",
    metrics: [
      { name: "Pass Success %", column: "pass_success_pct_merged", weight: 100, note: "Percentage of passes successfully completed. Single indicator — full weight on the axis." },
    ],
    formula: "Percentile of Pass Success% vs all outfield players",
  },
  {
    label: "Defensive Work",
    color: "#A5D6A7",
    icon: "🛡️",
    description: "Volume and effectiveness of defensive work — pressing and ball recovery.",
    metrics: [
      { name: "Tackles / 90", column: "tackles_p90_merged", weight: 100, note: "Successful tackles per 90 minutes. Single indicator — full weight on the axis." },
    ],
    formula: "Percentile of Tackles/90 vs all outfield players",
  },
  {
    label: "Ball Winning",
    color: "#4FC3F7",
    icon: "✂️",
    description: "Ability to intercept passes and cut off opposition passing lines.",
    metrics: [
      { name: "Interceptions / 90", column: "interceptions_p90_merged", weight: 100, note: "Interceptions made per 90 minutes. Single indicator — full weight on the axis." },
    ],
    formula: "Percentile of Interceptions/90 vs all outfield players",
  },
  {
    label: "Physical Duels",
    color: "#81D4FA",
    icon: "💪",
    description: "Dominance in aerial duels — relevant for CBs, FWs and physical players.",
    metrics: [
      { name: "Aerial Duels Won / 90", column: "aerial_won_p90_merged", weight: 100, note: "Aerial duels won per 90 minutes. Single indicator — full weight on the axis." },
    ],
    formula: "Percentile of Aerial Won/90 vs all outfield players",
  },
  {
    label: "Dribbling",
    color: "#FFD54F",
    icon: "🌀",
    description: "Ability to beat opponents in 1v1 and progress with the ball.",
    metrics: [
      { name: "Dribbles Won / 90", column: "dribbles_won_p90_merged", weight: 100, note: "Successful dribbles per 90 minutes. Single indicator — full weight on the axis." },
    ],
    formula: "Percentile of Dribbles Won/90 vs all outfield players",
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
        <h2 className="text-base font-bold text-[#E6EDF3] mb-1">Metrics Guide</h2>
        <p className="text-sm text-[#8B949E] leading-relaxed max-w-3xl">
          All radar values and Hidden Gems scores are based on{" "}
          <span className="text-[#00C9A7] font-medium">percentiles (0–100)</span> calculated
          against the full universe of ~4,100 outfield players from the top 12 leagues over the last 5
          seasons. A value of <span className="text-[#E6EDF3]">80</span> means the player
          outperforms 80% of all outfield players in that metric.
        </p>
        <div className="mt-3 flex gap-3 flex-wrap">
          <div className="bg-[#0D1117] rounded px-3 py-1.5 text-xs text-[#8B949E] border border-white/5">
            <span className="text-[#00C9A7] font-semibold">Green</span> ≥ 75th percentile
          </div>
          <div className="bg-[#0D1117] rounded px-3 py-1.5 text-xs text-[#8B949E] border border-white/5">
            <span className="text-[#FFD54F] font-semibold">Yellow</span> 50–74th percentile
          </div>
          <div className="bg-[#0D1117] rounded px-3 py-1.5 text-xs text-[#8B949E] border border-white/5">
            <span className="text-[#FF6B6B] font-semibold">Red</span> &lt; 50th percentile
          </div>
          <div className="bg-[#0D1117] rounded px-3 py-1.5 text-xs text-[#8B949E] border border-white/5">
            Coluna de sufixo <code className="text-[#E6EDF3]">_pct_merged</code> = percentil (0–1) já calculado
          </div>
        </div>
      </div>

      {/* Radar axes */}
      <section>
        <h3 className="text-sm font-semibold text-[#8B949E] uppercase tracking-widest mb-3">
          Comparison Radar Axes
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
                    100% single weight
                  </span>
                </div>
                <p className="text-xs text-[#8B949E] mb-3 leading-relaxed">{axis.description}</p>

                {/* Metrics table */}
                <div className="bg-[#0D1117] rounded border border-white/5 overflow-hidden">
                  <div className="grid grid-cols-[1fr_auto] text-[10px] text-[#8B949E] px-2 py-1 border-b border-white/5">
                    <span>Source metric</span>
                    <span className="text-right">Weight</span>
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
                  Formula: {axis.formula}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Hidden Gems score */}
      <section>
        <h3 className="text-sm font-semibold text-[#8B949E] uppercase tracking-widest mb-3">
          Hidden Gems Score — Weights by Position
        </h3>
        <div className="bg-[#161B22] border border-white/10 rounded-lg p-5">
          <p className="text-sm text-[#8B949E] mb-4 leading-relaxed">
            The Hidden Gems algorithm weights metrics differently by position —
            a CB should not be penalised for not scoring goals, nor a forward for having few
            interceptions. Eligibility:{" "}
            <span className="text-[#E6EDF3]">Age ≤ 26 · Rating ≥ 6.5 · Club outside the top 6</span> of each league.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 text-[#8B949E] font-medium">Metric</th>
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
          Column Glossary
        </h3>
        <div className="bg-[#161B22] border border-white/10 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-[#0D1117]">
                <th className="text-left px-4 py-2.5 text-[#8B949E] font-medium">Column</th>
                <th className="text-left px-4 py-2.5 text-[#8B949E] font-medium">Type</th>
                <th className="text-left px-4 py-2.5 text-[#8B949E] font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["goals_p90_merged", "Per 90 min", "Goals scored per 90 minutes"],
                ["assists_p90_merged", "Per 90 min", "Assists per 90 minutes"],
                ["xg_per_90_merged", "Per 90 min", "Expected Goals per 90 minutes"],
                ["shots_p90_merged", "Per 90 min", "Shots per 90 minutes"],
                ["key_passes_p90_merged", "Per 90 min", "Key passes (that create chances) per 90 min"],
                ["passes_p90_merged", "Per 90 min", "Total passes per 90 minutes"],
                ["accurate_crosses_p90_merged", "Per 90 min", "Accurate crosses per 90 minutes"],
                ["interceptions_p90_merged", "Per 90 min", "Interceptions per 90 minutes"],
                ["tackles_p90_merged", "Per 90 min", "Tackles per 90 minutes"],
                ["blocks_p90_merged", "Per 90 min", "Blocks (shots/passes blocked) per 90 min"],
                ["dribbles_won_p90_merged", "Per 90 min", "Successful dribbles per 90 minutes"],
                ["aerial_won_p90_merged", "Per 90 min", "Aerial duels won per 90 minutes"],
                ["pass_success_pct_merged", "Percentage", "Pass success rate (%)"],
                ["dispossessed_p90_merged", "Per 90 min", "Times dispossessed under opposition pressure per 90 min"],
                ["turnovers_p90_merged", "Per 90 min", "Total ball losses per 90 minutes"],
                ["*_pct_merged", "Percentile (0–1)", "Percentile version of the metric vs full player universe"],
                ["rating_merged", "Score (0–10)", "Global composite rating (multi-metric weighted average)"],
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
