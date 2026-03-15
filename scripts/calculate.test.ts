import test from 'node:test';
import assert from 'node:assert/strict';
import { readCalculationResults } from '../lib/calculation-results.ts';
import type { LockInsight, ProjectionEntry, ProjectionMap } from '../lib/calculate.ts';
import { getEndOfSeasonProjections } from '../lib/projections.ts';

test('Check the calculation result of 2025 after race 23', () => {
  const year = 2025;
  const round = 23;

  const data = readCalculationResults(year);
  assert.ok(data, `No calculation results found for ${year}. Run pnpm calculate first.`);

  const round23RaceNum = data.races.findIndex(r => r.round === round && r.type === 'race') + 1;
  assert.ok(round23RaceNum > 0, `Round ${round} race not found`);

  const gasly = data.drivers.find(d => d.name.toLowerCase().includes('gasly'));
  assert.ok(gasly, 'Pierre Gasly not found in drivers');

  // Check current state at round 23
  const gaslyCurrentPts = gasly.cumulativePoints[round23RaceNum - 1];
  // Current points after race 23 are 22
  assert.equal(gaslyCurrentPts, 22);
  // Current position after race 23 is P18
  const gaslyCurrentPos = 1 + data.drivers.filter(
    d => d.id !== gasly.id && (d.cumulativePoints[round23RaceNum - 1] ?? 0) > gaslyCurrentPts!
  ).length;
  assert.equal(gaslyCurrentPos, 18);

  // Check end-of-season projection from race 23
  const endProjections = getEndOfSeasonProjections(data, round23RaceNum, true);
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
  // Not null because P20 is not last place (there are 21 drivers in 2025, so last is P21)
  assert.equal(gaslyProjection.worstPos, 20);
});


function positionAtRace(pointsAtRace: Map<string, number>, entityId: string): number {
  const pts = pointsAtRace.get(entityId) ?? 0;
  return 1 + [...pointsAtRace.entries()].filter(([id, otherPts]) => id !== entityId && otherPts > pts).length;
}

function validateProjectionAgainstActual(
  projections: ProjectionMap,
  entities: { id: string; cumulativePoints: (number | null)[] }[],
  afterRaceNum: number,
  futureRaceNum: number,
  label: string
): void {
  const projectionForFuture = projections[String(afterRaceNum)]?.[String(futureRaceNum)];
  assert.ok(projectionForFuture, `${label}: missing projection for afterRaceNum=${afterRaceNum}, futureRaceNum=${futureRaceNum}`);

  // Only validate entities that were part of the championship at afterRaceNum.
  // Drivers/constructors that first appear in later races are not projected from earlier races,
  // and positions are measured relative to the same known-at-the-time entity set.
  const projectedEntities = entities.filter((e) => projectionForFuture[e.id] !== undefined);

  const pointsAtFuture = new Map<string, number>();
  for (const entity of projectedEntities) {
    const actualPts = entity.cumulativePoints[futureRaceNum - 1] ?? 0;
    pointsAtFuture.set(entity.id, actualPts);
  }

  for (const entity of projectedEntities) {
    const entry = projectionForFuture[entity.id]!;

    const actualPts = pointsAtFuture.get(entity.id)!;
    assert.ok(
      actualPts >= entry.minPts && actualPts <= entry.maxPts,
      `${label}: ${entity.id} points ${actualPts} not in [${entry.minPts}, ${entry.maxPts}] for afterRaceNum=${afterRaceNum}, futureRaceNum=${futureRaceNum}`
    );

    const actualPos = positionAtRace(pointsAtFuture, entity.id);
    assert.ok(
      actualPos >= entry.bestPos && (entry.worstPos === null || actualPos <= entry.worstPos),
      `${label}: ${entity.id} position ${actualPos} not in [${entry.bestPos}, ${entry.worstPos ?? 'last'}] for afterRaceNum=${afterRaceNum}, futureRaceNum=${futureRaceNum}`
    );
  }
}

function actualPositionAtRace(
  entities: { id: string; cumulativePoints: (number | null)[] }[],
  raceNum: number,
  entityId: string
): number {
  const pointsAtRace = new Map<string, number>();
  for (const entity of entities) {
    pointsAtRace.set(entity.id, entity.cumulativePoints[raceNum - 1] ?? 0);
  }

  return positionAtRace(pointsAtRace, entityId);
}

