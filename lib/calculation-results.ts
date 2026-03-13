import fs from "fs";
import path from "path";
import type { CalculatedChartData, ProjectionMap, ProjectionEntry } from "./calculate";

const DATA_DIR = path.join(process.cwd(), "data");
const BASE_FILENAME = "calculation-results.json";

type BaseCalculatedChartData = Omit<CalculatedChartData, "driverProjections" | "constructorProjections">;

type RaceProjectionFile = {
  driverProjections: ProjectionMap;
  constructorProjections: ProjectionMap;
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

  const loadedRaceFiles = new Set<number>();
  for (let selectedIdx = 0; selectedIdx <= baseData.lastCompletedSlotIndex; selectedIdx++) {
    const raceNumber = baseData.slots[selectedIdx].raceNumber;
    if (loadedRaceFiles.has(raceNumber)) continue;
    loadedRaceFiles.add(raceNumber);

    const perRaceData = readProjectionFile(year, raceNumber);
    if (!perRaceData) continue;

    Object.assign(driverProjections, perRaceData.driverProjections);
    Object.assign(constructorProjections, perRaceData.constructorProjections);
  }

  return { ...baseData, driverProjections, constructorProjections };
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
  }
): void {
  const file = path.join(DATA_DIR, String(year), projectionFilename(raceNumber));

  const existing: RaceProjectionFile = fs.existsSync(file)
    ? (JSON.parse(fs.readFileSync(file, "utf-8")) as RaceProjectionFile)
    : { driverProjections: {}, constructorProjections: {} };

  existing.driverProjections[selectedIdx] = data.driverProjections;
  existing.constructorProjections[selectedIdx] = data.constructorProjections;

  fs.writeFileSync(file, JSON.stringify(existing, null, 2));
}
