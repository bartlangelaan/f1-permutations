// Fastest lap bonus point: introduced 2019, removed 2025
const FASTEST_LAP_POINT_YEAR = 2019;
const FASTEST_LAP_POINT_REMOVED_YEAR = 2025;

// Sprint races: introduced 2021, expanded points system 2023
const SPRINT_YEAR = 2021;
const SPRINT_EXPANDED_YEAR = 2022;

/** Whether a year awards a fastest lap bonus point in the main race. */
function hasFastestLapPoint(year: number): boolean {
  return year >= FASTEST_LAP_POINT_YEAR && year < FASTEST_LAP_POINT_REMOVED_YEAR;
}

/** Maximum points a driver can earn in a main race. */
export function maxRacePointsDriver(year: number): number {
  return hasFastestLapPoint(year) ? 26 : 25;
}

/** Maximum points a constructor can earn in a main race (top-2 drivers). */
export function maxRacePointsConstructor(year: number): number {
  return hasFastestLapPoint(year) ? 44 : 43;
}

/** Maximum points a driver can earn in a sprint race. */
export function maxSprintPointsDriver(year: number): number {
  if (year >= SPRINT_EXPANDED_YEAR) return 8;
  if (year >= SPRINT_YEAR) return 3;
  return 0;
}

/** Maximum points a constructor can earn in a sprint race (top-2 drivers). */
export function maxSprintPointsConstructor(year: number): number {
  if (year >= SPRINT_EXPANDED_YEAR) return 15;
  if (year >= SPRINT_YEAR) return 5;
  return 0;
}

/** Driver points awarded by finishing position in a race (descending). */
export function raceDriverMaxPointsByPosition(year: number): number[] {
  const base = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
  if (hasFastestLapPoint(year)) {
    return base.map((pts) => pts + 1);
  }
  return base;
}

/** Driver points awarded by finishing position in a sprint (descending). */
export function sprintDriverPointsByPosition(year: number): number[] {
  if (year >= SPRINT_EXPANDED_YEAR) return [8, 7, 6, 5, 4, 3, 2, 1];
  if (year >= SPRINT_YEAR) return [3, 2, 1];
  return [];
}
