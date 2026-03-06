import { redirect } from "next/navigation";
import { getSeasons } from "@/lib/data";

export default function Home() {
  const seasons = getSeasons();
  if (seasons.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-8 text-center text-zinc-400">
        <p className="text-lg font-medium mb-2">No data available yet.</p>
        <p className="text-sm">Run <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-200">pnpm fetch-data</code> to download F1 race data.</p>
      </div>
    );
  }
  redirect(`/${seasons[0]}/chart`);
}
