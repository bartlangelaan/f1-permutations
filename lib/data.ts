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
 * Returns the results for a specific event raceNumber.
 */
export function getEventResults(year: number, raceNumber: number): RaceResult[] | null {
  const file = path.join(DATA_DIR, String(year), `results-${raceNumber}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf-8")) as RaceResult[];
}
