import fs from "fs";
import path from "path";
import { getSeasons } from "../lib/data";
import { buildSeasonChartData, computeProjections } from "../lib/calculate";

const DATA_DIR = path.join(process.cwd(), "data");

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
  const output = { ...data, driverProjections, constructorProjections };

  const outFile = path.join(DATA_DIR, String(year), "chart.json");
  fs.writeFileSync(outFile, JSON.stringify(output, null, 2));
  console.log("done");
}

console.log("All done!");
