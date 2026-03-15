import { getSeasons } from "../lib/data";
import {
  buildSeasonChartData,
  computeLockInsightsForSelectedSlot,
  computeProjectionsForSelectedSlot,
} from "../lib/calculate";
import {
  writeCalculationResults,
  writeCalculationResultsForSelectedSlot,
} from "../lib/calculation-results";

const seasons = getSeasons();
console.log(`Processing ${seasons.length} seasons...`);

for (const year of seasons.sort((a, b) => a - b)) {
  process.stdout.write(`  ${year}... `);

  // Build full-season data for the base results file (slots, drivers, constructors sorted by final standings).
  const fullData = buildSeasonChartData(year);

  if (fullData.lastCompletedSlotIndex < 0) {
    console.log("skipped (no completed races)");
    continue;
  }

  await writeCalculationResults(year, fullData.drivers, fullData.constructors);

  // For each completed slot, rebuild chart data up to that slot so that only drivers/constructors
  // who have actually raced by then are included. This prevents future entrants from appearing
  // with 0 points in earlier projections and corrupting those results.
  for (let selectedIdx = 0; selectedIdx <= fullData.lastCompletedSlotIndex; selectedIdx++) {
    const slotData = buildSeasonChartData(year, selectedIdx);
    const driverProjections = computeProjectionsForSelectedSlot(slotData, selectedIdx, true);
    const constructorProjections = computeProjectionsForSelectedSlot(slotData, selectedIdx, false);
    const driverLockInsights = computeLockInsightsForSelectedSlot(slotData, selectedIdx, true);
    const constructorLockInsights = computeLockInsightsForSelectedSlot(slotData, selectedIdx, false);

    await writeCalculationResultsForSelectedSlot(year, selectedIdx, {
      driverProjections,
      constructorProjections,
      driverLockInsights,
      constructorLockInsights,
    });
  }

  console.log("done");
}

console.log("All done!");
