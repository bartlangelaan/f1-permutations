import { getEventResults, getRaces } from "./data";
import {
  maxRacePointsDriver,
  maxRacePointsConstructor,
  maxSprintPointsDriver,
  maxSprintPointsConstructor,
  raceDriverMaxPointsByPosition,
  sprintDriverPointsByPosition,
} from "./points";

// Official / near-official team colors for every constructor since 2010
const TEAM_COLORS: Record<string, string> = {
  // Current teams
  ferrari: "#E8002D",
  red_bull: "#3671C6",
  mercedes: "#00D2BE",
  mclaren: "#FF8000",
  aston_martin: "#358C75",
  alpine: "#FF87BC",
  williams: "#64C4FF",
  haas: "#B6BABD",
  rb: "#6692FF", // RB (2024+)
  sauber: "#52E252", // Kick Sauber (2024+)
  // Historical
  alphatauri: "#5E8FAA", // 2020-2023
  toro_rosso: "#C72B2B", // 2006-2019
  alfa: "#C92D4B", // Alfa Romeo 2019-2023
  racing_point: "#F596C8", // 2018-2020
  force_india: "#F596C8", // 2008-2018 (same pink)
  renault: "#FFF500", // 2010-2020
  lotus_f1: "#FFD700", // 2012-2015 (black+gold → use gold)
  lotus_racing: "#FFD700", // 2010-2011
  caterham: "#006F3C",
  marussia: "#8B0000",
  manor: "#8B0000",
  hrt: "#A0522D",
  virgin: "#CC2200",
};

const FALLBACK_COLORS = [
  "#e8002d",
  "#3671c6",
  "#27f4d2",
  "#ff8000",
  "#358c75",
  "#b6babd",
  "#c92d4b",
  "#5e8faa",
  "#f0d800",
  "#64c4ff",
  "#f596c8",
  "#7cc8a4",
  "#d9a600",
  "#a374dc",
  "#6dd25a",
  "#ff6b6b",
  "#4ecdc4",
  "#a8d8ea",
  "#ffcc99",
  "#b8e0d2",
];

function teamColor(constructorId: string, fallbackIdx: number): string {
  return TEAM_COLORS[constructorId] ?? FALLBACK_COLORS[fallbackIdx % FALLBACK_COLORS.length];
}

function maxOvertakesSingleDriverRace(
  basePts: Map<string, number>,
  targetId: string,
  targetMinPts: number,
  eventPoints: number[],
): number {
  const threshold = targetMinPts + 1;
  const deficits: number[] = [];
  let alreadyAhead = 0;

  for (const [id, pts] of basePts.entries()) {
    if (id === targetId) continue;
    const need = threshold - pts;
    if (need <= 0) {
      alreadyAhead++;
    } else if (need <= eventPoints[0]) {
      deficits.push(need);
    }
  }

  deficits.sort((a, b) => a - b);
  const available = [...eventPoints].sort((a, b) => a - b);

  let additionalOvertakes = 0;
  let i = 0;
  let j = 0;
  while (i < deficits.length && j < available.length) {
    if (available[j] >= deficits[i]) {
      additionalOvertakes++;
      i++;
      j++;
    } else {
      j++;
    }
  }

  return alreadyAhead + additionalOvertakes;
}

/**
 * Base driver points by finishing position for a race, without the fastest-lap bonus.
 * Used for conservative "unconditional guarantee" calculations: the entity may not score
 * the fastest-lap point, so we credit only the base finishing-position score.
 */
function driverBasePointsByPosition(year: number, race: TimelineRace): number[] {
  if (race.type === "sprint") {
    return sprintDriverPointsByPosition(year);
  }
  // For regular races with a fastest-lap bonus (2019–2024), subtract 1 from each position's max.
  const maxPts = raceDriverMaxPointsByPosition(year);
  const hasFl = maxPts[0] > 25; // fastest-lap years have P1 max = 26
  if (hasFl) {
    return maxPts.map((p) => p - 1);
  }
  // Handle double-points race (2014 Abu Dhabi)
  const standardMax = maxRacePointsDriver(year);
  if (race.maxDriverPoints !== standardMax) {
    const multiplier = race.maxDriverPoints / standardMax;
    return maxPts.map((p) => p * multiplier);
  }
  return maxPts;
}

