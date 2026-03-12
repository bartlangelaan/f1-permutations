import test from 'node:test';
import assert from 'node:assert/strict';
import { readCalculationResults } from '../lib/calculation-results.ts';
import { getEndOfSeasonProjections } from '../lib/projections.ts';

test('Check the calculation result of 2025 after race 23', () => {
  const year = 2025;
  const round = 23;

  const data = readCalculationResults(year);
  assert.ok(data, `No calculation results found for ${year}. Run pnpm calculate first.`);

  const slot23raceIdx = data.slots.findIndex(s => s.round === round && s.type === 'race');
  assert.ok(slot23raceIdx >= 0, `Round ${round} race slot not found`);

  const gasly = data.drivers.find(d => d.name.toLowerCase().includes('gasly'));
  assert.ok(gasly, 'Pierre Gasly not found in drivers');

  // Check current state at round 23
  const gaslyCurrentPts = gasly.cumulativePoints[slot23raceIdx];
  // Current points after race 23 are 22
  assert.equal(gaslyCurrentPts, 22);
  // Current position after race 23 is P18
  const gaslyCurrentPos = 1 + data.drivers.filter(
    d => d.id !== gasly.id && (d.cumulativePoints[slot23raceIdx] ?? 0) > gaslyCurrentPts!
  ).length;
  assert.equal(gaslyCurrentPos, 18);

  // Check end-of-season projection from race 23
  const endProjections = getEndOfSeasonProjections(data, slot23raceIdx, true);
  assert.ok(endProjections, 'No end-of-season projections found');

  const gaslyProjection = endProjections[gasly.id];
  assert.ok(gaslyProjection, 'Gasly end-of-season projection not found');
  // Pierre Gasly has a minimum of 22 points (current points after round 23)
  assert.equal(gaslyProjection.minPts, 22);
  // Pierre Gasly has a maximum of 47 points (22 + 25 from Abu Dhabi)
  assert.equal(gaslyProjection.maxPts, 47);
  // Pierre Gasly has P13 as best possible position (12 drivers have > 47 pts guaranteed above him)
  assert.equal(gaslyProjection.bestPos, 13);
  // Pierre Gasly has P21 as worst possible position (all 3 drivers below him can overtake)
  assert.equal(gaslyProjection.worstPos, 21);
});
