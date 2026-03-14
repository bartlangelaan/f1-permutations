import test from 'node:test';
import assert from 'node:assert/strict';
import { readCalculationResults } from '../lib/calculation-results.ts';
import type { ProjectionMap } from '../lib/calculate.ts';
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
  // Pierre Gasly has P20 as worst possible position (only 2 of the 3 drivers below can overtake in one race)
  assert.equal(gaslyProjection.worstPos, 20);
});


function positionAtSlot(pointsAtSlot: Map<string, number>, entityId: string): number {
  const pts = pointsAtSlot.get(entityId) ?? 0;
  return 1 + [...pointsAtSlot.entries()].filter(([id, otherPts]) => id !== entityId && otherPts > pts).length;
}

function validateProjectionAgainstActual(
  projections: ProjectionMap,
  entities: { id: string; cumulativePoints: (number | null)[] }[],
  selectedIdx: number,
  futureIdx: number,
  label: string
): void {
  const projectionForFuture = projections[String(selectedIdx)]?.[String(futureIdx)];
  assert.ok(projectionForFuture, `${label}: missing projection for selected=${selectedIdx}, future=${futureIdx}`);

  const pointsAtFuture = new Map<string, number>();
  for (const entity of entities) {
    const actualPts = entity.cumulativePoints[futureIdx] ?? 0;
    pointsAtFuture.set(entity.id, actualPts);
  }

  for (const entity of entities) {
    const entry = projectionForFuture[entity.id];
    assert.ok(entry, `${label}: missing entity projection for ${entity.id}`);

    const actualPts = pointsAtFuture.get(entity.id)!;
    assert.ok(
      actualPts >= entry.minPts && actualPts <= entry.maxPts,
      `${label}: ${entity.id} points ${actualPts} not in [${entry.minPts}, ${entry.maxPts}] for selected=${selectedIdx}, future=${futureIdx}`
    );

    const actualPos = positionAtSlot(pointsAtFuture, entity.id);
    assert.ok(
      actualPos >= entry.bestPos && actualPos <= entry.worstPos,
      `${label}: ${entity.id} position ${actualPos} not in [${entry.bestPos}, ${entry.worstPos}] for selected=${selectedIdx}, future=${futureIdx}`
    );
  }
}

test('All projections contain actual future points and positions for completed slots across all seasons', () => {
  for (let year = 2010; year <= 2026; year++) {
    const data = readCalculationResults(year);
    assert.ok(data, `No calculation results found for ${year}. Run pnpm calculate first.`);

    for (let selectedIdx = 0; selectedIdx <= data.lastCompletedSlotIndex; selectedIdx++) {
      for (let futureIdx = selectedIdx + 1; futureIdx <= data.lastCompletedSlotIndex; futureIdx++) {
        if (!data.slots[futureIdx].completed) continue;
        validateProjectionAgainstActual(data.driverProjections, data.drivers, selectedIdx, futureIdx, `drivers-${year}`);
        validateProjectionAgainstActual(data.constructorProjections, data.constructors, selectedIdx, futureIdx, `constructors-${year}`);
      }
    }
  }
});

test('Lock-in insight: Norris cannot lock P1 in the next race after Mexico 2025', () => {
  const data2025 = readCalculationResults(2025);
  assert.ok(data2025, 'No calculation results found for 2025. Run pnpm calculate first.');

  const mexicoRaceIdx = data2025.slots.findIndex((s) => s.round === 20 && s.type === 'race');
  assert.ok(mexicoRaceIdx >= 0, 'Mexico 2025 race slot not found');

  const norris = data2025.drivers.find((d) => d.id === 'norris');
  assert.ok(norris, 'Lando Norris not found in 2025 drivers');

  const norrisP1Insight = data2025.driverLockInsights[String(mexicoRaceIdx)]?.[`${norris.id}-1`];
  assert.ok(norrisP1Insight, 'Norris P1 lock insight missing after Mexico 2025');
  assert.equal(norrisP1Insight.type, 'can_be_locked_in_later');
  if (norrisP1Insight.type === 'can_be_locked_in_later') {
    const earliestSlot = data2025.slots[norrisP1Insight.earliestSlotIndex];
    assert.equal(earliestSlot.type, 'sprint');
    assert.ok(earliestSlot.fullLabel.includes('Qatar GP'));
  }
});

test('Lock-in insight: Verstappen can lock P1 next race after Italy 2022 with exact margins', () => {
  const data2022 = readCalculationResults(2022);
  assert.ok(data2022, 'No calculation results found for 2022. Run pnpm calculate first.');

  const italyRaceIdx = data2022.slots.findIndex((s) => s.round === 16 && s.type === 'race');
  assert.ok(italyRaceIdx >= 0, 'Italy 2022 race slot not found');

  const verstappen = data2022.drivers.find((d) => d.id === 'max_verstappen');
  assert.ok(verstappen, 'Max Verstappen not found in 2022 drivers');

  const verstappenP1Insight = data2022.driverLockInsights[String(italyRaceIdx)]?.[`${verstappen.id}-1`];
  assert.ok(verstappenP1Insight, 'Verstappen P1 lock insight missing after Italy 2022');
  assert.equal(verstappenP1Insight.type, 'can_be_locked_in_next_race');
  if (verstappenP1Insight.type === 'can_be_locked_in_next_race') {
    const nextSlot = data2022.slots[verstappenP1Insight.nextSlotIndex];
    assert.equal(nextSlot.round, 17);
    assert.ok(nextSlot.fullLabel.includes('Singapore GP'));

    const outscoreByOpponent = new Map(verstappenP1Insight.mustOutscoreBy.map((c) => [c.opponentId, c.points]));
    assert.equal(outscoreByOpponent.get('leclerc'), 22);
    assert.equal(outscoreByOpponent.get('perez'), 13);
    assert.equal(outscoreByOpponent.get('russell'), 6);
  }
});
