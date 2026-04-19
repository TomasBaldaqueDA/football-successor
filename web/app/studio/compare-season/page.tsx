import { CompareSeasonStudio } from "@/components/CompareSeasonStudio";
import Link from "next/link";

export default function CompareSeasonPage() {
  return (
    <div className="flex min-h-full flex-col bg-zinc-50 dark:bg-black">
      <nav className="border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-4xl items-center gap-4 text-sm">
          <Link href="/" className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
            Home
          </Link>
          <span className="text-zinc-300 dark:text-zinc-600">/</span>
          <span className="font-medium text-zinc-900 dark:text-zinc-100">Studio · Ranking Big 5</span>
        </div>
      </nav>
      <CompareSeasonStudio />
    </div>
  );
}
