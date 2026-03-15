import {
  getRaces,
  hasEventResults,
  hasRaces,
  saveEventResults,
  saveRaces,
  type Race,
  type RaceResult,
} from "../lib/data";
import {
  fetchEventResults,
  fetchSeasonSchedule,
  type EventType,
} from "../lib/jolpica";

const START_YEAR = 2010;
const CURRENT_YEAR = new Date().getFullYear();

function mapSeasonSchedule(rawRaces: Awaited<ReturnType<typeof fetchSeasonSchedule>>): Race[] {
  let raceNumber = 1;

  return rawRaces.flatMap((race) => {
    if (!race.round) {
      console.log(`  [drop] skipping ${race.raceName} because it has no active championship round`);
      return [];
    }

    const round = Number(race.round);

    const entries: Race[] = [];

    if (race.Sprint) {
      entries.push({
        raceNumber: raceNumber++,
        round,
        type: "sprint",
        raceName: race.raceName,
      });
    }

    entries.push({
      raceNumber: raceNumber++,
      round,
      type: "race",
      raceName: race.raceName,
    });

    return entries;
  });
}

function mapEventResults(rawResults: RawEventResult[]): RaceResult[] {
  return rawResults.map((result) => ({
      points: result.points,
      driverId: result.Driver.driverId,
      driverName: `${result.Driver.givenName} ${result.Driver.familyName}`,
      constructorId: result.Constructor.constructorId,
      constructorName: result.Constructor.name,
    }));
}

function mapSeasonEventResults(rawRaces: RawSeasonEventResults): Map<number, RaceResult[]> {
  const resultsByRound = new Map<number, RaceResult[]>();

  for (const race of rawRaces) {
    const round = Number(race.round);
    const existing = resultsByRound.get(round) ?? [];
    resultsByRound.set(round, [...existing, ...mapEventResults(race.results)]);
  }

  return resultsByRound;
}

function getMissingRounds(races: Race[], type: EventType, year: number): number[] {
  return races
    .filter((race) => race.type === type && !hasEventResults(year, race.raceNumber))
    .map((race) => race.round);
}

async function fetchSeason(year: number): Promise<Race[]> {
  if (hasRaces(year)) {
    console.log(`  [skip] ${year}/races.json already cached`);
    return getRaces(year);
  }

  const races = mapSeasonSchedule(await fetchSeasonSchedule(year));
  await saveRaces(year, races);
  return races;
}

async function fetchEventResultsForRace(
  year: number,
  raceNumber: number,
  round: number,
  type: EventType,
  seasonResults: Map<number, RaceResult[]>
) {
  if (hasEventResults(year, raceNumber)) {
    console.log(`  [skip] ${year}/results-${raceNumber}.json already cached`);
    return true;
  }

  const results = seasonResults.get(round) ?? [];
  if (results.length === 0) {
    console.log(`  [stop] no ${type} results available for ${year} round ${round}; stopping this season`);
    return false;
  }

  await saveEventResults(year, raceNumber, results);
  return true;
}

async function main() {
  console.log(`Fetching F1 data from ${START_YEAR} to ${CURRENT_YEAR}...\n`);

  for (let year = START_YEAR; year <= CURRENT_YEAR; year++) {
    console.log(`\n=== ${year} ===`);
    const races = await fetchSeason(year);
    const missingRaceRounds = getMissingRounds(races, "race", year);
    const missingSprintRounds = getMissingRounds(races, "sprint", year);
    const raceResultsByRound =
      missingRaceRounds.length > 0
        ? mapSeasonEventResults(await fetchEventResults(year, "race"))
        : new Map<number, RaceResult[]>();
    const sprintResultsByRound =
      missingSprintRounds.length > 0
        ? mapSeasonEventResults(await fetchEventResults(year, "sprint"))
        : new Map<number, RaceResult[]>();

    for (const race of races) {
      const seasonResults = race.type === "sprint" ? sprintResultsByRound : raceResultsByRound;
      const hasResults = await fetchEventResultsForRace(
        year,
        race.raceNumber,
        race.round,
        race.type,
        seasonResults
      );
      if (!hasResults) break;
    }
  }

  console.log("\nDone!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
type RawSeasonEventResults = Awaited<ReturnType<typeof fetchEventResults>>;
type RawEventResult = RawSeasonEventResults[number]["results"][number];
