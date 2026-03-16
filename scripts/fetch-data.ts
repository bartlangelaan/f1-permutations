import { groupBy } from "es-toolkit";
import {
  getRaces,
  getEventResults,
  hasRaces,
  saveEventResults,
  saveRaces,
  type Race,
  type RaceResult,
} from "../lib/data";
import { fetchEventResults, fetchSeasonSchedule, type EventType } from "../lib/jolpica";

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

function groupSeasonEventResults(rawResults: RawSeasonEventResults): Map<number, RawEventResult[]> {
  const grouped = groupBy(rawResults, ({ round }) => round);

  const resultsByRound = new Map<number, RawEventResult[]>();
  for (const [round, results] of Object.entries(grouped)) {
    const roundNumber = Number(round);
    resultsByRound.set(
      roundNumber,
      results.map(({ result }) => result),
    );
  }

  return resultsByRound;
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

function isSeasonComplete(year: number, races: Race[]): boolean {
  return races.every((race) => {
    const results = getEventResults(year, race.raceNumber);
    return Array.isArray(results) && results.length > 0;
  });
}

async function saveSeasonEventResults(year: number, races: Race[], type: EventType): Promise<void> {
  const typedRaces = races.filter((race) => race.type === type);
  if (typedRaces.length === 0) {
    return;
  }

  const raceNumbersByRound = new Map(typedRaces.map((race) => [race.round, race.raceNumber]));
  const seasonResults = groupSeasonEventResults(await fetchEventResults(year, type));

  for (const [round, rawResults] of seasonResults) {
    const raceNumber = raceNumbersByRound.get(round);
    if (raceNumber === undefined) {
      continue;
    }

    await saveEventResults(year, raceNumber, mapEventResults(rawResults));
  }
}

async function main() {
  console.log(`Fetching F1 data from ${START_YEAR} to ${CURRENT_YEAR}...\n`);

  for (let year = START_YEAR; year <= CURRENT_YEAR; year++) {
    console.log(`\n=== ${year} ===`);
    const races = await fetchSeason(year);
    if (isSeasonComplete(year, races)) {
      console.log(`  [skip] ${year} season already complete`);
      continue;
    }

    for (const type of ["race", "sprint"] as const) {
      await saveSeasonEventResults(year, races, type);
    }
  }

  console.log("\nDone!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
type RawSeasonEventResults = Awaited<ReturnType<typeof fetchEventResults>>;
type RawEventResult = RawSeasonEventResults[number]["result"];
