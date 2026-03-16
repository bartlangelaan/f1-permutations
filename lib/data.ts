// This file is responsible only for reading and writing JSON files and listing
// directories. It must not contain domain logic — keep it as simple I/O.

import path from "path";
import fs from "fs-extra";
import type { CalculatedChartData, EntitySeries, LockInsight, ProjectionEntry } from "./calculate";

const DATA_DIR = path.join(process.cwd(), "data");

export interface Race {
  raceNumber: number;
  round: number;
  type: "race" | "sprint";
  raceName: string;
}

export interface RaceResult {
  points: number;
  driverId: string;
  driverName: string;
  constructorId: string;
  constructorName: string;
}

interface CalculationResultsAfterRace {
  driverProjections: Record<string, Record<string, ProjectionEntry>>;
  constructorProjections: Record<string, Record<string, ProjectionEntry>>;
  driverLockInsights: LockInsight[];
  constructorLockInsights: LockInsight[];
}

function seasonDir(year: number): string {
  return path.join(DATA_DIR, String(year));
}

function racesFile(year: number): string {
  return path.join(seasonDir(year), "races.json");
}

function eventResultsFile(year: number, raceNumber: number): string {
  return path.join(seasonDir(year), `results-${raceNumber}.json`);
}

function participantsFile(year: number): string {
  return path.join(seasonDir(year), "participants.json");
}

function calculationResultsAfterRaceFile(year: number, raceNum: number): string {
  return path.join(seasonDir(year), `calculation-results-${raceNum}.json`);
}

function readJsonFile<T>(file: string): T {
  return fs.readJsonSync(file) as T;
}

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
  const file = racesFile(year);
  if (!fs.existsSync(file)) return [];
  return readJsonFile<Race[]>(file);
}

export function hasRaces(year: number): boolean {
  return fs.existsSync(racesFile(year));
}

export async function saveRaces(year: number, races: Race[]): Promise<void> {
  await fs.outputJson(racesFile(year), races, { spaces: 2 });
}

/**
 * Returns the 1-based number of the last completed race based on which
 * calculation files exist, or 0 if none.
 */
export function getLastCompletedRaceNum(year: number): number {
  const dir = seasonDir(year);
  if (!fs.existsSync(dir)) return 0;
  const files = fs.readdirSync(dir);
  let max = 0;
  for (const f of files) {
    const m = f.match(/^calculation-results-(\d+)\.json$/);
    if (m) max = Math.max(max, parseInt(m[1]));
  }
  return max;
}

/**
 * Returns the results for a specific event raceNumber.
 */
export function getEventResults(year: number, raceNumber: number): RaceResult[] | null {
  const file = eventResultsFile(year, raceNumber);
  if (!fs.existsSync(file)) return null;
  return readJsonFile<RaceResult[]>(file);
}

export async function saveEventResults(
  year: number,
  raceNumber: number,
  results: RaceResult[],
): Promise<void> {
  await fs.outputJson(eventResultsFile(year, raceNumber), results, { spaces: 2 });
}

interface Participants {
  drivers: EntitySeries[];
  constructors: EntitySeries[];
}

export function readParticipants(year: number): Participants | null {
  const file = participantsFile(year);
  if (!fs.existsSync(file)) return null;
  return readJsonFile<Participants>(file);
}

export async function saveParticipants(
  year: number,
  drivers: EntitySeries[],
  constructors: EntitySeries[],
): Promise<void> {
  await fs.outputJson(participantsFile(year), { drivers, constructors }, { spaces: 2 });
}

export function readCalculationResultsAfterRace(
  year: number,
  raceNum: number,
): CalculationResultsAfterRace | null {
  const file = calculationResultsAfterRaceFile(year, raceNum);
  if (!fs.existsSync(file)) return null;
  return readJsonFile<CalculationResultsAfterRace>(file);
}

export async function saveCalculationResultsAfterRace(
  year: number,
  raceNum: number,
  data: CalculationResultsAfterRace,
): Promise<void> {
  await fs.outputJson(calculationResultsAfterRaceFile(year, raceNum), data, { spaces: 2 });
}

export async function removeCalculationResultsForSeason(year: number): Promise<void> {
  const yearDir = seasonDir(year);
  await fs.ensureDir(yearDir);

  const existingFiles = await fs.readdir(yearDir);
  await Promise.all(
    existingFiles
      .filter((name) => /^calculation-results-\d+\.json$/.test(name))
      .map((name) => fs.remove(path.join(yearDir, name))),
  );
}
