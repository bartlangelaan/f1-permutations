export interface Race {
  round: number;
  raceName: string;
  date: string;
  circuit: string;
  hasSprint: boolean;
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
