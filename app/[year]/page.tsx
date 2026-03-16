import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { readCalculationResults } from "@/lib/calculation-results";
import { getSeasons } from "@/lib/data";
import { SeasonChart } from "./SeasonChart";

export const dynamicParams = false;

interface Props {
  params: Promise<{ year: string }>;
}

export function generateStaticParams() {
  return getSeasons().map((year) => ({ year: String(year) }));
}

export default async function ChartPage({ params }: Props) {
  const { year: yearStr } = await params;
  const year = Number(yearStr);
  if (!year) notFound();

  const seasons = getSeasons();
  if (!seasons.includes(year)) notFound();

  const data = readCalculationResults(year);
  if (!data) {
    return (
      <div className="p-8 text-zinc-400">
        Chart data not yet calculated for {year}. Run{" "}
        <code className="text-zinc-200">pnpm calculate</code> to generate it.
      </div>
    );
  }
  if (data.lastCompletedRaceNum === 0) notFound();

  const currentIdx = seasons.indexOf(year);
  const prevYear = seasons[currentIdx + 1] ?? null;
  const nextYear = seasons[currentIdx - 1] ?? null;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-3">
            {prevYear && (
              <Link
                href={`/${prevYear}`}
                className="text-sm text-zinc-500 transition-colors hover:text-zinc-300"
              >
                ← {prevYear}
              </Link>
            )}
            <h1 className="text-2xl font-bold">{year} Season</h1>
            {nextYear && (
              <Link
                href={`/${nextYear}`}
                className="text-sm text-zinc-500 transition-colors hover:text-zinc-300"
              >
                {nextYear} →
              </Link>
            )}
          </div>
          <p className="text-sm text-zinc-500">
            Championship points progression · drag the slider to time-travel
          </p>
        </div>
      </div>
      <Suspense
        fallback={
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-6 text-sm text-zinc-400">
            Loading chart controls...
          </div>
        }
      >
        <SeasonChart data={data} />
      </Suspense>
    </div>
  );
}
