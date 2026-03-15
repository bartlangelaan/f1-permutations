import type { CalculatedChartData, ProjectionEntry } from "./calculate";

/** Returns projections for the final season race from the given afterRaceNum, or null if already at the end. */
export function getEndOfSeasonProjections(
  data: CalculatedChartData,
  afterRaceNum: number,
  isDriver: boolean
): Record<string, ProjectionEntry> | null {
  const lastRaceNum = data.races.length;
  if (afterRaceNum >= lastRaceNum) return null;
  const projections = isDriver ? data.driverProjections : data.constructorProjections;
  return projections[afterRaceNum]?.[lastRaceNum] ?? null;
}
