import { notFound } from "next/navigation";
import Link from "next/link";
import { getRaces, getLastCompletedRound } from "@/lib/data";

interface Props {
  params: Promise<{ year: string }>;
}

export default async function SeasonPage({ params }: Props) {
  const { year: yearStr } = await params;
  const year = Number(yearStr);
  if (!year) notFound();

  const races = getRaces(year);
  if (!races.length) notFound();

  const lastRound = getLastCompletedRound(year);

  return (
    <div>
      <div className="mb-8">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-2 inline-block">
          ← All seasons
        </Link>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-2xl font-bold">{year} Season</h1>
          <Link
            href={`/${year}/chart`}
            className="text-sm border border-zinc-700 rounded px-3 py-1.5 hover:border-red-500 hover:text-red-400 text-zinc-400 transition-colors"
          >
            Points chart →
          </Link>
        </div>
        <p className="text-zinc-400 mt-1">{races.length} races · select a race to view championship permutations</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {races.map((race) => {
          const completed = race.round <= lastRound;
          return (
            <Link
              key={race.round}
              href={completed ? `/${year}/${race.round}` : "#"}
              className={[
                "group rounded-lg border px-4 py-3 transition-colors",
                completed
                  ? "border-zinc-700 bg-zinc-900 hover:border-red-500 hover:bg-zinc-800 cursor-pointer"
                  : "border-zinc-800 bg-zinc-900/50 text-zinc-600 cursor-not-allowed",
              ].join(" ")}
            >
              <div className="text-xs text-zinc-500 mb-1">Round {race.round}</div>
              <div className={`font-semibold text-sm leading-snug ${completed ? "text-zinc-100 group-hover:text-red-400" : "text-zinc-600"}`}>
                {race.raceName.replace(" Grand Prix", " GP")}
              </div>
              <div className="text-xs text-zinc-600 mt-1">{race.circuit}</div>
              <div className="text-xs text-zinc-600">{race.date}</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
