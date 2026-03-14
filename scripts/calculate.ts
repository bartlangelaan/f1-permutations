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

for (const year of seasons) {
  process.stdout.write(`  ${year}... `);
  const data = buildSeasonChartData(year);

  if (data.lastCompletedSlotIndex < 0) {
    console.log("skipped (no completed races)");
    continue;
  }

  writeCalculationResults(year, data);

  for (let selectedIdx = 0; selectedIdx <= data.lastCompletedSlotIndex; selectedIdx++) {
    const slot = data.slots[selectedIdx];

    const driverProjections = computeProjectionsForSelectedSlot(data, selectedIdx, true);
    const constructorProjections = computeProjectionsForSelectedSlot(data, selectedIdx, false);
    const driverLockInsights = computeLockInsightsForSelectedSlot(data, selectedIdx, true);
    const constructorLockInsights = computeLockInsightsForSelectedSlot(data, selectedIdx, false);

    writeCalculationResultsForSelectedSlot(year, slot.raceNumber, {
      driverProjections,
      constructorProjections,
      driverLockInsights,
      constructorLockInsights,
    });
  }

  console.log("done");
}

console.log("All done!");
