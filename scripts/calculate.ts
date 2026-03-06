import { getSeasons } from "../lib/data";
import { buildSeasonChartData, computeProjections } from "../lib/calculate";
import { writeCalculationResults } from "../lib/calculation-results";

const seasons = getSeasons();
console.log(`Processing ${seasons.length} seasons...`);

for (const year of seasons) {
  process.stdout.write(`  ${year}... `);
  const data = buildSeasonChartData(year);

  if (data.lastCompletedSlotIndex < 0) {
    console.log("skipped (no completed races)");
    continue;
  }

  const driverProjections = computeProjections(data, true);
  const constructorProjections = computeProjections(data, false);
  writeCalculationResults(year, { ...data, driverProjections, constructorProjections });
  console.log("done");
}

console.log("All done!");
