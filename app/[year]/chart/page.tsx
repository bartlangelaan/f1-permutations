import fs from "fs";
import path from "path";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getSeasons } from "@/lib/data";
import type { CalculatedChartData } from "@/lib/timeline";
import { SeasonChart } from "./SeasonChart";

interface Props {
  params: Promise<{ year: string }>;
}

export default async function ChartPage({ params }: Props) {
  const { year: yearStr } = await params;
  const year = Number(yearStr);
  if (!year) notFound();

  const seasons = getSeasons();
  if (!seasons.includes(year)) notFound();

  const chartFile = path.join(process.cwd(), "data", String(year), "chart.json");
  if (!fs.existsSync(chartFile)) {
    return (
      <div className="text-zinc-400 p-8">
        Chart data not yet calculated for {year}. Run <code className="text-zinc-200">pnpm calculate</code> to generate it.
      </div>
    );
  }

  const data = JSON.parse(fs.readFileSync(chartFile, "utf-8")) as CalculatedChartData;
  if (data.lastCompletedSlotIndex < 0) notFound();

  const currentIdx = seasons.indexOf(year);
  const prevYear = seasons[currentIdx + 1] ?? null;
  const nextYear = seasons[currentIdx - 1] ?? null;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            {prevYear && (
              <Link
                href={`/${prevYear}/chart`}
                className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                ← {prevYear}
              </Link>
            )}
            <h1 className="text-2xl font-bold">{year} Season</h1>
            {nextYear && (
              <Link
                href={`/${nextYear}/chart`}
                className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {nextYear} →
              </Link>
            )}
          </div>
          <p className="text-sm text-zinc-500">
            Championship points progression · drag the slider to time-travel
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href={`/${year}`}
            className="text-sm border border-zinc-700 rounded px-3 py-1.5 hover:border-zinc-500 text-zinc-400 hover:text-white transition-colors"
          >
            Race list
          </Link>
        </div>
      </div>

      <SeasonChart data={data} />
    </div>
  );
}
