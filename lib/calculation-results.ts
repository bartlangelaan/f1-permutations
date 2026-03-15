import type { CalculatedChartData, LockInsight, ProjectionMap } from "./calculate";
import {
  readBaseCalculationResults,
  readCalculationResultsForSelectedSlot,
  removeCalculationResultsForSeason,
  saveBaseCalculationResults,
  saveCalculationResultsForSelectedSlot,
  type BaseCalculatedChartData,
} from "./data";

export function readCalculationResults(year: number): CalculatedChartData | null {
  const baseData = readBaseCalculationResults(year);
  if (!baseData) return null;

  const driverProjections: ProjectionMap = {};
  const constructorProjections: ProjectionMap = {};
  const driverLockInsights: Record<string, LockInsight[]> = {};
  const constructorLockInsights: Record<string, LockInsight[]> = {};

  for (let selectedIdx = 0; selectedIdx <= baseData.lastCompletedSlotIndex; selectedIdx++) {
    const perSlotData = readCalculationResultsForSelectedSlot(year, selectedIdx);
    if (!perSlotData) continue;

    driverProjections[selectedIdx] = perSlotData.driverProjections;
    constructorProjections[selectedIdx] = perSlotData.constructorProjections;
    driverLockInsights[selectedIdx] = perSlotData.driverLockInsights;
    constructorLockInsights[selectedIdx] = perSlotData.constructorLockInsights;
  }

  return {
    ...baseData,
    driverProjections,
    constructorProjections,
    driverLockInsights,
    constructorLockInsights,
  };
}

export async function writeCalculationResults(year: number, data: BaseCalculatedChartData): Promise<void> {
  await removeCalculationResultsForSeason(year);
  await saveBaseCalculationResults(year, data);
}

export { saveCalculationResultsForSelectedSlot as writeCalculationResultsForSelectedSlot };
