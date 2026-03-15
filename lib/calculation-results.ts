import type { CalculatedChartData, EntitySeries, LockInsight, ProjectionMap } from "./calculate";
import { buildSlots } from "./calculate";
import {
  getLastCompletedSlotIndex,
  readCalculationResultsForSelectedSlot,
  readParticipants,
  removeCalculationResultsForSeason,
  saveCalculationResultsForSelectedSlot,
  saveParticipants,
} from "./data";

export function readCalculationResults(year: number): CalculatedChartData | null {
  const participants = readParticipants(year);
  if (!participants) return null;

  const slots = buildSlots(year);
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
    drivers: participants.drivers,
    constructors: participants.constructors,
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
  await saveParticipants(year, drivers, constructors);
}

export { saveCalculationResultsForSelectedSlot as writeCalculationResultsForSelectedSlot };