function findInsight(
  insights: LockInsight[] | undefined,
  type: LockInsight['type'],
  entityId: string,
  position: number
): LockInsight | undefined {
  return insights?.find(
    (insight) => insight.type === type && insight.entityId === entityId && insight.position === position
  );
}

test('All projections contain actual future points and positions for completed races across all seasons', () => {
  for (let year = 2010; year <= 2026; year++) {
    const data = readCalculationResults(year);
    assert.ok(data, `No calculation results found for ${year}. Run pnpm calculate first.`);

    for (let afterRaceNum = 1; afterRaceNum <= data.lastCompletedRaceNum; afterRaceNum++) {
      for (let futureRaceNum = afterRaceNum + 1; futureRaceNum <= data.lastCompletedRaceNum; futureRaceNum++) {
        if (!data.races[futureRaceNum - 1].completed) continue;
        validateProjectionAgainstActual(data.driverProjections, data.drivers, afterRaceNum, futureRaceNum, `drivers-${year}`);
        validateProjectionAgainstActual(data.constructorProjections, data.constructors, afterRaceNum, futureRaceNum, `constructors-${year}`);
      }
    }
  }
});

test('Lock-in insight: Norris cannot lock P1 in the next race after Mexico 2025', () => {
  const data2025 = readCalculationResults(2025);
  assert.ok(data2025, 'No calculation results found for 2025. Run pnpm calculate first.');

  const mexicoRaceNum = data2025.races.findIndex((r) => r.round === 20 && r.type === 'race') + 1;
  assert.ok(mexicoRaceNum > 0, 'Mexico 2025 race not found');

  const norris = data2025.drivers.find((d) => d.id === 'norris');
  assert.ok(norris, 'Lando Norris not found in 2025 drivers');

  const norrisP1Insight = findInsight(
    data2025.driverLockInsights[String(mexicoRaceNum)],
    'can_be_locked_in_later',
    norris.id,
    1
  );
  assert.ok(norrisP1Insight, 'Norris P1 lock insight missing after Mexico 2025');
  assert.equal(norrisP1Insight.type, 'can_be_locked_in_later');
  if (norrisP1Insight.type === 'can_be_locked_in_later') {
    const earliestRace = data2025.races[norrisP1Insight.earliestRaceNum - 1];
    assert.equal(earliestRace.type, 'sprint');
    assert.ok(earliestRace.fullLabel.includes('Qatar GP'));
  }
});

test('Lock-in insight: Verstappen exposes every next-race minimum lock from P1 through P4 after Italy 2022', () => {
  const data2022 = readCalculationResults(2022);
  assert.ok(data2022, 'No calculation results found for 2022. Run pnpm calculate first.');

  const italyRaceNum = data2022.races.findIndex((r) => r.round === 16 && r.type === 'race') + 1;
  assert.ok(italyRaceNum > 0, 'Italy 2022 race not found');

  const verstappen = data2022.drivers.find((d) => d.id === 'max_verstappen');
  assert.ok(verstappen, 'Max Verstappen not found in 2022 drivers');

  const verstappenP1 = findInsight(
    data2022.driverLockInsights[String(italyRaceNum)],
    'can_be_locked_in_next_race',
    verstappen.id,
    1
  );
  const verstappenP2 = findInsight(
    data2022.driverLockInsights[String(italyRaceNum)],
    'can_be_locked_in_next_race',
    verstappen.id,
    2
  );
  const verstappenP3 = findInsight(
    data2022.driverLockInsights[String(italyRaceNum)],
    'can_be_locked_in_next_race',
    verstappen.id,
    3
  );
  const verstappenP4 = findInsight(
    data2022.driverLockInsights[String(italyRaceNum)],
    'can_be_locked_in_next_race',
    verstappen.id,
    4
  );

  assert.ok(verstappenP1, 'Verstappen P1 guarantee insight missing after Italy 2022');
  assert.ok(verstappenP2, 'Verstappen P2 guarantee insight missing after Italy 2022');
  assert.ok(verstappenP3, 'Verstappen P3 guarantee insight missing after Italy 2022');
  assert.ok(verstappenP4, 'Verstappen P4 guarantee insight missing after Italy 2022');

  assert.equal(verstappenP1.type, 'can_be_locked_in_next_race');
  assert.equal(verstappenP2.type, 'can_be_locked_in_next_race');
  assert.equal(verstappenP3.type, 'can_be_locked_in_next_race');
  assert.equal(verstappenP4.type, 'can_be_locked_in_next_race');

  if (
    verstappenP1.type === 'can_be_locked_in_next_race' &&
    verstappenP2.type === 'can_be_locked_in_next_race' &&
    verstappenP3.type === 'can_be_locked_in_next_race' &&
    verstappenP4.type === 'can_be_locked_in_next_race'
  ) {
    const nextRace = data2022.races[verstappenP1.nextRaceNum - 1];
    assert.equal(nextRace.round, 17);
    assert.ok(nextRace.fullLabel.includes('Singapore GP'));

    assert.deepEqual(verstappenP1.mustOutscoreBy, [
      { opponentId: 'leclerc', points: 23 },
      { opponentId: 'perez', points: 14 },
      { opponentId: 'russell', points: 7 },
    ]);
    assert.deepEqual(verstappenP2.mustOutscoreBy, [
      { opponentId: 'perez', points: 14 },
      { opponentId: 'russell', points: 7 },
    ]);
    assert.deepEqual(verstappenP3.mustOutscoreBy, [
      { opponentId: 'russell', points: 7 },
    ]);
    assert.deepEqual(verstappenP4.mustOutscoreBy, []);
    assert.deepEqual(verstappenP4.cannotBeOutscoredByMoreThan, [
      { opponentId: 'sainz', points: 9 },
    ]);
  }
});

