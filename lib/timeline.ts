import { getRaces, getRoundResults, getSprintResults } from "./data";
import { maxRacePointsDriver, maxRacePointsConstructor, maxSprintPointsDriver, maxSprintPointsConstructor } from "./points";

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

export interface TimelineSlot {
  key: string;
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

export interface SeasonChartData {
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
export interface CalculatedChartData extends SeasonChartData {
  driverProjections: ProjectionMap;
  constructorProjections: ProjectionMap;
}

export function buildSeasonChartData(year: number): SeasonChartData {
  const races = getRaces(year);

  // Build ordered event slots (sprint before race for sprint weekends)
  const slots: TimelineSlot[] = [];
  for (const race of races) {
    const shortName = race.raceName.replace(" Grand Prix", " GP");
    if (race.hasSprint) {
      slots.push({
        key: `${race.round}-sprint`,
        round: race.round,
        type: "sprint",
        label: `S${race.round}`,
        fullLabel: `R${race.round} Sprint`,
        maxDriverPoints: maxSprintPointsDriver(year),
        maxConstructorPoints: maxSprintPointsConstructor(year),
        completed: false,
      });
    }
    slots.push({
      key: `${race.round}-race`,
      round: race.round,
      type: "race",
      label: `R${race.round}`,
      fullLabel: shortName,
      maxDriverPoints: maxRacePointsDriver(year),
      maxConstructorPoints: maxRacePointsConstructor(year),
      completed: false,
    });
  }

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
    const results =
      slot.type === "sprint"
        ? getSprintResults(year, slot.round)
        : getRoundResults(year, slot.round);

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

export function computeProjections(data: SeasonChartData, isDriver: boolean): ProjectionMap {
  const { slots, lastCompletedSlotIndex } = data;
  const entities = isDriver ? data.drivers : data.constructors;
  const projections: ProjectionMap = {};

  for (let selectedIdx = 0; selectedIdx <= lastCompletedSlotIndex; selectedIdx++) {
    projections[selectedIdx] = {};

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
        const worstPos = 1 + ranges.filter((o) => o.id !== e.id && o.maxPts > e.minPts).length;
        slotData[e.id] = { minPts: e.minPts, maxPts: e.maxPts, bestPos, worstPos };
      }

      projections[selectedIdx][j] = slotData;
    }
  }

  return projections;
}