function driverPointsByPositionForRace(year: number, race: TimelineRace): number[] {
  if (race.type === "sprint") {
    return sprintDriverPointsByPosition(year);
  }

  const baseRacePoints = raceDriverMaxPointsByPosition(year);
  const standardRaceMax = maxRacePointsDriver(year);
  if (race.maxDriverPoints === standardRaceMax) {
    return baseRacePoints;
  }

  const multiplier = race.maxDriverPoints / standardRaceMax;
  return baseRacePoints.map((pts) => pts * multiplier);
}

export interface TimelineRace {
  round: number;
  type: "sprint" | "race";
  /** Short x-axis label, e.g. "R1" or "S4" */
  label: string;
  /** Full name, e.g. "Bahrain GP" or "R4 Sprint" */
  fullLabel: string;
  maxDriverPoints: number;
  maxConstructorPoints: number;
  completed: boolean;
}

export interface EntitySeries {
  id: string;
  name: string;
  color: string;
  /** cumulativePoints[i] = points after race i+1 (0-indexed array); null if race not yet run */
  cumulativePoints: (number | null)[];
  /** currentPos[i] = championship position after race i+1 (0-indexed array); null if race not yet run */
  currentPos: (number | null)[];
}

interface SeasonChartData {
  year: number;
  races: TimelineRace[];
  /** 1-based number of the last completed race, 0 if none */
  lastCompletedRaceNum: number;
  drivers: EntitySeries[];
  constructors: EntitySeries[];
}

export type ProjectionEntry = {
  minPts: number;
  maxPts: number;
  bestPos: number;
  worstPos: number | null;
};
/** projections[afterRaceNum][futureRaceNum][entityId] — all race numbers are 1-based */
export type ProjectionMap = Record<string, Record<string, Record<string, ProjectionEntry>>>;

type LockCondition = {
  opponentId: string;
  points: number;
};

export type LockInsight =
  | {
      type: "already_locked_in";
      entityId: string;
      position: number;
    }
  | {
      type: "can_be_locked_in_next_race";
      entityId: string;
      position: number;
      nextRaceNum: number;
      mustOutscoreBy: LockCondition[];
      cannotBeOutscoredByMoreThan: LockCondition[];
      /**
       * Worst finishing position (1-based) at which this driver unconditionally guarantees
       * `position` in the championship, regardless of all rivals' results. Only present for
       * drivers (not constructors) and only when such a position exists.
       */
      finishAtOrBetter?: number;
    }
  | {
      type: "can_be_locked_in_later";
      entityId: string;
      position: number;
      earliestRaceNum: number;
    }
  | {
      type: "can_be_ruled_out_next_race";
      entityId: string;
      position: number;
      nextRaceNum: number;
      mustBeOutscoredBy: LockCondition[];
      cannotOutscoreByMoreThan: LockCondition[];
    }
  | {
      type: "can_be_ruled_out_later";
      entityId: string;
      position: number;
      earliestRaceNum: number;
    };

/** lockInsights[afterRaceNum] — race number is 1-based */
export type LockInsightMap = Record<string, LockInsight[]>;

export interface CalculatedChartData extends SeasonChartData {
  driverProjections: ProjectionMap;
  constructorProjections: ProjectionMap;
  driverLockInsights: LockInsightMap;
  constructorLockInsights: LockInsightMap;
}

function raceMaxPoints(race: TimelineRace, isDriver: boolean): number {
  return isDriver ? race.maxDriverPoints : race.maxConstructorPoints;
}

function cumulativeMaxPoints(
  races: TimelineRace[],
  fromRaceNum: number,
  toRaceNum: number,
  isDriver: boolean,
): number {
  if (toRaceNum <= fromRaceNum) return 0;
  let total = 0;
  for (let i = fromRaceNum + 1; i <= toRaceNum; i++) {
    total += raceMaxPoints(races[i - 1], isDriver);
  }
  return total;
}

