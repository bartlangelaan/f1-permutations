import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSeasonChartData, computeProjections } from '../lib/calculate.ts';

test('Check the calculation result of 2025 after race 23', () => {
  // We always check the calculation of the last race.
  // We just want to read from the data json files to check.
  const year = 2025;
  const round = 23;

  const data = buildSeasonChartData(year);
  const driverProjections = computeProjections(data, true);

  // Find the slot index for round 23 main race (selected point in the season)
  const slot23raceIdx = data.slots.findIndex(s => s.round === round && s.type === 'race');
  assert.ok(slot23raceIdx >= 0, `Round ${round} race slot not found`);

  const proj = driverProjections[slot23raceIdx];
  assert.ok(proj, `No projections for slot ${slot23raceIdx}`);

  // Project to the end of the season (final slot)
  const futureSlotIdxs = Object.keys(proj).map(Number).sort((a, b) => a - b);
  assert.ok(futureSlotIdxs.length > 0, 'No future slots found');
  const finalSlotIdx = futureSlotIdxs[futureSlotIdxs.length - 1];

  const gasly = data.drivers.find(d => d.name.toLowerCase().includes('gasly'));
  assert.ok(gasly, 'Pierre Gasly not found in drivers');

  const gaslyProjection = proj[finalSlotIdx][gasly.id];
  assert.ok(gaslyProjection, 'Gasly end-of-season projection not found');

  // Check current state at round 23 using cumulativePoints from the data
  const gaslyCurrentPts = gasly.cumulativePoints[slot23raceIdx];
  // Current points after race 23 are 22
  assert.equal(gaslyCurrentPts, 22);
  // Current position after race 23 is P18
  const gaslyCurrentPos = 1 + data.drivers.filter(
    d => d.id !== gasly.id && (d.cumulativePoints[slot23raceIdx] ?? 0) > gaslyCurrentPts!
  ).length;
  assert.equal(gaslyCurrentPos, 18);

  // Pierre Gasly has a minimum of 22 points (current points after round 23)
  assert.equal(gaslyProjection.minPts, 22);
  // Pierre Gasly has a maximum of 47 points (22 + 25 from Abu Dhabi)
  assert.equal(gaslyProjection.maxPts, 47);
  // Pierre Gasly has P13 as best possible position (12 drivers have > 47 pts guaranteed above him)
  assert.equal(gaslyProjection.bestPos, 13);
  // Pierre Gasly has P21 as worst possible position (all 3 drivers below him can overtake)
  assert.equal(gaslyProjection.worstPos, 21);
});
