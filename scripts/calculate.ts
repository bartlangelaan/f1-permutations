import { getSeasons } from "../lib/data";
import {
  buildSeasonChartData,
  computeLockInsightsForSelectedRace,
  computeProjectionsForSelectedRace,
} from "../lib/calculate";
import {
  writeCalculationResults,
  writeCalculationResultsAfterRace,
} from "../lib/calculation-results";

const seasons = getSeasons();
console.log(`Processing ${seasons.length} seasons...`);

for (const year of seasons.sort((a, b) => a - b)) {
  process.stdout.write(`  ${year}... `);

  // Build full-season data for the base results file (races, drivers, constructors sorted by final standings).
  const fullData = buildSeasonChartData(year);

  if (fullData.lastCompletedRaceNum === 0) {
    console.log("skipped (no completed races)");
    continue;
  }

  await writeCalculationResults(year, fullData.drivers, fullData.constructors);

  // For each completed race, rebuild chart data up to that race so that only drivers/constructors
  // who have actually raced by then are included. This prevents future entrants from appearing
  // with 0 points in earlier projections and corrupting those results.
  for (let raceNum = 1; raceNum <= fullData.lastCompletedRaceNum; raceNum++) {
    const raceData = buildSeasonChartData(year, raceNum);
    const driverProjections = computeProjectionsForSelectedRace(raceData, raceNum, true);
    const constructorProjections = computeProjectionsForSelectedRace(raceData, raceNum, false);
    const driverLockInsights = computeLockInsightsForSelectedRace(raceData, raceNum, true);
    const constructorLockInsights = computeLockInsightsForSelectedRace(raceData, raceNum, false);

    await writeCalculationResultsAfterRace(year, raceNum, {
      driverProjections,
      constructorProjections,
      driverLockInsights,
      constructorLockInsights,
    });
  }

  console.log("done");
}

console.log("All done!");
