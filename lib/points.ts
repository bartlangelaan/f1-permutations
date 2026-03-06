// Fastest lap bonus point: introduced 2019, removed 2025
export const FASTEST_LAP_POINT_YEAR = 2019;
export const FASTEST_LAP_POINT_REMOVED_YEAR = 2025;

// Sprint races: introduced 2021, expanded points system 2023
export const SPRINT_YEAR = 2021;
export const SPRINT_EXPANDED_YEAR = 2023;

/** Whether a year awards a fastest lap bonus point in the main race. */
export function hasFastestLapPoint(year: number): boolean {
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

/** Maximum points a driver can earn across a full race weekend. */
export function maxWeekendPointsDriver(year: number, hasSprint: boolean): number {
  return maxRacePointsDriver(year) + (hasSprint ? maxSprintPointsDriver(year) : 0);
}

/** Maximum points a constructor can earn across a full race weekend. */
export function maxWeekendPointsConstructor(year: number, hasSprint: boolean): number {
  return maxRacePointsConstructor(year) + (hasSprint ? maxSprintPointsConstructor(year) : 0);
}
