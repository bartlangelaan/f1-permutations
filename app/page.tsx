import Link from "next/link";
import { getSeasons, getRaces, getLastCompletedRound } from "@/lib/data";

export default function Home() {
  const seasons = getSeasons();

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">F1 Championship Permutations</h1>
      <p className="text-zinc-400 mb-8">
        Select a season and race to see who could still win the championship at that point.
      </p>

      {seasons.length === 0 ? (
        <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-8 text-center text-zinc-400">
          <p className="text-lg font-medium mb-2">No data available yet.</p>
          <p className="text-sm">Run <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-200">pnpm fetch-data</code> to download F1 race data.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {seasons.map((year) => (
            <SeasonSection key={year} year={year} />
          ))}
        </div>
      )}
    </div>
  );
}

function SeasonSection({ year }: { year: number }) {
  const races = getRaces(year);
  const lastRound = getLastCompletedRound(year);

  return (
    <section>
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <div className="flex items-baseline gap-3">
          <h2 className="text-xl font-semibold">{year} Season</h2>
          <span className="text-sm text-zinc-500">{races.length} races</span>
        </div>
        <Link
          href={`/${year}/chart`}
          className="text-xs border border-zinc-700 rounded px-2.5 py-1 hover:border-red-500 hover:text-red-400 text-zinc-500 transition-colors flex-shrink-0"
        >
          Points chart
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
        {races.map((race) => {
          const completed = race.round <= lastRound;
          return (
            <Link
              key={race.round}
              href={completed ? `/${year}/${race.round}` : "#"}
              className={[
                "group rounded-lg border px-3 py-2.5 text-sm transition-colors",
                completed
                  ? "border-zinc-700 bg-zinc-900 hover:border-red-500 hover:bg-zinc-800 cursor-pointer"
                  : "border-zinc-800 bg-zinc-900/50 text-zinc-600 cursor-not-allowed",
              ].join(" ")}
            >
              <div className="text-xs text-zinc-500 mb-0.5">Round {race.round}</div>
              <div className={`font-medium leading-snug ${completed ? "text-zinc-100 group-hover:text-red-400" : "text-zinc-600"}`}>
                {race.raceName.replace(" Grand Prix", " GP")}
              </div>
              <div className="text-xs text-zinc-600 mt-0.5">{race.date}</div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
