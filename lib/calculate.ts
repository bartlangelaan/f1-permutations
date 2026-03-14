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
  ferrari:        "#E8002D",
  red_bull:       "#3671C6",
  mercedes:       "#00D2BE",
  mclaren:        "#FF8000",
  aston_martin:   "#358C75",
  alpine:         "#FF87BC",
  williams:       "#64C4FF",
  haas:           "#B6BABD",
  rb:             "#6692FF",   // RB (2024+)
  sauber:         "#52E252",   // Kick Sauber (2024+)
  // Historical
  alphatauri:     "#5E8FAA",   // 2020-2023
  toro_rosso:     "#C72B2B",   // 2006-2019
  alfa:           "#C92D4B",   // Alfa Romeo 2019-2023
  racing_point:   "#F596C8",   // 2018-2020
  force_india:    "#F596C8",   // 2008-2018 (same pink)
  renault:        "#FFF500",   // 2010-2020
  lotus_f1:       "#FFD700",   // 2012-2015 (black+gold → use gold)
  lotus_racing:   "#FFD700",   // 2010-2011
  caterham:       "#006F3C",
  marussia:       "#8B0000",
  manor:          "#8B0000",
  hrt:            "#A0522D",
  virgin:         "#CC2200",
};

const FALLBACK_COLORS = [
  "#e8002d", "#3671c6", "#27f4d2", "#ff8000", "#358c75",
  "#b6babd", "#c92d4b", "#5e8faa", "#f0d800", "#64c4ff",
  "#f596c8", "#7cc8a4", "#d9a600", "#a374dc", "#6dd25a",
  "#ff6b6b", "#4ecdc4", "#a8d8ea", "#ffcc99", "#b8e0d2",
];

function teamColor(constructorId: string, fallbackIdx: number): string {
  return TEAM_COLORS[constructorId] ?? FALLBACK_COLORS[fallbackIdx % FALLBACK_COLORS.length];
}


function maxOvertakesSingleDriverSlot(basePts: Map<string, number>, targetId: string, targetMinPts: number, slotPoints: number[]): number {
  const threshold = targetMinPts + 1;
  const deficits: number[] = [];
  let alreadyAhead = 0;

  for (const [id, pts] of basePts.entries()) {
    if (id === targetId) continue;
    const need = threshold - pts;
    if (need <= 0) {
      alreadyAhead++;
    } else if (need <= slotPoints[0]) {
      deficits.push(need);
    }
  }

  deficits.sort((a, b) => a - b);
  const available = [...slotPoints].sort((a, b) => a - b);

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


function driverPointsByPositionForSlot(year: number, slot: TimelineSlot): number[] {
  if (slot.type === "sprint") {
    return sprintDriverPointsByPosition(year);
  }

  const baseRacePoints = raceDriverMaxPointsByPosition(year);
  const standardRaceMax = maxRacePointsDriver(year);
  if (slot.maxDriverPoints === standardRaceMax) {
    return baseRacePoints;
  }

  const multiplier = slot.maxDriverPoints / standardRaceMax;
  return baseRacePoints.map((pts) => pts * multiplier);
}

export interface TimelineSlot {
  key: string;
  raceNumber: number;
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
  /** cumulativePoints[i] = points after slot i; null if slot not yet run */
  cumulativePoints: (number | null)[];
}

interface SeasonChartData {
  year: number;
  slots: TimelineSlot[];
  /** Index of the last completed slot, -1 if none */
  lastCompletedSlotIndex: number;
  drivers: EntitySeries[];
  constructors: EntitySeries[];
}

export type ProjectionEntry = { minPts: number; maxPts: number; bestPos: number; worstPos: number };
/** projections[selectedIdx][futureSlotIdx][entityId] */
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
      nextSlotIndex: number;
      mustOutscoreBy: LockCondition[];
      cannotBeOutscoredByMoreThan: LockCondition[];
    }
  | {
      type: "can_be_locked_in_later";
      entityId: string;
      position: number;
      earliestSlotIndex: number;
    }
  | {
      type: "can_be_ruled_out_next_race";
      entityId: string;
      position: number;
      nextSlotIndex: number;
      mustBeOutscoredBy: LockCondition[];
      cannotOutscoreByMoreThan: LockCondition[];
    }
  | {
      type: "can_be_ruled_out_later";
      entityId: string;
      position: number;
      earliestSlotIndex: number;
    };

