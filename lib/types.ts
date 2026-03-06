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

export interface StandingsEntry {
  id: string; // driverId or constructorId
  name: string;
  points: number;
  wins: number;
  position: number;
}

export interface PermutationEntry {
  id: string;
  name: string;
  currentPoints: number;
  wins: number;
  position: number;
  canWin: boolean;
  alreadyClinched: boolean;
  eliminated: boolean;
  // Points gap to leader (negative = behind leader)
  pointsGap: number;
  // Max points still achievable
  maxPossiblePoints: number;
  // Points they need from remaining races (if canWin)
  minPointsNeeded: number | null;
  // Max points the leader can score for this entity to win (if canWin and not leader)
  maxLeaderCanScore: number | null;
}

export interface PermutationResult {
  year: number;
  round: number;
  raceName: string;
  totalRounds: number;
  remainingRounds: number;
  drivers: PermutationEntry[];
  constructors: PermutationEntry[];
}