function findGuaranteePlanForPosition(
  entityId: string,
  position: number,
  entityIds: string[],
  basePts: Map<string, number>,
  horizonMaxDelta: number,
  pointsRemainingAfterHorizon: number,
): {
  mustOutscoreBy: LockCondition[];
  cannotBeOutscoredByMoreThan: LockCondition[];
} | null {
  const opponents = entityIds
    .filter((id) => id !== entityId)
    .map((opponentId) => {
      const currentGap = (basePts.get(entityId) ?? 0) - (basePts.get(opponentId) ?? 0);
      const requiredForEntityAbove = pointsRemainingAfterHorizon + 1 - currentGap;

      return {
        opponentId,
        requiredForEntityAbove,
        canForceEntityAbove: requiredForEntityAbove <= horizonMaxDelta,
      };
    });

  const requiredBelowCount = entityIds.length - position;
  const forceableBelow = opponents.filter((opponent) => opponent.canForceEntityAbove);
  if (forceableBelow.length < requiredBelowCount) {
    return null;
  }

  const mustOutscoreBy: LockCondition[] = [];
  const cannotBeOutscoredByMoreThan: LockCondition[] = [];
  const selectedBelow = forceableBelow
    .sort((a, b) => a.requiredForEntityAbove - b.requiredForEntityAbove)
    .slice(0, requiredBelowCount);

  for (const opponent of selectedBelow) {
    if (opponent.requiredForEntityAbove > 0) {
      mustOutscoreBy.push({
        opponentId: opponent.opponentId,
        points: opponent.requiredForEntityAbove,
      });
    } else if (-opponent.requiredForEntityAbove < horizonMaxDelta) {
      cannotBeOutscoredByMoreThan.push({
        opponentId: opponent.opponentId,
        points: -opponent.requiredForEntityAbove,
      });
    }
  }

  mustOutscoreBy.sort((a, b) => b.points - a.points);
  cannotBeOutscoredByMoreThan.sort((a, b) => a.points - b.points);

  return {
    mustOutscoreBy,
    cannotBeOutscoredByMoreThan,
  };
}

function findRuleOutPlanForPosition(
  entityId: string,
  position: number,
  entityIds: string[],
  basePts: Map<string, number>,
  horizonMaxDelta: number,
  pointsRemainingAfterHorizon: number,
): {
  mustBeOutscoredBy: LockCondition[];
  cannotOutscoreByMoreThan: LockCondition[];
} | null {
  const opponents = entityIds
    .filter((id) => id !== entityId)
    .map((opponentId) => {
      const currentGap = (basePts.get(entityId) ?? 0) - (basePts.get(opponentId) ?? 0);
      const requiredForOpponentAbove = -pointsRemainingAfterHorizon - 1 - currentGap;

      return {
        opponentId,
        requiredForOpponentAbove,
        canForceOpponentAbove: requiredForOpponentAbove >= -horizonMaxDelta,
      };
    });

  const requiredAboveCount = position;
  const forceableAbove = opponents.filter((opponent) => opponent.canForceOpponentAbove);
  if (forceableAbove.length < requiredAboveCount) {
    return null;
  }

  const mustBeOutscoredBy: LockCondition[] = [];
  const cannotOutscoreByMoreThan: LockCondition[] = [];
  const selectedAbove = forceableAbove
    .sort((a, b) => b.requiredForOpponentAbove - a.requiredForOpponentAbove)
    .slice(0, requiredAboveCount);

  for (const opponent of selectedAbove) {
    if (opponent.requiredForOpponentAbove < 0) {
      mustBeOutscoredBy.push({
        opponentId: opponent.opponentId,
        points: -opponent.requiredForOpponentAbove,
      });
    } else if (opponent.requiredForOpponentAbove < horizonMaxDelta) {
      cannotOutscoreByMoreThan.push({
        opponentId: opponent.opponentId,
        points: opponent.requiredForOpponentAbove,
      });
    }
  }

  mustBeOutscoredBy.sort((a, b) => b.points - a.points);
  cannotOutscoreByMoreThan.sort((a, b) => a.points - b.points);

  return {
    mustBeOutscoredBy,
    cannotOutscoreByMoreThan,
  };
}