/** lockInsights[selectedIdx] */
export type LockInsightMap = Record<string, LockInsight[]>;

export interface CalculatedChartData extends SeasonChartData {
  driverProjections: ProjectionMap;
  constructorProjections: ProjectionMap;
  driverLockInsights: LockInsightMap;
  constructorLockInsights: LockInsightMap;
}

function slotMaxPoints(slot: TimelineSlot, isDriver: boolean): number {
  return isDriver ? slot.maxDriverPoints : slot.maxConstructorPoints;
}

function cumulativeMaxPoints(slots: TimelineSlot[], fromExclusive: number, toInclusive: number, isDriver: boolean): number {
  if (toInclusive <= fromExclusive) return 0;
  let total = 0;
  for (let i = fromExclusive + 1; i <= toInclusive; i++) {
    total += slotMaxPoints(slots[i], isDriver);
  }
  return total;
}

function findGuaranteePlanForPosition(
  entityId: string,
  position: number,
  entityIds: string[],
  basePts: Map<string, number>,
  horizonMaxDelta: number,
  pointsRemainingAfterHorizon: number
): {
  mustOutscoreBy: LockCondition[];
  cannotBeOutscoredByMoreThan: LockCondition[];
} | null {
  const opponents = entityIds.filter((id) => id !== entityId).map((opponentId) => {
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
  pointsRemainingAfterHorizon: number
): {
  mustBeOutscoredBy: LockCondition[];
  cannotOutscoreByMoreThan: LockCondition[];
} | null {
  const opponents = entityIds.filter((id) => id !== entityId).map((opponentId) => {
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

export function computeLockInsightsForSelectedSlot(
  data: SeasonChartData,
  selectedIdx: number,
  isDriver: boolean
): LockInsight[] {
  const entities = isDriver ? data.drivers : data.constructors;
  const entityIds = entities.map((e) => e.id);
  const lastSlotIdx = data.slots.length - 1;
  const nextSlotIdx = selectedIdx + 1;
  const insights: LockInsight[] = [];

  const basePts = new Map<string, number>();
  for (const entity of entities) {
    basePts.set(entity.id, entity.cumulativePoints[selectedIdx] ?? 0);
  }

  const endProjections = computeProjectionsForSelectedSlot(data, selectedIdx, isDriver)[lastSlotIdx];
  if (!endProjections) return insights;

  const orderedEntities = [...entities].sort((a, b) => {
    const pointDelta = (basePts.get(b.id) ?? 0) - (basePts.get(a.id) ?? 0);
    if (pointDelta !== 0) return pointDelta;
    return a.name.localeCompare(b.name);
  });
  const hasInsight = (
    entityId: string,
    position: number,
    type: LockInsight["type"]
  ): boolean => insights.some((insight) => insight.entityId === entityId && insight.position === position && insight.type === type);

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

    if (nextSlotIdx <= lastSlotIdx) {
      const nextHorizonMax = cumulativeMaxPoints(data.slots, selectedIdx, nextSlotIdx, isDriver);
      const pointsRemainingAfterNext = cumulativeMaxPoints(data.slots, nextSlotIdx, lastSlotIdx, isDriver);

      for (let position = endEntry.bestPos; position <= endEntry.worstPos; position++) {
        const nextPlan = findGuaranteePlanForPosition(
          entity.id,
          position,
          entityIds,
          basePts,
          nextHorizonMax,
          pointsRemainingAfterNext
        );

        if (!nextPlan) continue;
        if (!hasGuaranteeConditions(nextPlan)) continue;

        insights.push({
          type: "can_be_locked_in_next_race",
          entityId: entity.id,
          position,
          nextSlotIndex: nextSlotIdx,
          mustOutscoreBy: nextPlan.mustOutscoreBy,
          cannotBeOutscoredByMoreThan: nextPlan.cannotBeOutscoredByMoreThan,
        });
      }

      for (let position = endEntry.bestPos; position < endEntry.worstPos; position++) {
        const ruleOutPlan = findRuleOutPlanForPosition(
          entity.id,
          position,
          entityIds,
          basePts,
          nextHorizonMax,
          pointsRemainingAfterNext
        );

        if (!ruleOutPlan) continue;
        if (!hasRuleOutConditions(ruleOutPlan)) continue;

        insights.push({
          type: "can_be_ruled_out_next_race",
          entityId: entity.id,
          position,
          nextSlotIndex: nextSlotIdx,
          mustBeOutscoredBy: ruleOutPlan.mustBeOutscoredBy,
          cannotOutscoreByMoreThan: ruleOutPlan.cannotOutscoreByMoreThan,
        });
      }
    }

    for (let position = endEntry.bestPos; position <= endEntry.worstPos; position++) {
      if (hasInsight(entity.id, position, "can_be_locked_in_next_race")) continue;

      let earliestSlotIndex = -1;
      for (let slotIdx = selectedIdx + 2; slotIdx <= lastSlotIdx; slotIdx++) {
        const horizonMax = cumulativeMaxPoints(data.slots, selectedIdx, slotIdx, isDriver);
        const pointsRemaining = cumulativeMaxPoints(data.slots, slotIdx, lastSlotIdx, isDriver);
        const plan = findGuaranteePlanForPosition(
          entity.id,
          position,
          entityIds,
          basePts,
          horizonMax,
          pointsRemaining
        );
        if (plan) {
          const nextRoundStart = data.slots.findIndex(
            (slot, idx) => idx > slotIdx && slot.round > data.slots[slotIdx].round
          );
          earliestSlotIndex = nextRoundStart >= 0 ? nextRoundStart : slotIdx;
          break;
        }
      }

      if (earliestSlotIndex >= 0) {
        insights.push({
          type: "can_be_locked_in_later",
          entityId: entity.id,
          position,
          earliestSlotIndex,
        });
      }
    }

    for (let position = endEntry.bestPos; position < endEntry.worstPos; position++) {
      if (hasInsight(entity.id, position, "can_be_locked_in_next_race")) continue;
      if (hasInsight(entity.id, position, "can_be_locked_in_later")) continue;
      if (hasInsight(entity.id, position, "can_be_ruled_out_next_race")) continue;

      let earliestSlotIndex = -1;
      for (let slotIdx = selectedIdx + 2; slotIdx <= lastSlotIdx; slotIdx++) {
        const horizonMax = cumulativeMaxPoints(data.slots, selectedIdx, slotIdx, isDriver);
        const pointsRemaining = cumulativeMaxPoints(data.slots, slotIdx, lastSlotIdx, isDriver);
        const plan = findRuleOutPlanForPosition(
          entity.id,
          position,
          entityIds,
          basePts,
          horizonMax,
          pointsRemaining
        );
        if (!plan) continue;
        if (!hasRuleOutConditions(plan)) continue;

        const nextRoundStart = data.slots.findIndex(
          (slot, idx) => idx > slotIdx && slot.round > data.slots[slotIdx].round
        );
        earliestSlotIndex = nextRoundStart >= 0 ? nextRoundStart : slotIdx;
        break;
      }

      if (earliestSlotIndex >= 0) {
        insights.push({
          type: "can_be_ruled_out_later",
          entityId: entity.id,
          position,
          earliestSlotIndex,
        });
      }
    }
  }

  return insights;
}

export function buildSeasonChartData(year: number): SeasonChartData {
  const races = getRaces(year);

  // Build ordered event slots from normalized race data.
  const slots: TimelineSlot[] = races.map((race) => {
    const shortName = race.raceName.replace(" Grand Prix", " GP");
    return {
      key: `${race.raceNumber}-${race.type}`,
      raceNumber: race.raceNumber,
      round: race.round,
      type: race.type,
      label: `R${race.raceNumber}`,
      fullLabel: race.type === "sprint" ? `R${race.raceNumber} ${shortName} Sprint` : shortName,
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
      completed: false,
    };
  });

  // Accumulate cumulative points slot-by-slot
  const driverCum = new Map<string, number>();
  const constructorCum = new Map<string, number>();
  const driverNames = new Map<string, string>();
  const constructorNames = new Map<string, string>();
  // Track the most recent constructor for each driver (for color assignment)
  const driverConstructor = new Map<string, string>();

  const driverSnaps: (Map<string, number> | null)[] = [];
  const constructorSnaps: (Map<string, number> | null)[] = [];
  let lastCompletedSlotIndex = -1;

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const results = getEventResults(year, slot.raceNumber);

    if (results !== null && results.length > 0) {
      slot.completed = true;
      lastCompletedSlotIndex = i;
      for (const r of results) {
        driverCum.set(r.driverId, (driverCum.get(r.driverId) ?? 0) + r.points);
        constructorCum.set(r.constructorId, (constructorCum.get(r.constructorId) ?? 0) + r.points);
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
  }

  // Sort by final cumulative points (descending)
  const driverIds = [...driverNames.keys()].sort(
    (a, b) => (driverCum.get(b) ?? 0) - (driverCum.get(a) ?? 0)
  );
  const constructorIds = [...constructorNames.keys()].sort(
    (a, b) => (constructorCum.get(b) ?? 0) - (constructorCum.get(a) ?? 0)
  );

  // Assign constructor colors so teammates share the same color
  const constructorColorIndex = new Map<string, number>();
  constructorIds.forEach((id, idx) => constructorColorIndex.set(id, idx));

  const drivers: EntitySeries[] = driverIds.map((id) => {
    const constructorId = driverConstructor.get(id) ?? "";
    const fallbackIdx = constructorColorIndex.get(constructorId) ?? 0;
    return {
      id,
      name: driverNames.get(id)!,
      color: teamColor(constructorId, fallbackIdx),
      cumulativePoints: driverSnaps.map((snap) => snap?.get(id) ?? null),
    };
  });

  const constructors: EntitySeries[] = constructorIds.map((id, idx) => ({
    id,
    name: constructorNames.get(id)!,
    color: teamColor(id, idx),
    cumulativePoints: constructorSnaps.map((snap) => snap?.get(id) ?? null),
  }));

  return { year, slots, lastCompletedSlotIndex, drivers, constructors };
}

function computeProjections(data: SeasonChartData, isDriver: boolean): ProjectionMap {
  const { slots, lastCompletedSlotIndex } = data;
  const entities = isDriver ? data.drivers : data.constructors;
  const projections: ProjectionMap = {};

  for (let selectedIdx = 0; selectedIdx <= lastCompletedSlotIndex; selectedIdx++) {
    projections[selectedIdx] = computeProjectionsForSelectedSlot(data, selectedIdx, isDriver);
  }

  return projections;
}

export function computeProjectionsForSelectedSlot(
  data: SeasonChartData,
  selectedIdx: number,
  isDriver: boolean
): Record<string, Record<string, ProjectionEntry>> {
  const { slots } = data;
  const entities = isDriver ? data.drivers : data.constructors;
  const projectionsForSelectedIdx: Record<string, Record<string, ProjectionEntry>> = {};

  const basePts = new Map<string, number>();
  for (const e of entities) {
    basePts.set(e.id, e.cumulativePoints[selectedIdx] ?? 0);
  }

  let cumulativeMax = 0;
  for (let j = selectedIdx + 1; j < slots.length; j++) {
    const slot = slots[j];
    cumulativeMax += isDriver ? slot.maxDriverPoints : slot.maxConstructorPoints;

    const ranges = entities.map((e) => ({
      id: e.id,
      minPts: basePts.get(e.id)!,
      maxPts: basePts.get(e.id)! + cumulativeMax,
    }));

    const slotData: Record<string, ProjectionEntry> = {};
    for (const e of ranges) {
      const bestPos = 1 + ranges.filter((o) => o.id !== e.id && o.minPts > e.maxPts).length;
      let worstPos = 1 + ranges.filter((o) => o.id !== e.id && o.maxPts > e.minPts).length;

      if (isDriver && j === selectedIdx + 1) {
        const slotPoints = driverPointsByPositionForSlot(data.year, slot);
        const maxOvertakes = maxOvertakesSingleDriverSlot(basePts, e.id, e.minPts, slotPoints);
        worstPos = 1 + maxOvertakes;
      }

      slotData[e.id] = { minPts: e.minPts, maxPts: e.maxPts, bestPos, worstPos };
    }

    projectionsForSelectedIdx[j] = slotData;
  }

  return projectionsForSelectedIdx;
}
