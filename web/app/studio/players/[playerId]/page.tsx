import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlayerDetail } from "@/lib/playerDetail";
import { PlayerDetailView } from "./PlayerDetailView";

type Props = { params: Promise<{ playerId: string }> };

export async function generateMetadata({ params }: Props) {
  const { playerId } = await params;
  const data = await getPlayerDetail(playerId);
  const name = (data?.dim?.player_name as string | undefined) ?? `Player ${playerId}`;
  return {
    title: `${name} · Profile`,
    description: "Aggregated p90 profile (merged) and identity",
  };
}

export default async function PlayerDetailPage({ params }: Props) {
  const { playerId } = await params;
  const data = await getPlayerDetail(playerId);
  if (!data) notFound();

  return (
    <div className="min-h-full bg-zinc-50 dark:bg-black">
      <nav className="border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <Link href="/" className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
            Home
          </Link>
          <span className="text-zinc-300 dark:text-zinc-600">/</span>
          <span className="font-medium text-zinc-900 dark:text-zinc-100">Player</span>
        </div>
      </nav>
      <PlayerDetailView data={data} />
    </div>
  );
}
