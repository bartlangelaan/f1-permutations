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
      mustBeOutscoredBy: LockCondition[];
    }
  | {
      type: "can_be_locked_in_later";
      entityId: string;
      position: number;
      earliestSlotIndex: number;
    };

/** lockInsights[selectedIdx][entityId-position] */
export type LockInsightMap = Record<string, Record<string, LockInsight>>;

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

function findLockPlanForPosition(
  entityId: string,
  position: number,
  entityIds: string[],
  basePts: Map<string, number>,
  horizonMaxDelta: number,
  pointsRemainingAfterHorizon: number
): { mustOutscoreBy: LockCondition[]; mustBeOutscoredBy: LockCondition[] } | null {
  const opponents = entityIds.filter((id) => id !== entityId).map((opponentId) => {
    const currentGap = (basePts.get(entityId) ?? 0) - (basePts.get(opponentId) ?? 0);
    // Need entity-above-opponent by at least remaining points to make an overtake impossible.
    const requiredForEntityAbove = pointsRemainingAfterHorizon - currentGap;
    // Need opponent-above-entity by more than remaining points to make catch-up impossible.
    const requiredForOpponentAbove = -pointsRemainingAfterHorizon - 1 - currentGap;

    const canForceEntityAbove = requiredForEntityAbove < horizonMaxDelta;
    const canForceOpponentAbove = requiredForOpponentAbove > -horizonMaxDelta;

    return {
      opponentId,
      requiredForEntityAbove,
      requiredForOpponentAbove,
      canForceEntityAbove,
      canForceOpponentAbove,
    };
  });

  const mandatoryAbove = opponents.filter((o) => !o.canForceEntityAbove);
  const mandatoryBelow = opponents.filter((o) => !o.canForceOpponentAbove);
  const optional = opponents.filter((o) => o.canForceEntityAbove && o.canForceOpponentAbove);

  const targetAboveCount = position - 1;
  const minAboveCount = mandatoryAbove.length;
  const maxAboveCount = entityIds.length - 1 - mandatoryBelow.length;
  if (targetAboveCount < minAboveCount || targetAboveCount > maxAboveCount) {
    return null;
  }

  const optionalNeededAbove = targetAboveCount - mandatoryAbove.length;
  optional.sort((a, b) => a.requiredForOpponentAbove - b.requiredForOpponentAbove);
  const selectedOptionalAbove = new Set(optional.slice(0, optionalNeededAbove).map((o) => o.opponentId));

  const mustBeOutscoredBy = [...mandatoryAbove, ...optional.filter((o) => selectedOptionalAbove.has(o.opponentId))]
    .map((o) => ({
      opponentId: o.opponentId,
      points: Math.max(0, -o.requiredForOpponentAbove),
    }))
    .filter((c) => c.points > 0)
    .sort((a, b) => b.points - a.points);

  const mustOutscoreBy = [...mandatoryBelow, ...optional.filter((o) => !selectedOptionalAbove.has(o.opponentId))]
    .map((o) => ({
      opponentId: o.opponentId,
      points: Math.max(0, o.requiredForEntityAbove),
    }))
    .filter((c) => c.points > 0)
    .sort((a, b) => b.points - a.points);

  return { mustOutscoreBy, mustBeOutscoredBy };
}

export function computeLockInsightsForSelectedSlot(
  data: SeasonChartData,
  selectedIdx: number,
  isDriver: boolean
): Record<string, LockInsight> {
  const entities = isDriver ? data.drivers : data.constructors;
  const entityIds = entities.map((e) => e.id);
  const lastSlotIdx = data.slots.length - 1;
  const nextSlotIdx = selectedIdx + 1;
  const insights: Record<string, LockInsight> = {};

  const basePts = new Map<string, number>();
  for (const entity of entities) {
    basePts.set(entity.id, entity.cumulativePoints[selectedIdx] ?? 0);
  }

  const endProjections = computeProjectionsForSelectedSlot(data, selectedIdx, isDriver)[lastSlotIdx];
  if (!endProjections) return insights;

  for (const entity of entities) {
    const endEntry = endProjections[entity.id];
    if (!endEntry) continue;

    for (let position = endEntry.bestPos; position <= endEntry.worstPos; position++) {
      const key = `${entity.id}-${position}`;

      if (endEntry.bestPos === endEntry.worstPos) {
        insights[key] = { type: "already_locked_in", entityId: entity.id, position };
        continue;
      }

      if (nextSlotIdx <= lastSlotIdx) {
        const nextHorizonMax = cumulativeMaxPoints(data.slots, selectedIdx, nextSlotIdx, isDriver);
        const pointsRemainingAfterNext = cumulativeMaxPoints(data.slots, nextSlotIdx, lastSlotIdx, isDriver);
        const nextPlan = findLockPlanForPosition(
          entity.id,
          position,
          entityIds,
          basePts,
          nextHorizonMax,
          pointsRemainingAfterNext
        );

        if (nextPlan) {
          insights[key] = {
            type: "can_be_locked_in_next_race",
            entityId: entity.id,
            position,
            nextSlotIndex: nextSlotIdx,
            mustOutscoreBy: nextPlan.mustOutscoreBy,
            mustBeOutscoredBy: nextPlan.mustBeOutscoredBy,
          };
          continue;
        }
      }

      let earliestSlotIndex = -1;
      for (let slotIdx = selectedIdx + 2; slotIdx <= lastSlotIdx; slotIdx++) {
        const horizonMax = cumulativeMaxPoints(data.slots, selectedIdx, slotIdx, isDriver);
        const pointsRemaining = cumulativeMaxPoints(data.slots, slotIdx, lastSlotIdx, isDriver);
        const plan = findLockPlanForPosition(
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
        insights[key] = {
          type: "can_be_locked_in_later",
          entityId: entity.id,
          position,
          earliestSlotIndex,
        };
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
