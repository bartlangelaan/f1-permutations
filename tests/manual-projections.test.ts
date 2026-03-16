import assert from "node:assert/strict";
import test from "node:test";
import { readCalculationResults } from "../lib/calculation-results.ts";
import { getEndOfSeasonProjections } from "../lib/projections.ts";

test("Check the calculation result of 2025 after race 23", () => {
  const data = readCalculationResults(2025)!;
  const round23RaceNum = data.races.findIndex((r) => r.round === 23 && r.type === "race") + 1;
  const gasly = data.drivers.find((d) => d.name.toLowerCase().includes("gasly"))!;

  // Check current state at round 23
  const gaslyCurrentPts = gasly.cumulativePoints[round23RaceNum - 1];
  // Current points after race 23 are 22
  assert.equal(gaslyCurrentPts, 22);
  // Current position after race 23 is P18
  const gaslyCurrentPos = gasly.currentPos[round23RaceNum - 1];
  assert.equal(gaslyCurrentPos, 18);

  // Check end-of-season projection from race 23
  const gaslyProjection = getEndOfSeasonProjections(data, round23RaceNum, true)![gasly.id];
  // Pierre Gasly has a minimum of 22 points (current points after round 23)
  assert.equal(gaslyProjection.minPts, 22);
  // Pierre Gasly has a maximum of 47 points (22 + 25 from Abu Dhabi)
  assert.equal(gaslyProjection.maxPts, 47);
  // Pierre Gasly has P13 as best possible position (12 drivers have > 47 pts guaranteed above him)
  assert.equal(gaslyProjection.bestPos, 13);
  // Pierre Gasly has P20 as worst possible position (only 2 of the 3 drivers below can overtake in one race)
  // Not null because P20 is not last place (there are 21 drivers in 2025, so last is P21)
  assert.equal(gaslyProjection.worstPos, 20);
});
