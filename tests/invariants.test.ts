import assert from "node:assert/strict";
import test from "node:test";
import type { LockInsight, ProjectionEntry, ProjectionMap } from "../lib/calculate.ts";
import { readCalculationResults } from "../lib/calculation-results.ts";

function positionAtRace(pointsAtRace: Map<string, number>, entityId: string): number {
  const pts = pointsAtRace.get(entityId) ?? 0;
  return (
    1 +
    [...pointsAtRace.entries()].filter(([id, otherPts]) => id !== entityId && otherPts > pts).length
  );
}

function validateProjectionAgainstActual(
  projections: ProjectionMap,
  entities: { id: string; cumulativePoints: (number | null)[] }[],
  afterRaceNum: number,
  futureRaceNum: number,
  label: string,
): void {
  const projectionForFuture = projections[String(afterRaceNum)]?.[String(futureRaceNum)];
  assert.ok(
    projectionForFuture,
    `${label}: missing projection for afterRaceNum=${afterRaceNum}, futureRaceNum=${futureRaceNum}`,
  );

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
      `${label}: ${entity.id} points ${actualPts} not in [${entry.minPts}, ${entry.maxPts}] for afterRaceNum=${afterRaceNum}, futureRaceNum=${futureRaceNum}`,
    );

    const actualPos = positionAtRace(pointsAtFuture, entity.id);
    assert.ok(
      actualPos >= entry.bestPos && (entry.worstPos === null || actualPos <= entry.worstPos),
      `${label}: ${entity.id} position ${actualPos} not in [${entry.bestPos}, ${entry.worstPos ?? "last"}] for afterRaceNum=${afterRaceNum}, futureRaceNum=${futureRaceNum}`,
    );
  }
}

test("All projections contain actual future points and positions for completed races across all seasons", () => {
  for (let year = 2010; year <= 2026; year++) {
    const data = readCalculationResults(year)!;

    for (let afterRaceNum = 1; afterRaceNum <= data.lastCompletedRaceNum; afterRaceNum++) {
      for (
        let futureRaceNum = afterRaceNum + 1;
        futureRaceNum <= data.lastCompletedRaceNum;
        futureRaceNum++
      ) {
        if (!data.races[futureRaceNum - 1].completed) continue;
        validateProjectionAgainstActual(
          data.driverProjections,
          data.drivers,
          afterRaceNum,
          futureRaceNum,
          `drivers-${year}`,
        );
        validateProjectionAgainstActual(
          data.constructorProjections,
          data.constructors,
          afterRaceNum,
          futureRaceNum,
          `constructors-${year}`,
        );
      }
    }
  }
});

test("Lock-in insight: impossible next-event margins are omitted from upper-bound conditions", () => {
  for (let year = 2010; year <= 2026; year++) {
    const data = readCalculationResults(year)!;

    for (const [insightMap, races] of [
      [data.driverLockInsights, data.races],
      [data.constructorLockInsights, data.races],
    ] as const) {
      for (const insights of Object.values(insightMap)) {
        for (const insight of insights) {
          if (
            insight.type !== "can_be_locked_in_next_race" &&
            insight.type !== "can_be_ruled_out_next_race"
          )
            continue;

          const nextRace = races[insight.nextRaceNum - 1];
          const maxDelta =
            insightMap === data.driverLockInsights
              ? nextRace.maxDriverPoints
              : nextRace.maxConstructorPoints;

          if (insight.type === "can_be_locked_in_next_race") {
            for (const condition of insight.cannotBeOutscoredByMoreThan) {
              assert.ok(
                condition.points < maxDelta,
                `${year} ${insight.entityId}-P${insight.position} includes impossible cannotBeOutscoredByMoreThan=${condition.points} for maxDelta=${maxDelta}`,
              );
            }
          }

          if (insight.type === "can_be_ruled_out_next_race") {
            for (const condition of insight.cannotOutscoreByMoreThan) {
              assert.ok(
                condition.points < maxDelta,
                `${year} ${insight.entityId}-P${insight.position} includes impossible cannotOutscoreByMoreThan=${condition.points} for maxDelta=${maxDelta}`,
              );
            }
          }
        }
      }
    }
  }
});