test('Lock-in insight: 2025 title contenders show every lockable minimum position in the finale', () => {
  const data2025 = readCalculationResults(2025);
  assert.ok(data2025, 'No calculation results found for 2025. Run pnpm calculate first.');

  const qatarRaceNum = data2025.races.findIndex((r) => r.round === 23 && r.type === 'race') + 1;
  assert.ok(qatarRaceNum > 0, 'Qatar 2025 race not found');

  for (const entityId of ['norris', 'max_verstappen', 'piastri'] as const) {
    const p1Insight: LockInsight | undefined =
      findInsight(data2025.driverLockInsights[String(qatarRaceNum)], 'can_be_locked_in_next_race', entityId, 1);
    const p2Insight: LockInsight | undefined =
      findInsight(data2025.driverLockInsights[String(qatarRaceNum)], 'can_be_locked_in_next_race', entityId, 2);
    assert.ok(p1Insight, `${entityId} P1 guarantee insight missing after Qatar 2025`);
    assert.ok(p2Insight, `${entityId} P2 guarantee insight missing after Qatar 2025`);
    assert.equal(p1Insight.type, 'can_be_locked_in_next_race');
    assert.equal(p2Insight.type, 'can_be_locked_in_next_race');
  }
});

test('Lock-in insight: positions without a next-race minimum guarantee fall back to a later line', () => {
  const data2025 = readCalculationResults(2025);
  assert.ok(data2025, 'No calculation results found for 2025. Run pnpm calculate first.');

  const mexicoRaceNum = data2025.races.findIndex((r) => r.round === 20 && r.type === 'race') + 1;
  assert.ok(mexicoRaceNum > 0, 'Mexico 2025 race not found');

  const norrisInsights = (data2025.driverLockInsights[String(mexicoRaceNum)] ?? []).filter(
    (insight) => insight.entityId === 'norris' && insight.type === 'can_be_locked_in_next_race'
  );

  assert.equal(norrisInsights.length, 0, 'Expected no conditional next-race guarantee insight for Norris');
  const norrisLaterP1 = findInsight(
    data2025.driverLockInsights[String(mexicoRaceNum)],
    'can_be_locked_in_later',
    'norris',
    1
  );
  assert.ok(norrisLaterP1, 'Expected a later P1 guarantee insight for Norris');
});

