import Link from "next/link";

const STUDIOS = [
  {
    href: "/studio/scouting",
    label: "Scouting Dashboard",
    description: "12 interactive visuals · Hidden Gems · Comparison radar",
    icon: "★",
    accent: "#00C9A7",
    featured: true,
  },
  {
    href: "/studio/l4l",
    label: "Like-for-Like",
    description: "Substitutes with a similar statistical profile",
    icon: "⇄",
    accent: "#6366F1",
  },
  {
    href: "/studio/role",
    label: "Role",
    description: "Substitutes by the same role / tactical outcome",
    icon: "◎",
    accent: "#8B5CF6",
  },
  {
    href: "/studio/development",
    label: "Development",
    description: "Player development trajectory and projection",
    icon: "↗",
    accent: "#3B82F6",
  },
  {
    href: "/studio/budget",
    label: "Budget",
    description: "Market value and cost-efficiency analysis",
    icon: "€",
    accent: "#10B981",
  },
  {
    href: "/studio/upgrade",
    label: "Upgrade",
    description: "Identify real upgrades over the current player",
    icon: "▲",
    accent: "#F59E0B",
  },
  {
    href: "/studio/top-stats",
    label: "Top Stats",
    description: "Top strength metrics by position bucket",
    icon: "⊞",
    accent: "#EC4899",
  },
  {
    href: "/studio/control-score",
    label: "Control Score",
    description: "Cards de perfil: Defend · Support · Create · Score",
    icon: "◈",
    accent: "#14B8A6",
  },
  {
    href: "/studio/team-ranking",
    label: "Team Ranking",
    description: "Internal team ranking by composite score",
    icon: "≡",
    accent: "#F97316",
  },
  {
    href: "/studio/compare-season",
    label: "Compare Season",
    description: "Big 5 ranking by season — temporal evolution",
    icon: "⧖",
    accent: "#A78BFA",
  },
];

export default function Home() {
  const [featured, ...rest] = STUDIOS;

  return (
    <div className="min-h-screen bg-[#0D1117] text-[#E6EDF3]" style={{ fontFamily: "var(--font-geist-sans), Inter, sans-serif" }}>
      {/* Grid background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 mx-auto max-w-5xl px-6 py-16">
        {/* Header */}
        <div className="mb-14 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#00C9A7]/30 bg-[#00C9A7]/10 px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00C9A7] animate-pulse" />
            <span className="text-xs font-medium text-[#00C9A7] tracking-wider uppercase">Internal Tools</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-[#E6EDF3] mb-3">
            Football Successor
          </h1>
          <p className="text-[#8B949E] text-base max-w-md mx-auto leading-relaxed">
            Data analysis platform for scouting, recruitment and player comparison.
          </p>
        </div>

        {/* Featured card */}
        <Link
          href={featured.href}
          className="group mb-6 flex items-center gap-6 rounded-2xl border border-[#00C9A7]/30 bg-gradient-to-r from-[#00C9A7]/10 to-[#161B22] p-6 transition hover:border-[#00C9A7]/60 hover:from-[#00C9A7]/15 block"
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#00C9A7]/15 text-2xl text-[#00C9A7] group-hover:bg-[#00C9A7]/25 transition">
            {featured.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-semibold text-[#E6EDF3]">{featured.label}</h2>
              <span className="rounded-full bg-[#00C9A7]/15 px-2 py-0.5 text-[10px] font-semibold text-[#00C9A7] uppercase tracking-wider">
                new
              </span>
            </div>
            <p className="text-sm text-[#8B949E]">{featured.description}</p>
          </div>
          <span className="text-[#00C9A7] text-xl shrink-0 opacity-60 group-hover:opacity-100 transition">→</span>
        </Link>

        {/* Grid of studios */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="group flex items-center gap-4 rounded-xl border border-white/8 bg-[#161B22] p-4 transition hover:border-white/20 hover:bg-[#1C2128]"
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg transition group-hover:scale-110"
                style={{ backgroundColor: s.accent + "18", color: s.accent }}
              >
                {s.icon}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[#E6EDF3] truncate">{s.label}</div>
                <div className="text-[11px] text-[#8B949E] truncate mt-0.5">{s.description}</div>
              </div>
            </Link>
          ))}
        </div>

        {/* Footer */}
        <p className="mt-14 text-center text-[10px] text-[#8B949E]/50 tracking-wider uppercase">
          Football Successor · Internal Analytics Platform
        </p>
      </div>
    </div>
  );
}