test("All explicit lock margins are positive", () => {
  for (let year = 2010; year <= 2026; year++) {
    const data = readCalculationResults(year)!;

    for (const insightMap of [data.driverLockInsights, data.constructorLockInsights]) {
      for (const insights of Object.values(insightMap)) {
        for (const insight of insights) {
          if (insight.type === "can_be_locked_in_next_race") {
            for (const condition of insight.mustOutscoreBy) {
              assert.ok(
                condition.points > 0,
                `${year} ${insight.entityId}-P${insight.position} has non-positive mustOutscoreBy=${condition.points}`,
              );
            }
          }

          if (insight.type === "can_be_ruled_out_next_race") {
            for (const condition of insight.mustBeOutscoredBy) {
              assert.ok(
                condition.points > 0,
                `${year} ${insight.entityId}-P${insight.position} has non-positive mustBeOutscoredBy=${condition.points}`,
              );
            }
          }
        }
      }
    }
  }
});

test("All can_be_locked_in_next_race insights include at least one lock condition", () => {
  for (let year = 2010; year <= 2026; year++) {
    const data = readCalculationResults(year)!;

    for (const insightMap of [data.driverLockInsights, data.constructorLockInsights]) {
      for (const [afterRaceNum, insights] of Object.entries(insightMap)) {
        for (const insight of insights) {
          if (
            insight.type === "can_be_locked_in_next_race" &&
            insight.positionCombinations === undefined
          ) {
            const conditionCount =
              insight.mustOutscoreBy.length + insight.cannotBeOutscoredByMoreThan.length;

            assert.ok(
              conditionCount > 0,
              `${year} afterRaceNum=${afterRaceNum} ${insight.entityId}-P${insight.position} is can_be_locked_in_next_race without any lock condition`,
            );
          }

          if (insight.type === "can_be_ruled_out_next_race") {
            const conditionCount =
              insight.mustBeOutscoredBy.length + insight.cannotOutscoreByMoreThan.length;

            assert.ok(
              conditionCount > 0,
              `${year} afterRaceNum=${afterRaceNum} ${insight.entityId}-P${insight.position} is can_be_ruled_out_next_race without any lock condition`,
            );
          }
        }
      }
    }
  }
});

test("All already_locked_in insights match a single exact end-of-season projected position", () => {
  for (let year = 2010; year <= 2026; year++) {
    const data = readCalculationResults(year)!;

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
          if (insight.type !== "already_locked_in") continue;

          if (endProjection) {
            const entry: ProjectionEntry | undefined = endProjection[insight.entityId];
            assert.ok(
              entry,
              `${year} afterRaceNum=${afterRaceNum} ${insight.entityId}-P${insight.position} is missing an end-of-season projection entry`,
            );
            assert.equal(
              entry.bestPos,
              insight.position,
              `${year} afterRaceNum=${afterRaceNum} ${insight.entityId}-P${insight.position} bestPos does not match already_locked_in position`,
            );
            assert.equal(
              entry.worstPos,
              insight.position,
              `${year} afterRaceNum=${afterRaceNum} ${insight.entityId}-P${insight.position} worstPos does not match already_locked_in position`,
            );
            continue;
          }

          assert.equal(
            afterRaceNumNum,
            data.races.length,
            `${year} afterRaceNum=${afterRaceNum} is missing end-of-season projections before the final race`,
          );
          const entity = entities.find((e) => e.id === insight.entityId)!;
          const actualPosition = entity.currentPos[afterRaceNumNum - 1];
          assert.equal(
            actualPosition,
            insight.position,
            `${year} afterRaceNum=${afterRaceNum} ${insight.entityId}-P${insight.position} actual final position does not match already_locked_in position`,
          );
        }
      }
    }
  }
});
