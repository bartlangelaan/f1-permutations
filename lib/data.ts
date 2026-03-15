import fs from "fs-extra";
import path from "path";
import type { CalculatedChartData, EntitySeries, LockInsight, ProjectionEntry, TimelineSlot } from "./calculate";
import {
  maxRacePointsDriver,
  maxRacePointsConstructor,
  maxSprintPointsDriver,
  maxSprintPointsConstructor,
} from "./points";

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

interface CalculationResultsForSelectedSlot {
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

function driversFile(year: number): string {
  return path.join(seasonDir(year), "drivers.json");
}

function constructorsFile(year: number): string {
  return path.join(seasonDir(year), "constructors.json");
}

function calculationResultsForSelectedSlotFile(year: number, selectedSlotIndex: number): string {
  return path.join(seasonDir(year), `calculation-results-${selectedSlotIndex + 1}.json`);
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
 * Derives the ordered event slots for a year from races.json and results files.
 */
export function getSlots(year: number): TimelineSlot[] {
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

/**
 * Returns the index of the last completed slot based on which per-slot
 * calculation files exist, or -1 if none.
 */
export function getLastCompletedSlotIndex(year: number): number {
  const dir = seasonDir(year);
  if (!fs.existsSync(dir)) return -1;
  const files = fs.readdirSync(dir);
  let max = -1;
  for (const f of files) {
    const m = f.match(/^calculation-results-(\d+)\.json$/);
    if (m) max = Math.max(max, parseInt(m[1]) - 1);
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

export async function saveEventResults(year: number, raceNumber: number, results: RaceResult[]): Promise<void> {
  await fs.outputJson(eventResultsFile(year, raceNumber), results, { spaces: 2 });
}

export function readDrivers(year: number): EntitySeries[] | null {
  const file = driversFile(year);
  if (!fs.existsSync(file)) return null;
  return readJsonFile<EntitySeries[]>(file);
}

export async function saveDrivers(year: number, drivers: EntitySeries[]): Promise<void> {
  await fs.outputJson(driversFile(year), drivers, { spaces: 2 });
}

export function readConstructors(year: number): EntitySeries[] | null {
  const file = constructorsFile(year);
  if (!fs.existsSync(file)) return null;
  return readJsonFile<EntitySeries[]>(file);
}

export async function saveConstructors(year: number, constructors: EntitySeries[]): Promise<void> {
  await fs.outputJson(constructorsFile(year), constructors, { spaces: 2 });
}

export function readCalculationResultsForSelectedSlot(
  year: number,
  selectedSlotIndex: number
): CalculationResultsForSelectedSlot | null {
  const file = calculationResultsForSelectedSlotFile(year, selectedSlotIndex);
  if (!fs.existsSync(file)) return null;
  return readJsonFile<CalculationResultsForSelectedSlot>(file);
}

export async function saveCalculationResultsForSelectedSlot(
  year: number,
  selectedSlotIndex: number,
  data: CalculationResultsForSelectedSlot
): Promise<void> {
  await fs.outputJson(calculationResultsForSelectedSlotFile(year, selectedSlotIndex), data, { spaces: 2 });
}

export async function removeCalculationResultsForSeason(year: number): Promise<void> {
  const yearDir = seasonDir(year);
  await fs.ensureDir(yearDir);

  const existingFiles = await fs.readdir(yearDir);
  await Promise.all(
    existingFiles
      .filter((name) => /^calculation-results-\d+\.json$/.test(name))
      .map((name) => fs.remove(path.join(yearDir, name)))
  );
}
