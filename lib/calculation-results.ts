import fs from "fs";
import path from "path";
import type {
  CalculatedChartData,
  LockInsight,
  ProjectionMap,
  ProjectionEntry,
} from "./calculate";

const DATA_DIR = path.join(process.cwd(), "data");
const BASE_FILENAME = "calculation-results.json";

type BaseCalculatedChartData = Omit<
  CalculatedChartData,
  "driverProjections" | "constructorProjections" | "driverLockInsights" | "constructorLockInsights"
>;

type RaceProjectionFile = {
  driverProjections: ProjectionMap;
  constructorProjections: ProjectionMap;
  driverLockInsights: Record<string, Record<string, LockInsight>>;
  constructorLockInsights: Record<string, Record<string, LockInsight>>;
};

function projectionFilename(raceNumber: number): string {
  return `calculation-results-${raceNumber}.json`;
}

function readProjectionFile(year: number, raceNumber: number): RaceProjectionFile | null {
  const file = path.join(DATA_DIR, String(year), projectionFilename(raceNumber));
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf-8")) as RaceProjectionFile;
}

export function readCalculationResults(year: number): CalculatedChartData | null {
  const file = path.join(DATA_DIR, String(year), BASE_FILENAME);
  if (!fs.existsSync(file)) return null;

  const baseData = JSON.parse(fs.readFileSync(file, "utf-8")) as BaseCalculatedChartData;

  const driverProjections: ProjectionMap = {};
  const constructorProjections: ProjectionMap = {};
  const driverLockInsights: Record<string, Record<string, LockInsight>> = {};
  const constructorLockInsights: Record<string, Record<string, LockInsight>> = {};

  const loadedRaceFiles = new Set<number>();
  for (let selectedIdx = 0; selectedIdx <= baseData.lastCompletedSlotIndex; selectedIdx++) {
    const raceNumber = baseData.slots[selectedIdx].raceNumber;
    if (loadedRaceFiles.has(raceNumber)) continue;
    loadedRaceFiles.add(raceNumber);

    const perRaceData = readProjectionFile(year, raceNumber);
    if (!perRaceData) continue;

    Object.assign(driverProjections, perRaceData.driverProjections);
    Object.assign(constructorProjections, perRaceData.constructorProjections);
    Object.assign(driverLockInsights, perRaceData.driverLockInsights);
    Object.assign(constructorLockInsights, perRaceData.constructorLockInsights);
  }

  return {
    ...baseData,
    driverProjections,
    constructorProjections,
    driverLockInsights,
    constructorLockInsights,
  };
}

export function writeCalculationResults(year: number, data: BaseCalculatedChartData): void {
  const yearDir = path.join(DATA_DIR, String(year));
  const file = path.join(yearDir, BASE_FILENAME);

  for (const existingFile of fs.readdirSync(yearDir)) {
    if (/^calculation-results-\d+\.json$/.test(existingFile)) {
      fs.unlinkSync(path.join(yearDir, existingFile));
    }
  }

  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

export function writeCalculationResultsForSelectedSlot(
  year: number,
  raceNumber: number,
  selectedIdx: number,
    data: {
    driverProjections: Record<string, Record<string, ProjectionEntry>>;
    constructorProjections: Record<string, Record<string, ProjectionEntry>>;
    driverLockInsights: Record<string, LockInsight>;
    constructorLockInsights: Record<string, LockInsight>;
  }
): void {
  const file = path.join(DATA_DIR, String(year), projectionFilename(raceNumber));

  const existing: RaceProjectionFile = fs.existsSync(file)
    ? (JSON.parse(fs.readFileSync(file, "utf-8")) as RaceProjectionFile)
    : { driverProjections: {}, constructorProjections: {}, driverLockInsights: {}, constructorLockInsights: {} };

  existing.driverProjections[selectedIdx] = data.driverProjections;
  existing.constructorProjections[selectedIdx] = data.constructorProjections;
  existing.driverLockInsights[selectedIdx] = data.driverLockInsights;
  existing.constructorLockInsights[selectedIdx] = data.constructorLockInsights;

  fs.writeFileSync(file, JSON.stringify(existing, null, 2));
}