test('Lock-in insight: later guarantees are emitted per position instead of stopping at the first one', () => {
  const data2025 = readCalculationResults(2025);
  assert.ok(data2025, 'No calculation results found for 2025. Run pnpm calculate first.');

  const singaporeRaceNum = data2025.races.findIndex((r) => r.round === 20 && r.type === 'race') + 1;
  assert.ok(singaporeRaceNum > 0, 'Singapore 2025 race not found');

  const norrisLaterP1 = findInsight(
    data2025.driverLockInsights[String(singaporeRaceNum)],
    'can_be_locked_in_later',
    'norris',
    1
  );
  const norrisLaterP2 = findInsight(
    data2025.driverLockInsights[String(singaporeRaceNum)],
    'can_be_locked_in_later',
    'norris',
    2
  );
  const norrisLaterP3 = findInsight(
    data2025.driverLockInsights[String(singaporeRaceNum)],
    'can_be_locked_in_later',
    'norris',
    3
  );
  const norrisLaterP4 = findInsight(
    data2025.driverLockInsights[String(singaporeRaceNum)],
    'can_be_locked_in_later',
    'norris',
    4
  );

  assert.ok(norrisLaterP1, 'Expected a later P1 guarantee insight for Norris after Singapore 2025');
  assert.ok(norrisLaterP2, 'Expected a later P2 guarantee insight for Norris after Singapore 2025');
  assert.ok(norrisLaterP3, 'Expected a later P3 guarantee insight for Norris after Singapore 2025');
  assert.ok(norrisLaterP4, 'Expected a later P4 guarantee insight for Norris after Singapore 2025');
});

test('Lock-in insight: next-race ruled-out positions are exposed', () => {
  const data2025 = readCalculationResults(2025);
  assert.ok(data2025, 'No calculation results found for 2025. Run pnpm calculate first.');

  const mexicoRaceNum = data2025.races.findIndex((r) => r.round === 20 && r.type === 'race') + 1;
  assert.ok(mexicoRaceNum > 0, 'Mexico 2025 race not found');

  const leclercP3RuleOut = findInsight(
    data2025.driverLockInsights[String(mexicoRaceNum)],
    'can_be_ruled_out_next_race',
    'leclerc',
    3
  );
  assert.ok(leclercP3RuleOut, 'Leclerc P3 rule-out insight missing after Mexico 2025');
  assert.equal(leclercP3RuleOut.type, 'can_be_ruled_out_next_race');
  if (leclercP3RuleOut.type === 'can_be_ruled_out_next_race') {
    assert.ok(
      leclercP3RuleOut.mustBeOutscoredBy.length + leclercP3RuleOut.cannotOutscoreByMoreThan.length > 0,
      'Expected at least one rule-out condition for Leclerc P3'
    );
    assert.deepEqual(leclercP3RuleOut.cannotOutscoreByMoreThan, [
      { opponentId: 'max_verstappen', points: 2 },
    ]);
  }
});

test('Lock-in insight: impossible next-event margins are omitted from upper-bound conditions', () => {
  for (let year = 2010; year <= 2026; year++) {
    const data = readCalculationResults(year);
    assert.ok(data, `No calculation results found for ${year}. Run pnpm calculate first.`);

    for (const [insightMap, races] of [
      [data.driverLockInsights, data.races],
      [data.constructorLockInsights, data.races],
    ] as const) {
      for (const insights of Object.values(insightMap)) {
        for (const insight of insights) {
          if (insight.type !== 'can_be_locked_in_next_race' && insight.type !== 'can_be_ruled_out_next_race') continue;

          const nextRace = races[insight.nextRaceNum - 1];
          const maxDelta =
            insightMap === data.driverLockInsights ? nextRace.maxDriverPoints : nextRace.maxConstructorPoints;

          if (insight.type === 'can_be_locked_in_next_race') {
            for (const condition of insight.cannotBeOutscoredByMoreThan) {
              assert.ok(
                condition.points < maxDelta,
                `${year} ${insight.entityId}-P${insight.position} includes impossible cannotBeOutscoredByMoreThan=${condition.points} for maxDelta=${maxDelta}`
              );
            }
          }

          if (insight.type === 'can_be_ruled_out_next_race') {
            for (const condition of insight.cannotOutscoreByMoreThan) {
              assert.ok(
                condition.points < maxDelta,
                `${year} ${insight.entityId}-P${insight.position} includes impossible cannotOutscoreByMoreThan=${condition.points} for maxDelta=${maxDelta}`
              );
            }
          }
        }
      }
    }
  }
});