function hasGuaranteeConditions(plan: {
  mustOutscoreBy: LockCondition[];
  cannotBeOutscoredByMoreThan: LockCondition[];
}): boolean {
  return plan.mustOutscoreBy.length > 0 || plan.cannotBeOutscoredByMoreThan.length > 0;
}

function hasRuleOutConditions(plan: {
  mustBeOutscoredBy: LockCondition[];
  cannotOutscoreByMoreThan: LockCondition[];
}): boolean {
  return plan.mustBeOutscoredBy.length > 0 || plan.cannotOutscoreByMoreThan.length > 0;
}

/**
 * Returns the worst finishing position (1-based) at the next race that unconditionally
 * guarantees `position` in the championship — i.e., even if all rivals score maximum
 * at the next race and all subsequent races.
 *
 * Returns null if no such finishing position exists (rivals can always prevent the guarantee).
 *
 * Only applicable for drivers, since constructors have no simple per-finishing-position points table.
 */
function findUnconditionalGuaranteeFinishingPos(
  entityId: string,
  position: number,
  entityIds: string[],
  basePts: Map<string, number>,
  /** Base points by finishing position (descending), e.g. [25, 18, 15, ...]. No fastest-lap bonus. */
  basePointsTable: number[],
  /** Maximum points any rival can score at the next race (may include fastest-lap bonus). */
  nextRaceMaxPoints: number,
  pointsRemainingAfterNext: number,
): number | null {
  const entityPts = basePts.get(entityId) ?? 0;
  const opponents = entityIds.filter((id) => id !== entityId);

  // Sort rivals by their best possible final score, descending (hardest to stay ahead of first).
  const opponentMaxFinals = opponents
    .map((id) => (basePts.get(id) ?? 0) + nextRaceMaxPoints + pointsRemainingAfterNext)
    .sort((a, b) => b - a);

  // To guarantee championship `position`, entity can allow at most (position - 1) rivals to finish
  // above it. Entity must therefore beat the rival at index (position - 1) in the sorted list
  // (the position-th strongest rival).
  if (position - 1 >= opponentMaxFinals.length) return null;

  // The hardest rival that entity must beat to guarantee `position`.
  const hardestRivalMaxFinal = opponentMaxFinals[position - 1];

  // Points entity needs at the next race so that entity's minimum total > hardestRivalMaxFinal.
  const requiredNextRacePoints = hardestRivalMaxFinal - entityPts + 1;

  if (requiredNextRacePoints <= 0) {
    // Entity is already guaranteed regardless — covered by already_locked_in.
    return null;
  }

  // Find the worst finishing position in the base points table that scores >= requiredNextRacePoints.
  let worstGuaranteePos = 0;
  for (let i = 0; i < basePointsTable.length; i++) {
    if (basePointsTable[i] >= requiredNextRacePoints) {
      worstGuaranteePos = i + 1; // 1-based
    }
  }

  return worstGuaranteePos > 0 ? worstGuaranteePos : null;
}

