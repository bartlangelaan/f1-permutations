import fs from "fs";
import path from "path";
import type { CalculatedChartData } from "./calculate";

const DATA_DIR = path.join(process.cwd(), "data");
const FILENAME = "calculation-results.json";

export function readCalculationResults(year: number): CalculatedChartData | null {
  const file = path.join(DATA_DIR, String(year), FILENAME);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf-8")) as CalculatedChartData;
}

export function writeCalculationResults(year: number, data: CalculatedChartData): void {
  const file = path.join(DATA_DIR, String(year), FILENAME);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
