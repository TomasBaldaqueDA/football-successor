import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <main className="w-full max-w-lg space-y-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Football Successor
        </h1>
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          Ferramentas internas para explorar substitutos e preparar conteúdo.
        </p>
        <Link
          href="/studio/l4l"
          className="inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-6 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          Abrir Like-for-Like
        </Link>

        <Link
          href="/studio/role"
          className="inline-flex h-11 items-center justify-center rounded-lg border border-black/[.08] px-6 text-sm font-medium text-zinc-900 transition hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-100 dark:hover:bg-[#1a1a1a]"
        >
          Abrir Role
        </Link>

        <Link
          href="/studio/development"
          className="inline-flex h-11 items-center justify-center rounded-lg border border-black/[.08] px-6 text-sm font-medium text-zinc-900 transition hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-100 dark:hover:bg-[#1a1a1a]"
        >
          Abrir Development
        </Link>

        <Link
          href="/studio/budget"
          className="inline-flex h-11 items-center justify-center rounded-lg border border-black/[.08] px-6 text-sm font-medium text-zinc-900 transition hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-100 dark:hover:bg-[#1a1a1a]"
        >
          Abrir Budget
        </Link>
        <Link
          href="/studio/upgrade"
          className="inline-flex h-11 items-center justify-center rounded-lg border border-black/[.08] px-6 text-sm font-medium text-zinc-900 transition hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-100 dark:hover:bg-[#1a1a1a]"
        >
          Abrir Upgrade
        </Link>
        <Link
          href="/studio/top-stats"
          className="inline-flex h-11 items-center justify-center rounded-lg border border-black/[.08] px-6 text-sm font-medium text-zinc-900 transition hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-100 dark:hover:bg-[#1a1a1a]"
        >
          Abrir Top Stats
        </Link>
        <Link
          href="/studio/control-score"
          className="inline-flex h-11 items-center justify-center rounded-lg border border-black/[.08] px-6 text-sm font-medium text-zinc-900 transition hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-100 dark:hover:bg-[#1a1a1a]"
        >
          Abrir Control Score
        </Link>
        <Link
          href="/studio/team-ranking"
          className="inline-flex h-11 items-center justify-center rounded-lg border border-black/[.08] px-6 text-sm font-medium text-zinc-900 transition hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-100 dark:hover:bg-[#1a1a1a]"
        >
          Abrir Team Ranking
        </Link>
        <Link
          href="/studio/compare-season"
          className="inline-flex h-11 items-center justify-center rounded-lg border border-black/[.08] px-6 text-sm font-medium text-zinc-900 transition hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-100 dark:hover:bg-[#1a1a1a]"
        >
          Abrir ranking Big 5 (época)
        </Link>
        <Link
          href="/studio/scouting"
          className="inline-flex h-11 items-center justify-center rounded-lg bg-[#00C9A7] px-6 text-sm font-medium text-[#0D1117] transition hover:bg-[#00b396] font-semibold"
        >
          ★ Scouting Dashboard
        </Link>
      </main>
    </div>
  );
}