export function computeLockInsightsForSelectedRace(
  data: SeasonChartData,
  afterRaceNum: number,
  isDriver: boolean,
): LockInsight[] {
  const entities = isDriver ? data.drivers : data.constructors;
  const entityIds = entities.map((e) => e.id);
  const lastRaceNum = data.races.length;
  const nextRaceNum = afterRaceNum + 1;
  const insights: LockInsight[] = [];

  const basePts = new Map<string, number>();
  for (const entity of entities) {
    basePts.set(entity.id, entity.cumulativePoints[afterRaceNum - 1] ?? 0);
  }

  const endProjections = computeProjectionsForSelectedRace(data, afterRaceNum, isDriver)[
    lastRaceNum
  ];
  if (!endProjections) return insights;

  const orderedEntities = [...entities].sort((a, b) => {
    const pointDelta = (basePts.get(b.id) ?? 0) - (basePts.get(a.id) ?? 0);
    if (pointDelta !== 0) return pointDelta;
    return a.name.localeCompare(b.name);
  });
  const hasInsight = (entityId: string, position: number, type: LockInsight["type"]): boolean =>
    insights.some(
      (insight) =>
        insight.entityId === entityId && insight.position === position && insight.type === type,
    );

  for (const entity of orderedEntities) {
    const endEntry = endProjections[entity.id];
    if (!endEntry) continue;

    if (endEntry.bestPos === endEntry.worstPos) {
      insights.push({
        type: "already_locked_in",
        entityId: entity.id,
        position: endEntry.bestPos,
      });
      continue;
    }

    if (nextRaceNum <= lastRaceNum) {
      const nextHorizonMax = cumulativeMaxPoints(data.races, afterRaceNum, nextRaceNum, isDriver);
      const pointsRemainingAfterNext = cumulativeMaxPoints(
        data.races,
        nextRaceNum,
        lastRaceNum,
        isDriver,
      );

      for (
        let position = endEntry.bestPos;
        position <= (endEntry.worstPos ?? entities.length);
        position++
      ) {
        const nextPlan = findGuaranteePlanForPosition(
          entity.id,
          position,
          entityIds,
          basePts,
          nextHorizonMax,
          pointsRemainingAfterNext,
        );

        if (!nextPlan) continue;
        if (!hasGuaranteeConditions(nextPlan)) continue;

        let finishAtOrBetter: number | undefined;
        if (isDriver) {
          const nextRace = data.races[nextRaceNum - 1];
          const basePointsTable = driverBasePointsByPosition(data.year, nextRace);
          const pos = findUnconditionalGuaranteeFinishingPos(
            entity.id,
            position,
            entityIds,
            basePts,
            basePointsTable,
            nextHorizonMax,
            pointsRemainingAfterNext,
          );
          if (pos !== null) finishAtOrBetter = pos;
        }

        insights.push({
          type: "can_be_locked_in_next_race",
          entityId: entity.id,
          position,
          nextRaceNum,
          mustOutscoreBy: nextPlan.mustOutscoreBy,
          cannotBeOutscoredByMoreThan: nextPlan.cannotBeOutscoredByMoreThan,
          ...(finishAtOrBetter !== undefined && { finishAtOrBetter }),
        });
      }

      for (
        let position = endEntry.bestPos;
        position < (endEntry.worstPos ?? entities.length);
        position++
      ) {
        const ruleOutPlan = findRuleOutPlanForPosition(
          entity.id,
          position,
          entityIds,
          basePts,
          nextHorizonMax,
          pointsRemainingAfterNext,
        );

        if (!ruleOutPlan) continue;
        if (!hasRuleOutConditions(ruleOutPlan)) continue;

        insights.push({
          type: "can_be_ruled_out_next_race",
          entityId: entity.id,
          position,
          nextRaceNum,
          mustBeOutscoredBy: ruleOutPlan.mustBeOutscoredBy,
          cannotOutscoreByMoreThan: ruleOutPlan.cannotOutscoreByMoreThan,
        });
      }
    }

    for (
      let position = endEntry.bestPos;
      position <= (endEntry.worstPos ?? entities.length);
      position++
    ) {
      if (hasInsight(entity.id, position, "can_be_locked_in_next_race")) continue;

      let earliestRaceNum = 0;
      for (let raceNum = afterRaceNum + 2; raceNum <= lastRaceNum; raceNum++) {
        const horizonMax = cumulativeMaxPoints(data.races, afterRaceNum, raceNum, isDriver);
        const pointsRemaining = cumulativeMaxPoints(data.races, raceNum, lastRaceNum, isDriver);
        const plan = findGuaranteePlanForPosition(
          entity.id,
          position,
          entityIds,
          basePts,
          horizonMax,
          pointsRemaining,
        );
        if (plan) {
          const nextRoundStart = data.races.findIndex(
            (race, idx) => idx + 1 > raceNum && race.round > data.races[raceNum - 1].round,
          );
          earliestRaceNum = nextRoundStart >= 0 ? nextRoundStart + 1 : raceNum;
          break;
        }
      }

      if (earliestRaceNum > 0) {
        insights.push({
          type: "can_be_locked_in_later",
          entityId: entity.id,
          position,
          earliestRaceNum,
        });
      }
    }

    for (
      let position = endEntry.bestPos;
      position < (endEntry.worstPos ?? entities.length);
      position++
    ) {
      if (hasInsight(entity.id, position, "can_be_locked_in_next_race")) continue;
      if (hasInsight(entity.id, position, "can_be_locked_in_later")) continue;
      if (hasInsight(entity.id, position, "can_be_ruled_out_next_race")) continue;

      let earliestRaceNum = 0;
      for (let raceNum = afterRaceNum + 2; raceNum <= lastRaceNum; raceNum++) {
        const horizonMax = cumulativeMaxPoints(data.races, afterRaceNum, raceNum, isDriver);
        const pointsRemaining = cumulativeMaxPoints(data.races, raceNum, lastRaceNum, isDriver);
        const plan = findRuleOutPlanForPosition(
          entity.id,
          position,
          entityIds,
          basePts,
          horizonMax,
          pointsRemaining,
        );
        if (!plan) continue;
        if (!hasRuleOutConditions(plan)) continue;

        const nextRoundStart = data.races.findIndex(
          (race, idx) => idx + 1 > raceNum && race.round > data.races[raceNum - 1].round,
        );
        earliestRaceNum = nextRoundStart >= 0 ? nextRoundStart + 1 : raceNum;
        break;
      }

      if (earliestRaceNum > 0) {
        insights.push({
          type: "can_be_ruled_out_later",
          entityId: entity.id,
          position,
          earliestRaceNum,
        });
      }
    }
  }

  return insights;
}

