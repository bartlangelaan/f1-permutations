import { notFound } from "next/navigation";
import Link from "next/link";
import { getRaces, getResults } from "@/lib/data";
import { calculatePermutations } from "@/lib/permutations";
import type { PermutationEntry } from "@/lib/types";

interface Props {
  params: Promise<{ year: string; round: string }>;
}

export default async function PermutationsPage({ params }: Props) {
  const { year: yearStr, round: roundStr } = await params;
  const year = Number(yearStr);
  const round = Number(roundStr);

  if (!year || !round) notFound();

  const races = getRaces(year);
  if (!races.length) notFound();

  const allResults = getResults(year, round);
  if (!allResults.length) notFound();

  const data = calculatePermutations(year, round, races, allResults);
  const race = races.find((r) => r.round === round);
  const prevRound = round > 1 ? round - 1 : null;
  const nextRound = round < races.length ? round + 1 : null;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="text-sm text-zinc-500 mb-1">{year} Season · Round {round}/{data.totalRounds}</div>
        <h1 className="text-2xl font-bold mb-1">{data.raceName}</h1>
        <div className="text-sm text-zinc-400">
          {race?.circuit} · {race?.date}
        </div>
        <div className="mt-2 text-sm text-zinc-500">
          {data.remainingRounds === 0
            ? "Final race of the season"
            : `${data.remainingRounds} race${data.remainingRounds !== 1 ? "s" : ""} remaining`}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-3 mb-8">
        {prevRound && (
          <Link
            href={`/${year}/${prevRound}`}
            className="text-sm border border-zinc-700 rounded px-3 py-1.5 hover:border-zinc-500 hover:text-white transition-colors text-zinc-400"
          >
            ← Round {prevRound}
          </Link>
        )}
        <Link
          href={`/${year}`}
          className="text-sm border border-zinc-700 rounded px-3 py-1.5 hover:border-zinc-500 hover:text-white transition-colors text-zinc-400"
        >
          {year} Season
        </Link>
        {nextRound && (
          <Link
            href={`/${year}/${nextRound}`}
            className="text-sm border border-zinc-700 rounded px-3 py-1.5 hover:border-zinc-500 hover:text-white transition-colors text-zinc-400"
          >
            Round {nextRound} →
          </Link>
        )}
      </div>

      {/* Drivers Championship */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-4 text-zinc-200">Drivers Championship</h2>
        <StandingsTable entries={data.drivers} remainingRounds={data.remainingRounds} />
      </section>

      {/* Constructors Championship */}
      <section>
        <h2 className="text-lg font-semibold mb-4 text-zinc-200">Constructors Championship</h2>
        <StandingsTable entries={data.constructors} remainingRounds={data.remainingRounds} />
      </section>
    </div>
  );
}

function StandingsTable({
  entries,
  remainingRounds,
}: {
  entries: PermutationEntry[];
  remainingRounds: number;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-zinc-500 text-left">
            <th className="pb-2 pr-4 font-medium w-8">Pos</th>
            <th className="pb-2 pr-4 font-medium">Name</th>
            <th className="pb-2 pr-4 font-medium text-right">Points</th>
            <th className="pb-2 pr-4 font-medium text-right">Gap</th>
            <th className="pb-2 pr-4 font-medium text-right">Max possible</th>
            <th className="pb-2 font-medium">Status / Scenario</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/50">
          {entries.map((entry) => (
            <tr key={entry.id} className="hover:bg-zinc-900/50 transition-colors">
              <td className="py-2.5 pr-4 text-zinc-500">{entry.position}</td>
              <td className="py-2.5 pr-4 font-medium text-zinc-100">{entry.name}</td>
              <td className="py-2.5 pr-4 text-right tabular-nums">{entry.currentPoints}</td>
              <td className="py-2.5 pr-4 text-right tabular-nums text-zinc-500">
                {entry.pointsGap === 0 ? "—" : entry.pointsGap > 0 ? `+${entry.pointsGap}` : entry.pointsGap}
              </td>
              <td className="py-2.5 pr-4 text-right tabular-nums text-zinc-400">
                {entry.maxPossiblePoints}
              </td>
              <td className="py-2.5">
                <StatusCell entry={entry} remainingRounds={remainingRounds} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusCell({ entry, remainingRounds }: { entry: PermutationEntry; remainingRounds: number }) {
  if (entry.alreadyClinched) {
    return (
      <span className="inline-flex items-center rounded-full bg-yellow-500/10 px-2.5 py-0.5 text-xs font-medium text-yellow-400 ring-1 ring-yellow-400/20">
        CHAMPION
      </span>
    );
  }

  if (entry.eliminated) {
    return (
      <span className="inline-flex items-center rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs font-medium text-zinc-500 ring-1 ring-zinc-700">
        ELIMINATED
      </span>
    );
  }

  if (entry.position === 1) {
    if (remainingRounds === 0) {
      return (
        <span className="inline-flex items-center rounded-full bg-yellow-500/10 px-2.5 py-0.5 text-xs font-medium text-yellow-400 ring-1 ring-yellow-400/20">
          CHAMPION
        </span>
      );
    }
    return (
      <span className="text-zinc-400 text-xs">
        Leading — opponents need{" "}
        <strong className="text-zinc-200">
          {entry.maxPossiblePoints - entry.currentPoints + 1}+ pts gap
        </strong>{" "}
        to overtake
      </span>
    );
  }

  return (
    <span className="text-zinc-400 text-xs">
      Needs <strong className="text-zinc-200">{entry.minPointsNeeded}+ pts</strong>
      {entry.maxLeaderCanScore !== null && entry.maxLeaderCanScore >= 0 && (
        <>, leader scores max <strong className="text-zinc-200">{entry.maxLeaderCanScore}</strong></>
      )}
    </span>
  );
}
