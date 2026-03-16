import type { CalculatedChartData, EntitySeries, LockInsight, ProjectionMap } from "./calculate";
import { buildRaces } from "./calculate";
import {
  getLastCompletedRaceNum,
  readCalculationResultsAfterRace,
  readParticipants,
  removeCalculationResultsForSeason,
  saveCalculationResultsAfterRace,
  saveParticipants,
} from "./data";

export function readCalculationResults(year: number): CalculatedChartData | null {
  const participants = readParticipants(year);
  if (!participants) return null;

  const races = buildRaces(year);
  const lastCompletedRaceNum = getLastCompletedRaceNum(year);

  const driverProjections: ProjectionMap = {};
  const constructorProjections: ProjectionMap = {};
  const driverLockInsights: Record<string, LockInsight[]> = {};
  const constructorLockInsights: Record<string, LockInsight[]> = {};

  for (let raceNum = 1; raceNum <= lastCompletedRaceNum; raceNum++) {
    const perRaceData = readCalculationResultsAfterRace(year, raceNum);
    if (!perRaceData) continue;

    driverProjections[raceNum] = perRaceData.driverProjections;
    constructorProjections[raceNum] = perRaceData.constructorProjections;
    driverLockInsights[raceNum] = perRaceData.driverLockInsights;
    constructorLockInsights[raceNum] = perRaceData.constructorLockInsights;
  }

  return {
    year,
    races,
    lastCompletedRaceNum,
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
  constructors: EntitySeries[],
): Promise<void> {
  await removeCalculationResultsForSeason(year);
  await saveParticipants(year, drivers, constructors);
}

export { saveCalculationResultsAfterRace as writeCalculationResultsAfterRace };