/**
 * Builds the ordered timeline races for a year from the race schedule.
 * completed reflects whether result data exists for each race.
 */
export function buildRaces(year: number): TimelineRace[] {
  const races = getRaces(year);
  return races.map((race, index) => {
    const shortName = race.raceName.replace(" Grand Prix", " GP");
    const results = getEventResults(year, index + 1);
    return {
      round: race.round,
      type: race.type,
      label: `R${index + 1}`,
      fullLabel: race.type === "sprint" ? `R${index + 1} ${shortName} Sprint` : shortName,
      maxDriverPoints:
        year === 2014 && race.type === "race" && race.round === 19
          ? 50
          : race.type === "sprint"
            ? maxSprintPointsDriver(year)
            : maxRacePointsDriver(year),
      maxConstructorPoints:
        year === 2014 && race.type === "race" && race.round === 19
          ? 86
          : race.type === "sprint"
            ? maxSprintPointsConstructor(year)
            : maxRacePointsConstructor(year),
      completed: results !== null && results.length > 0,
    };
  });
}

export function buildSeasonChartData(year: number, upToRaceNum?: number): SeasonChartData {
  // Build ordered timeline races from normalized race data; completed starts false
  // and is set to true below as results are accumulated.
  const races: TimelineRace[] = buildRaces(year).map((race) => ({ ...race, completed: false }));

  // When upToRaceNum is provided, only accumulate results up to that race number (1-based).
  // Races beyond that cutoff are treated as not yet completed (null snapshots),
  // ensuring that drivers/constructors from future races do not appear in earlier calculations.
  const cutoff = upToRaceNum !== undefined ? upToRaceNum : races.length;

  // Accumulate cumulative points race-by-race
  const driverCum = new Map<string, number>();
  const constructorCum = new Map<string, number>();
  const driverNames = new Map<string, string>();
  const constructorNames = new Map<string, string>();
  // Track the most recent constructor for each driver (for color assignment)
  const driverConstructor = new Map<string, string>();

  const driverSnaps: (Map<string, number> | null)[] = [];
  const constructorSnaps: (Map<string, number> | null)[] = [];
  let lastCompletedRaceNum = 0;

  for (let i = 0; i < races.length; i++) {
    const raceNum = i + 1;
    const race = races[i];

    if (raceNum <= cutoff) {
      const results = getEventResults(year, raceNum);

      if (results !== null && results.length > 0) {
        race.completed = true;
        lastCompletedRaceNum = raceNum;
        for (const r of results) {
          driverCum.set(r.driverId, (driverCum.get(r.driverId) ?? 0) + r.points);
          constructorCum.set(
            r.constructorId,
            (constructorCum.get(r.constructorId) ?? 0) + r.points,
          );
          driverNames.set(r.driverId, r.driverName);
          constructorNames.set(r.constructorId, r.constructorName);
          driverConstructor.set(r.driverId, r.constructorId);
        }
        driverSnaps.push(new Map(driverCum));
        constructorSnaps.push(new Map(constructorCum));
      } else {
        driverSnaps.push(null);
        constructorSnaps.push(null);
      }
    } else {
      driverSnaps.push(null);
      constructorSnaps.push(null);
    }
  }

  // Sort by final cumulative points (descending)
  const driverIds = [...driverNames.keys()].sort(
    (a, b) => (driverCum.get(b) ?? 0) - (driverCum.get(a) ?? 0),
  );
  const constructorIds = [...constructorNames.keys()].sort(
    (a, b) => (constructorCum.get(b) ?? 0) - (constructorCum.get(a) ?? 0),
  );

  // Assign constructor colors so teammates share the same color
  const constructorColorIndex = new Map<string, number>();
  constructorIds.forEach((id, idx) => constructorColorIndex.set(id, idx));

  function computePos(snap: Map<string, number> | null, id: string): number | null {
    if (snap === null || !snap.has(id)) return null;
    const pts = snap.get(id)!;
    return (
      1 +
      [...snap.entries()].filter(([otherId, otherPts]) => otherId !== id && otherPts > pts).length
    );
  }

  const drivers: EntitySeries[] = driverIds.map((id) => {
    const constructorId = driverConstructor.get(id) ?? "";
    const fallbackIdx = constructorColorIndex.get(constructorId) ?? 0;
    return {
      id,
      name: driverNames.get(id)!,
      color: teamColor(constructorId, fallbackIdx),
      cumulativePoints: driverSnaps.map((snap) => snap?.get(id) ?? null),
      currentPos: driverSnaps.map((snap) => computePos(snap, id)),
    };
  });

  const constructors: EntitySeries[] = constructorIds.map((id, idx) => ({
    id,
    name: constructorNames.get(id)!,
    color: teamColor(id, idx),
    cumulativePoints: constructorSnaps.map((snap) => snap?.get(id) ?? null),
    currentPos: constructorSnaps.map((snap) => computePos(snap, id)),
  }));

  return { year, races, lastCompletedRaceNum, drivers, constructors };
}

