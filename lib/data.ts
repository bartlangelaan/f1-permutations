import fs from "fs";
import path from "path";
import type { Race, RaceResult } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");

/**
 * Returns all years for which data has been cached.
 */
export function getSeasons(): number[] {
  if (!fs.existsSync(DATA_DIR)) return [];
  return fs
    .readdirSync(DATA_DIR)
    .filter((d) => /^\d{4}$/.test(d))
    .map(Number)
    .sort((a, b) => b - a); // descending
}

/**
 * Returns the race schedule for a given year.
 */
export function getRaces(year: number): Race[] {
  const file = path.join(DATA_DIR, String(year), "races.json");
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, "utf-8")) as Race[];
}

/**
 * Returns the results for a specific round (race only).
 * Returns null if the file doesn't exist (race not yet run).
 */
export function getRoundResults(year: number, round: number): RaceResult[] | null {
  const file = path.join(DATA_DIR, String(year), `results-${round}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf-8")) as RaceResult[];
}

/**
 * Returns sprint results for a specific round.
 * Returns null if the file doesn't exist (no sprint or not yet run).
 */
export function getSprintResults(year: number, round: number): RaceResult[] | null {
  const file = path.join(DATA_DIR, String(year), `sprint-${round}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf-8")) as RaceResult[];
}

/**
 * Returns results for all rounds from 1 up to and including the given round.
 * Each entry in the returned array is the combined race + sprint results for a round.
 * Skips rounds with no results file (e.g. future races).
 */
export function getResults(year: number, upToRound: number): RaceResult[][] {
  const results: RaceResult[][] = [];
  for (let round = 1; round <= upToRound; round++) {
    const race = getRoundResults(year, round);
    if (race === null) continue;
    const sprint = getSprintResults(year, round);
    // Combine race and sprint results — both contribute championship points
    results.push(sprint ? [...race, ...sprint] : race);
  }
  return results;
}

/**
 * Returns the last completed round for a given year.
 * Returns 0 if no results exist yet.
 */
export function getLastCompletedRound(year: number): number {
  const races = getRaces(year);
  let last = 0;
  for (const race of races) {
    const r = getRoundResults(year, race.round);
    if (r !== null && r.length > 0) last = race.round;
  }
  return last;
}
