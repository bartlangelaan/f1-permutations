export interface Race {
  raceNumber: number;
  round: number;
  type: "race" | "sprint";
  raceName: string;
  date: string;
}

export interface RaceResult {
  position: number | null; // null if DNF/DNS
  positionText: string;
  points: number;
  driverId: string;
  driverCode: string;
  driverName: string;
  constructorId: string;
  constructorName: string;
  grid: number;
  laps: number;
  status: string;
  fastestLap: boolean;
}
