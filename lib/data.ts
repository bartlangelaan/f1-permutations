// This file is responsible only for reading and writing JSON files and listing
// directories. It must not contain domain logic — keep it as simple I/O.

import fs from "fs-extra";
import path from "path";
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

function participantsFile(year: number): string {
  return path.join(seasonDir(year), "participants.json");
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

export function listSeasonFiles(year: number): string[] {
  const dir = seasonDir(year);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir);
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

interface Participants {
  drivers: EntitySeries[];
  constructors: EntitySeries[];
}

export function readParticipants(year: number): Participants | null {
  const file = participantsFile(year);
  if (!fs.existsSync(file)) return null;
  return readJsonFile<Participants>(file);
}

export async function saveParticipants(year: number, drivers: EntitySeries[], constructors: EntitySeries[]): Promise<void> {
  await fs.outputJson(participantsFile(year), { drivers, constructors }, { spaces: 2 });
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

export async function removeSeasonFile(year: number, name: string): Promise<void> {
  await fs.remove(path.join(seasonDir(year), name));
}

export async function ensureSeasonDir(year: number): Promise<void> {
  await fs.ensureDir(seasonDir(year));
}