test('All explicit lock margins are positive', () => {
  for (let year = 2010; year <= 2026; year++) {
    const data = readCalculationResults(year);
    assert.ok(data, `No calculation results found for ${year}. Run pnpm calculate first.`);

    for (const insightMap of [data.driverLockInsights, data.constructorLockInsights]) {
      for (const insights of Object.values(insightMap)) {
        for (const insight of insights) {
          if (insight.type === 'can_be_locked_in_next_race') {
            for (const condition of insight.mustOutscoreBy) {
              assert.ok(
                condition.points > 0,
                `${year} ${insight.entityId}-P${insight.position} has non-positive mustOutscoreBy=${condition.points}`
              );
            }
          }

          if (insight.type === 'can_be_ruled_out_next_race') {
            for (const condition of insight.mustBeOutscoredBy) {
              assert.ok(
                condition.points > 0,
                `${year} ${insight.entityId}-P${insight.position} has non-positive mustBeOutscoredBy=${condition.points}`
              );
            }
          }
        }
      }
    }
  }
});

test('All can_be_locked_in_next_race insights include at least one lock condition', () => {
  for (let year = 2010; year <= 2026; year++) {
    const data = readCalculationResults(year);
    assert.ok(data, `No calculation results found for ${year}. Run pnpm calculate first.`);

    for (const insightMap of [data.driverLockInsights, data.constructorLockInsights]) {
      for (const [afterRaceNum, insights] of Object.entries(insightMap)) {
        for (const insight of insights) {
          if (insight.type === 'can_be_locked_in_next_race') {
            const conditionCount =
              insight.mustOutscoreBy.length +
              insight.cannotBeOutscoredByMoreThan.length;

            assert.ok(
              conditionCount > 0,
              `${year} afterRaceNum=${afterRaceNum} ${insight.entityId}-P${insight.position} is can_be_locked_in_next_race without any lock condition`
            );
          }

          if (insight.type === 'can_be_ruled_out_next_race') {
            const conditionCount =
              insight.mustBeOutscoredBy.length +
              insight.cannotOutscoreByMoreThan.length;

            assert.ok(
              conditionCount > 0,
              `${year} afterRaceNum=${afterRaceNum} ${insight.entityId}-P${insight.position} is can_be_ruled_out_next_race without any lock condition`
            );
          }
        }
      }
    }
  }
});

test('All already_locked_in insights match a single exact end-of-season projected position', () => {
  for (let year = 2010; year <= 2026; year++) {
    const data = readCalculationResults(year);
    assert.ok(data, `No calculation results found for ${year}. Run pnpm calculate first.`);

    for (const [insightMap, projectionMap] of [
      [data.driverLockInsights, data.driverProjections],
      [data.constructorLockInsights, data.constructorProjections],
    ] as const) {
      const entities = projectionMap === data.driverProjections ? data.drivers : data.constructors;

      for (const [afterRaceNum, insights] of Object.entries(insightMap)) {
        const afterRaceNumNum = Number(afterRaceNum);
        const endProjection: Record<string, ProjectionEntry> | undefined =
          projectionMap[afterRaceNum]?.[String(data.races.length)];

        for (const insight of insights) {
          if (insight.type !== 'already_locked_in') continue;

          if (endProjection) {
            const entry: ProjectionEntry | undefined = endProjection[insight.entityId];
            assert.ok(
              entry,
              `${year} afterRaceNum=${afterRaceNum} ${insight.entityId}-P${insight.position} is missing an end-of-season projection entry`
            );
            assert.equal(
              entry.bestPos,
              insight.position,
              `${year} afterRaceNum=${afterRaceNum} ${insight.entityId}-P${insight.position} bestPos does not match already_locked_in position`
            );
            assert.equal(
              entry.worstPos,
              insight.position,
              `${year} afterRaceNum=${afterRaceNum} ${insight.entityId}-P${insight.position} worstPos does not match already_locked_in position`
            );
            continue;
          }

          assert.equal(
            afterRaceNumNum,
            data.races.length,
            `${year} afterRaceNum=${afterRaceNum} is missing end-of-season projections before the final race`
          );
          const actualPosition = actualPositionAtRace(entities, afterRaceNumNum, insight.entityId);
          assert.equal(
            actualPosition,
            insight.position,
            `${year} afterRaceNum=${afterRaceNum} ${insight.entityId}-P${insight.position} actual final position does not match already_locked_in position`
          );
        }
      }
    }
  }
});
