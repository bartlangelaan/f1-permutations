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
  driverProjections: Record<string, Record<string, ProjectionEntry>>;
  constructorProjections: Record<string, Record<string, ProjectionEntry>>;
  driverLockInsights: LockInsight[];
  constructorLockInsights: LockInsight[];
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
  const driverLockInsights: Record<string, LockInsight[]> = {};
  const constructorLockInsights: Record<string, LockInsight[]> = {};

  const loadedRaceFiles = new Set<number>();
  for (let selectedIdx = 0; selectedIdx <= baseData.lastCompletedSlotIndex; selectedIdx++) {
    const raceNumber = baseData.slots[selectedIdx].raceNumber;
    if (loadedRaceFiles.has(raceNumber)) continue;
    loadedRaceFiles.add(raceNumber);

    const perRaceData = readProjectionFile(year, raceNumber);
    if (!perRaceData) continue;

    driverProjections[selectedIdx] = perRaceData.driverProjections;
    constructorProjections[selectedIdx] = perRaceData.constructorProjections;
    driverLockInsights[selectedIdx] = perRaceData.driverLockInsights;
    constructorLockInsights[selectedIdx] = perRaceData.constructorLockInsights;
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
  data: {
    driverProjections: Record<string, Record<string, ProjectionEntry>>;
    constructorProjections: Record<string, Record<string, ProjectionEntry>>;
    driverLockInsights: LockInsight[];
    constructorLockInsights: LockInsight[];
  }
): void {
  const file = path.join(DATA_DIR, String(year), projectionFilename(raceNumber));
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
