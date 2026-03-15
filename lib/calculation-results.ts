import type { CalculatedChartData, EntitySeries, LockInsight, ProjectionMap } from "./calculate";
import {
  getLastCompletedSlotIndex,
  getSlots,
  readCalculationResultsForSelectedSlot,
  readConstructors,
  readDrivers,
  removeCalculationResultsForSeason,
  saveCalculationResultsForSelectedSlot,
  saveConstructors,
  saveDrivers,
} from "./data";

export function readCalculationResults(year: number): CalculatedChartData | null {
  const drivers = readDrivers(year);
  if (!drivers) return null;
  const constructors = readConstructors(year);
  if (!constructors) return null;

  const slots = getSlots(year);
  const lastCompletedSlotIndex = getLastCompletedSlotIndex(year);

  const driverProjections: ProjectionMap = {};
  const constructorProjections: ProjectionMap = {};
  const driverLockInsights: Record<string, LockInsight[]> = {};
  const constructorLockInsights: Record<string, LockInsight[]> = {};

  for (let selectedIdx = 0; selectedIdx <= lastCompletedSlotIndex; selectedIdx++) {
    const perSlotData = readCalculationResultsForSelectedSlot(year, selectedIdx);
    if (!perSlotData) continue;

    driverProjections[selectedIdx] = perSlotData.driverProjections;
    constructorProjections[selectedIdx] = perSlotData.constructorProjections;
    driverLockInsights[selectedIdx] = perSlotData.driverLockInsights;
    constructorLockInsights[selectedIdx] = perSlotData.constructorLockInsights;
  }

  return {
    year,
    slots,
    lastCompletedSlotIndex,
    drivers,
    constructors,
    driverProjections,
    constructorProjections,
    driverLockInsights,
    constructorLockInsights,
  };
}

export async function writeCalculationResults(
  year: number,
  drivers: EntitySeries[],
  constructors: EntitySeries[]
): Promise<void> {
  await removeCalculationResultsForSeason(year);
  await saveDrivers(year, drivers);
  await saveConstructors(year, constructors);
}

export { saveCalculationResultsForSelectedSlot as writeCalculationResultsForSelectedSlot };
