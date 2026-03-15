import fs from "fs-extra";
import path from "path";
import type {
  CalculatedChartData,
  LockInsight,
  ProjectionEntry,
  ProjectionMap,
} from "./calculate";

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

type BaseCalculatedChartData = Omit<
  CalculatedChartData,
  "driverProjections" | "constructorProjections" | "driverLockInsights" | "constructorLockInsights"
>;

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

function calculationResultsFile(year: number): string {
  return path.join(seasonDir(year), "calculation-results.json");
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

export function readCalculationResults(year: number): CalculatedChartData | null {
  const file = calculationResultsFile(year);
  if (!fs.existsSync(file)) return null;

  const baseData = readJsonFile<BaseCalculatedChartData>(file);
  const driverProjections: ProjectionMap = {};
  const constructorProjections: ProjectionMap = {};
  const driverLockInsights: Record<string, LockInsight[]> = {};
  const constructorLockInsights: Record<string, LockInsight[]> = {};

  for (let selectedIdx = 0; selectedIdx <= baseData.lastCompletedSlotIndex; selectedIdx++) {
    const perSlotFile = calculationResultsForSelectedSlotFile(year, selectedIdx);
    if (!fs.existsSync(perSlotFile)) continue;

    const perSlotData = readJsonFile<CalculationResultsForSelectedSlot>(perSlotFile);
    driverProjections[selectedIdx] = perSlotData.driverProjections;
    constructorProjections[selectedIdx] = perSlotData.constructorProjections;
    driverLockInsights[selectedIdx] = perSlotData.driverLockInsights;
    constructorLockInsights[selectedIdx] = perSlotData.constructorLockInsights;
  }

  return {
    ...baseData,
    driverProjections,
    constructorProjections,
    driverLockInsights,
    constructorLockInsights,
  };
}

export async function saveCalculationResults(year: number, data: BaseCalculatedChartData): Promise<void> {
  const yearDir = seasonDir(year);
  await fs.ensureDir(yearDir);

  const existingFiles = await fs.readdir(yearDir);
  await Promise.all(
    existingFiles
      .filter((name) => /^calculation-results-\d+\.json$/.test(name))
      .map((name) => fs.remove(path.join(yearDir, name)))
  );

  await fs.outputJson(calculationResultsFile(year), data, { spaces: 2 });
}

export async function saveCalculationResultsForSelectedSlot(
  year: number,
  selectedSlotIndex: number,
  data: CalculationResultsForSelectedSlot
): Promise<void> {
  await fs.outputJson(calculationResultsForSelectedSlotFile(year, selectedSlotIndex), data, { spaces: 2 });
}
