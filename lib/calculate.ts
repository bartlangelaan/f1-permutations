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
  /**
   * cumulativeWins[i] = number of race wins (P1 in a main race, not sprint) after race i+1.
   * Only tracked for drivers; null if race not yet run. Used for tiebreaker calculations.
   */
  cumulativeWins?: (number | null)[];
  /**
   * cumulativeFinishCounts[i][p] = number of main-race finishes at position p+1 after race i+1.
   * Only tracked for drivers; null if race not yet run. Used for tiebreaker calculations.
   */
  cumulativeFinishCounts?: ((number[] | null) | null)[];
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
       * When present, lists every race-finishing-position combination that guarantees
       * `position`. Each entry's `raceFinishPos` is the threshold: finishing at that
       * position *or better* guarantees `position` given the stated rival constraints.
       * An empty `rivalConstraints` array means the entity wins regardless of where rivals finish.
       * Entries with identical rivalConstraints are deduplicated — only the highest
       * (worst) raceFinishPos is kept, so the threshold represents the full range.
       */
      racePositionCombinations?: Array<{
        raceFinishPos: number;
        rivalConstraints: Array<{ opponentId: string; maxRaceFinishPos: number }>;
      }>;
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
  // Last place (position = total entities) needs zero rivals below — trivially guaranteed,
  // not a useful insight.
  if (requiredBelowCount <= 0) return null;
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
 * For each finishing position the entity can take in the next race, compute which rival
 * finishing positions are required for the entity to guarantee `targetPosition` in the
 * final championship standings.
 *
 * A rival constraint "opponent must finish P{j} or worse" is emitted only when P{j} is
 * the BEST position the opponent can take while the entity is still guaranteed above them.
 * If the entity is guaranteed above the opponent regardless (opponent's max points can't
 * overcome the entity's lead + race score), no constraint for that opponent is emitted.
 *
 * The entity's own finishing position is excluded from the search for rivals' worst
 * valid position (two drivers cannot occupy the same race position).
 *
 * Only positions where ALL opponents can simultaneously satisfy their constraints are
 * returned (i.e. the combination is feasible for the entity to guarantee `targetPosition`).
 */
function computePositionCombinations(
  entityId: string,
  targetPosition: number,
  entityIds: string[],
  basePts: Map<string, number>,
  racePoints: number[],
  pointsRemainingAfterNext: number,
  baseFinishCounts: Map<string, number[]> = new Map(),
): Array<{
  raceFinishPos: number;
  rivalConstraints: { opponentId: string; maxRaceFinishPos: number }[];
}> {
  const opponents = entityIds.filter((id) => id !== entityId);

  // For targetPosition N the entity must be guaranteed above all opponents EXCEPT the
  // top N-1 (by base points). Those top N-1 may legitimately finish ahead of the entity
  // — we only constrain the rest.
  const sortedOpponents = [...opponents].sort(
    (a, b) => (basePts.get(b) ?? 0) - (basePts.get(a) ?? 0),
  );
  const mustBeBelowOpponents = sortedOpponents.slice(targetPosition - 1);
  // Last place needs zero rivals below — trivially guaranteed, not a useful insight.
  if (mustBeBelowOpponents.length === 0) return [];

  const raw: Array<{
    raceFinishPos: number;
    rivalConstraints: { opponentId: string; maxRaceFinishPos: number }[];
  }> = [];

  for (let i = 0; i < racePoints.length; i++) {
    const entityFinishPos = i + 1;
    const entityRacePoints = racePoints[i] ?? 0;
    const entityFinalPts = (basePts.get(entityId) ?? 0) + entityRacePoints;

    const rivalConstraints: { opponentId: string; maxRaceFinishPos: number }[] = [];
    let feasible = true;

    // Finish counts for entity after this race (used for tiebreaker comparison below).
    const entityBaseCounts = baseFinishCounts.get(entityId) ?? [];
    const entityFinalCounts = [...entityBaseCounts];
    if (entityFinishPos >= 1) {
      entityFinalCounts[entityFinishPos - 1] = (entityFinalCounts[entityFinishPos - 1] ?? 0) + 1;
    }

    for (const opponentId of mustBeBelowOpponents) {
      const opponentBasePts = basePts.get(opponentId) ?? 0;

      // Determine whether entity wins the tiebreaker against this opponent if they tie on points.
      // Only reliable when pointsRemainingAfterNext === 0 (no future races can shift counts).
      // The "tying race pts" is what the opponent would need to score to exactly match entity.
      // Find the finish position that scores exactly those points (if any) to know their tiebreaker.
      let tiebreakAdj = 1; // default: strict inequality required
      if (pointsRemainingAfterNext === 0) {
        const tieOppRacePoints = entityFinalPts - opponentBasePts;
        const tieOppFinishPos = racePoints.indexOf(tieOppRacePoints) + 1; // 0 if not found
        if (tieOppFinishPos > 0) {
          // A genuine tie is possible — compare finish-count arrays to determine tiebreaker winner.
          const oppBaseCounts = baseFinishCounts.get(opponentId) ?? [];
          const oppFinalCounts = [...oppBaseCounts];
          oppFinalCounts[tieOppFinishPos - 1] = (oppFinalCounts[tieOppFinishPos - 1] ?? 0) + 1;
          const maxLen = Math.max(entityFinalCounts.length, oppFinalCounts.length);
          for (let p = 0; p < maxLen; p++) {
            const eCount = entityFinalCounts[p] ?? 0;
            const oCount = oppFinalCounts[p] ?? 0;
            if (eCount !== oCount) {
              if (eCount > oCount) tiebreakAdj = 0; // entity wins tiebreaker
              break;
            }
          }
        }
        // If tieOppFinishPos === 0: no position scores those exact points → tie is impossible.
      }

      // Entity is guaranteed at or above opponent iff:
      //   entityFinalPts >= opponentBasePts + opponentRacePoints + pointsRemainingAfterNext
      //   (adjusted to strict when no tiebreaker advantage)
      // => opponentRacePoints ≤ maxOppRacePoints  (integer arithmetic)
      const maxOppRacePoints =
        entityFinalPts - opponentBasePts - pointsRemainingAfterNext - tiebreakAdj;

      if (maxOppRacePoints < 0) {
        // Even if the opponent scores 0 in the race, they still can't be beaten — infeasible.
        feasible = false;
        break;
      }

      if ((racePoints[0] ?? 0) <= maxOppRacePoints) {
        // Opponent can finish anywhere (even P1) and entity is still guaranteed above them.
        // No constraint needed for this opponent.
        continue;
      }

      // Find the smallest (best) race position j (≠ entityFinishPos) where the opponent's
      // points satisfy the constraint.  That position is the "worst they can be at" bound:
      // the opponent must finish at P{j} or worse.
      let smallestValidPos: number | null = null;
      for (let j = 1; j <= racePoints.length; j++) {
        if (j === entityFinishPos) continue; // position is taken by the entity
        if ((racePoints[j - 1] ?? 0) <= maxOppRacePoints) {
          smallestValidPos = j;
          break;
        }
      }

      if (smallestValidPos === null) {
        // No valid position for this opponent — combination is infeasible.
        feasible = false;
        break;
      }

      // When the entity finishes P1, every opponent is naturally excluded from P1.
      // A constraint of "P2 or worse" is therefore trivially satisfied and need not be listed.
      if (entityFinishPos === 1 && smallestValidPos === 2) continue;

      rivalConstraints.push({ opponentId, maxRaceFinishPos: smallestValidPos });
    }

    if (feasible) {
      raw.push({ raceFinishPos: entityFinishPos, rivalConstraints });
    }
  }

  // Deduplicate: for rows with identical rivalConstraints (same opponents + same bounds),
  // keep only the one with the highest (worst) raceFinishPos — this is the threshold,
  // meaning the entity can finish at that position *or better* with those constraints.
  const seen = new Map<string, number>();
  const results: Array<{
    raceFinishPos: number;
    rivalConstraints: { opponentId: string; maxRaceFinishPos: number }[];
  }> = [];
  for (const entry of raw) {
    const key = JSON.stringify(
      entry.rivalConstraints.map((r) => `${r.opponentId}:${r.maxRaceFinishPos}`),
    );
    const existingIdx = seen.get(key);
    if (existingIdx === undefined) {
      seen.set(key, results.length);
      results.push(entry);
    } else {
      // Later entries have a higher (worse) raceFinishPos — update to extend the threshold.
      results[existingIdx] = entry;
    }
  }

  return results;
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
  const baseFinishCounts = new Map<string, number[]>();
  for (const entity of entities) {
    basePts.set(entity.id, entity.cumulativePoints[afterRaceNum - 1] ?? 0);
    if (entity.cumulativeFinishCounts) {
      const counts = entity.cumulativeFinishCounts[afterRaceNum - 1];
      if (counts) baseFinishCounts.set(entity.id, counts);
    }
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

        insights.push({
          type: "can_be_locked_in_next_race",
          entityId: entity.id,
          position,
          nextRaceNum,
          mustOutscoreBy: nextPlan.mustOutscoreBy,
          cannotBeOutscoredByMoreThan: nextPlan.cannotBeOutscoredByMoreThan,
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

  // Generate multi-driver position-combination permutations for every achievable position.
  // For each driver and each position they can still reach, enumerate all race finishing
  // positions and the rival finishing-position constraints required to guarantee that position.
  if (isDriver && nextRaceNum <= lastRaceNum) {
    const nextRace = data.races[nextRaceNum - 1];
    if (nextRace) {
      const racePoints = driverPointsByPositionForRace(data.year, nextRace);
      const pointsRemainingAfterNext = cumulativeMaxPoints(
        data.races,
        nextRaceNum,
        lastRaceNum,
        isDriver,
      );

      for (const entity of orderedEntities) {
        const endEntry = endProjections[entity.id];
        if (!endEntry) continue;
        if (endEntry.bestPos === endEntry.worstPos) continue; // already locked in

        for (
          let position = endEntry.bestPos;
          position <= (endEntry.worstPos ?? entities.length);
          position++
        ) {
          const combinations = computePositionCombinations(
            entity.id,
            position,
            entityIds,
            basePts,
            racePoints,
            pointsRemainingAfterNext,
            baseFinishCounts,
          );

          if (combinations.length > 0) {
            // Attach to the existing points-margin insight for this entity/position, if one
            // was already emitted, so both representations live on the same insight object.
            const existing = insights.find(
              (ins): ins is Extract<LockInsight, { type: "can_be_locked_in_next_race" }> =>
                ins.type === "can_be_locked_in_next_race" &&
                ins.entityId === entity.id &&
                ins.position === position,
            );
            if (existing) {
              existing.racePositionCombinations = combinations;
            } else {
              insights.push({
                type: "can_be_locked_in_next_race",
                entityId: entity.id,
                position,
                nextRaceNum,
                mustOutscoreBy: [],
                cannotBeOutscoredByMoreThan: [],
                racePositionCombinations: combinations,
              });
            }
          }
        }
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
  const driverWinSnaps: (Map<string, number> | null)[] = [];
  const driverFinishCountSnaps: (Map<string, number[]> | null)[] = [];
  const constructorSnaps: (Map<string, number> | null)[] = [];
  const driverCumWins = new Map<string, number>();
  const driverCumFinishes = new Map<string, number[]>();
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
        // Track finish counts per position in main races only (not sprints) for tiebreaker.
        if (race.type === "race") {
          for (let pos = 0; pos < results.length; pos++) {
            const driverId = results[pos]?.driverId;
            if (driverId) {
              const counts = driverCumFinishes.get(driverId) ?? [];
              counts[pos] = (counts[pos] ?? 0) + 1;
              driverCumFinishes.set(driverId, counts);
              if (pos === 0) {
                driverCumWins.set(driverId, (driverCumWins.get(driverId) ?? 0) + 1);
              }
            }
          }
        }
        driverSnaps.push(new Map(driverCum));
        driverWinSnaps.push(new Map(driverCumWins));
        driverFinishCountSnaps.push(new Map(driverCumFinishes.entries()));
        constructorSnaps.push(new Map(constructorCum));
      } else {
        driverSnaps.push(null);
        driverWinSnaps.push(null);
        driverFinishCountSnaps.push(null);
        constructorSnaps.push(null);
      }
    } else {
      driverSnaps.push(null);
      driverWinSnaps.push(null);
      driverFinishCountSnaps.push(null);
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
      cumulativeWins: driverWinSnaps.map((snap) => snap?.get(id) ?? null),
      cumulativeFinishCounts: driverFinishCountSnaps.map((snap) => snap?.get(id) ?? null),
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
