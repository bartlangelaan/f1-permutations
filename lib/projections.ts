import type { CalculatedChartData, ProjectionEntry } from "./calculate";

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