export function computeProjectionsForSelectedRace(
  data: SeasonChartData,
  afterRaceNum: number,
  isDriver: boolean,
): Record<string, Record<string, ProjectionEntry>> {
  const { races } = data;
  const entities = isDriver ? data.drivers : data.constructors;
  const projectionsForRaceNum: Record<string, Record<string, ProjectionEntry>> = {};

  const basePts = new Map<string, number>();
  for (const e of entities) {
    basePts.set(e.id, e.cumulativePoints[afterRaceNum - 1] ?? 0);
  }

  let cumulativeMax = 0;
  for (let futureRaceNum = afterRaceNum + 1; futureRaceNum <= races.length; futureRaceNum++) {
    const race = races[futureRaceNum - 1];
    cumulativeMax += isDriver ? race.maxDriverPoints : race.maxConstructorPoints;

    const ranges = entities.map((e) => ({
      id: e.id,
      minPts: basePts.get(e.id)!,
      maxPts: basePts.get(e.id)! + cumulativeMax,
    }));

    const raceData: Record<string, ProjectionEntry> = {};
    for (const e of ranges) {
      const bestPos = 1 + ranges.filter((o) => o.id !== e.id && o.minPts > e.maxPts).length;
      let worstPos = 1 + ranges.filter((o) => o.id !== e.id && o.maxPts > e.minPts).length;

      if (isDriver && futureRaceNum === afterRaceNum + 1) {
        const eventPoints = driverPointsByPositionForRace(data.year, race);
        const maxOvertakes = maxOvertakesSingleDriverRace(basePts, e.id, e.minPts, eventPoints);
        worstPos = 1 + maxOvertakes;
      }

      const worstPosValue: number | null =
        worstPos === ranges.length && worstPos !== bestPos ? null : worstPos;

      raceData[e.id] = { minPts: e.minPts, maxPts: e.maxPts, bestPos, worstPos: worstPosValue };
    }

    projectionsForRaceNum[futureRaceNum] = raceData;
  }

  return projectionsForRaceNum;
}
