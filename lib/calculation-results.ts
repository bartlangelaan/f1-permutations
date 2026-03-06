import fs from "fs";
import path from "path";
import type { CalculatedChartData, ProjectionEntry } from "./calculate";

const DATA_DIR = path.join(process.cwd(), "data");
const FILENAME = "calculation-results.json";

export function readCalculationResults(year: number): CalculatedChartData | null {
  const file = path.join(DATA_DIR, String(year), FILENAME);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf-8")) as CalculatedChartData;
}

export function writeCalculationResults(year: number, data: CalculatedChartData): void {
  const file = path.join(DATA_DIR, String(year), FILENAME);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

/** Returns projections for the final season slot from the given selected slot, or null if already at the end. */
export function getEndOfSeasonProjections(
  data: CalculatedChartData,
  selectedIdx: number,
  isDriver: boolean
): Record<string, ProjectionEntry> | null {
  const lastSlotIdx = data.slots.length - 1;
  if (selectedIdx >= lastSlotIdx) return null;
  const projections = isDriver ? data.driverProjections : data.constructorProjections;
  return projections[selectedIdx]?.[lastSlotIdx] ?? null;
}
