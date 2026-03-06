import type { RaceResult, StandingsEntry, PermutationEntry, PermutationResult, Race } from "./types";
import { maxWeekendPointsDriver, maxWeekendPointsConstructor } from "./points";

/**
 * Compute driver standings from an array of race results (multiple rounds).
 */
function computeDriverStandings(allResults: RaceResult[][]): StandingsEntry[] {
  const totals = new Map<string, { name: string; points: number; wins: number }>();

  for (const raceResults of allResults) {
    for (const r of raceResults) {
      const entry = totals.get(r.driverId) ?? { name: r.driverName, points: 0, wins: 0 };
      entry.points += r.points;
      if (r.positionText === "1") entry.wins += 1;
      totals.set(r.driverId, entry);
    }
  }

  const sorted = Array.from(totals.entries())
    .map(([id, e]) => ({ id, ...e }))
    .sort((a, b) => b.points - a.points || b.wins - a.wins);

  return sorted.map((e, i) => ({ ...e, position: i + 1 }));
}

/**
 * Compute constructor standings from an array of race results.
 */
function computeConstructorStandings(allResults: RaceResult[][]): StandingsEntry[] {
  const totals = new Map<string, { name: string; points: number; wins: number }>();

  for (const raceResults of allResults) {
    // Track wins per constructor per race (win if at least one driver wins)
    const constructorWins = new Set<string>();
    for (const r of raceResults) {
      if (r.positionText === "1") constructorWins.add(r.constructorId);
    }

    for (const r of raceResults) {
      const entry = totals.get(r.constructorId) ?? { name: r.constructorName, points: 0, wins: 0 };
      entry.points += r.points;
      totals.set(r.constructorId, entry);
    }

    for (const constructorId of constructorWins) {
      const entry = totals.get(constructorId);
      if (entry) entry.wins += 1;
    }
  }

  const sorted = Array.from(totals.entries())
    .map(([id, e]) => ({ id, ...e }))
    .sort((a, b) => b.points - a.points || b.wins - a.wins);

  return sorted.map((e, i) => ({ ...e, position: i + 1 }));
}

/**
 * Calculate permutation entries for either drivers or constructors.
 * remainingMaxPoints: sum of max points available across all remaining rounds.
 */
function calcPermutations(
  standings: StandingsEntry[],
  remainingMaxPoints: number
): PermutationEntry[] {
  if (standings.length === 0) return [];

  const leader = standings[0];
  const totalRemaining = remainingMaxPoints;

  return standings.map((entry) => {
    const maxPossiblePoints = entry.points + totalRemaining;
    const pointsGap = entry.points - leader.points;
    // A leader is clinched if no one else can reach their points
    const clinched =
      totalRemaining === 0
        ? entry.id === leader.id
        : standings.every(
            (other) =>
              other.id === entry.id ||
              other.points + totalRemaining < entry.points
          );

    const canWin = maxPossiblePoints >= leader.points;
    const eliminated = !canWin;

    let minPointsNeeded: number | null = null;
    let maxLeaderCanScore: number | null = null;

    if (canWin && entry.id !== leader.id) {
      // Minimum points this entry needs to match/exceed the leader
      // In the best case for them: leader scores 0 remaining
      // In the worst case for the leader: they score 0
      // Minimum needed = leader.points - entry.points + 1 (to overtake, or 0 to match on wins)
      const deficit = leader.points - entry.points;
      minPointsNeeded = Math.max(0, deficit + 1);

      // If they score max remaining, what's the max the leader can score?
      const myMaxTotal = entry.points + totalRemaining;
      maxLeaderCanScore = myMaxTotal - leader.points; // leader can score at most this many more
    } else if (canWin && entry.id === leader.id) {
      minPointsNeeded = 0;
      maxLeaderCanScore = null;
    }

    return {
      id: entry.id,
      name: entry.name,
      currentPoints: entry.points,
      wins: entry.wins,
      position: entry.position,
      canWin,
      alreadyClinched: clinched,
      eliminated,
      pointsGap,
      maxPossiblePoints,
      minPointsNeeded,
      maxLeaderCanScore,
    };
  });
}

/**
 * Main entry point: calculate permutations for a given year after a specific round.
 */
export function calculatePermutations(
  year: number,
  round: number,
  races: Race[],
  allResults: RaceResult[][]
): PermutationResult {
  const totalRounds = races.length;
  const remainingRounds = totalRounds - round;

  const race = races.find((r) => r.round === round);
  const raceName = race?.raceName ?? `Round ${round}`;

  // Sum max possible points across all remaining rounds (accounting for sprints)
  const remainingRaces = races.filter((r) => r.round > round);
  const remainingDriverMax = remainingRaces.reduce(
    (sum, r) => sum + maxWeekendPointsDriver(year, r.hasSprint),
    0
  );
  const remainingConstructorMax = remainingRaces.reduce(
    (sum, r) => sum + maxWeekendPointsConstructor(year, r.hasSprint),
    0
  );

  const driverStandings = computeDriverStandings(allResults);
  const constructorStandings = computeConstructorStandings(allResults);

  const drivers = calcPermutations(driverStandings, remainingDriverMax);
  const constructors = calcPermutations(constructorStandings, remainingConstructorMax);

  return {
    year,
    round,
    raceName,
    totalRounds,
    remainingRounds,
    drivers,
    constructors,
  };
}
