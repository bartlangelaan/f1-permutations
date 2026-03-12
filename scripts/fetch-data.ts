import fs from "fs";
import path from "path";
import ky from "ky";

const BASE_URL = "https://api.jolpi.ca/ergast/f1";
const DATA_DIR = path.join(process.cwd(), "data");
const START_YEAR = 2010;
const CURRENT_YEAR = new Date().getFullYear();
const DELAY_MS = 300;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const client = ky.create({
  prefixUrl: BASE_URL,
  retry: {
    limit: 5,
    methods: ["get"],
    statusCodes: [429, 500, 502, 503, 504],
    backoffLimit: 30_000,
  },
  hooks: {
    beforeRetry: [
      ({ retryCount }) => {
        console.log(`  [retry ${retryCount}] waiting before next attempt...`);
      },
    ],
  },
});

async function fetchJSON(urlPath: string) {
  return client.get(urlPath).json<any>();
}

function mapResults(rawResults: any[]) {
  const nonFinishTexts = new Set(["R", "D", "E", "W", "F", "N"]);
  return rawResults.map((r: any) => ({
    position: nonFinishTexts.has(r.positionText) ? null : Number(r.position),
    positionText: r.positionText,
    points: Number(r.points),
    driverId: r.Driver?.driverId,
    driverCode: r.Driver?.code ?? r.Driver?.driverId,
    driverName: `${r.Driver?.givenName} ${r.Driver?.familyName}`,
    constructorId: r.Constructor?.constructorId,
    constructorName: r.Constructor?.name,
    grid: Number(r.grid),
    laps: Number(r.laps),
    status: r.status ?? "",
    fastestLap: r.FastestLap?.rank === "1",
  }));
}

async function fetchSeason(year: number) {
  const dir = path.join(DATA_DIR, String(year));
  const racesFile = path.join(dir, "races.json");

  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // Reuse cache if it already has normalized event entries.
  if (fs.existsSync(racesFile)) {
    const cached = JSON.parse(fs.readFileSync(racesFile, "utf-8"));
    if (cached[0]?.raceNumber !== undefined && cached[0]?.type !== undefined) {
      console.log(`  [skip] ${year}/races.json already cached`);
      return cached as { raceNumber: number; round: number; type: "race" | "sprint"; raceName: string; date: string; circuit: string }[];
    }
    console.log(`  [refresh] ${year}/races.json needs normalized event format`);
  }

  console.log(`  [fetch] ${year} schedule`);
  const data = await fetchJSON(`${year}.json?limit=100`);
  const rawRaces = data?.MRData?.RaceTable?.Races ?? [];
  let raceNumber = 1;
  const races = rawRaces.flatMap((r: any) => {
    const entries: Array<{ raceNumber: number; round: number; type: "race" | "sprint"; raceName: string; date: string; circuit: string }> = [];
    if (r.Sprint) {
      entries.push({
        raceNumber: raceNumber++,
        round: Number(r.round),
        type: "sprint",
        raceName: r.raceName,
        date: r.Sprint.date ?? r.date,
        circuit: r.Circuit?.circuitName ?? "",
      });
    }

    entries.push({
      raceNumber: raceNumber++,
      round: Number(r.round),
      type: "race",
      raceName: r.raceName,
      date: r.date,
      circuit: r.Circuit?.circuitName ?? "",
    });

    return entries;
  });
  fs.writeFileSync(racesFile, JSON.stringify(races, null, 2));
  await sleep(DELAY_MS);
  return races;
}

async function fetchEventResults(year: number, raceNumber: number, round: number, type: "race" | "sprint") {
  const dir = path.join(DATA_DIR, String(year));
  const file = path.join(dir, `results-${raceNumber}.json`);
  const endpoint = type === "sprint" ? "sprint" : "results";
  const resultPath = type === "sprint" ? "SprintResults" : "Results";

  if (!fs.existsSync(file)) {
    console.log(`  [fetch] ${year} race ${raceNumber} (${type}, round ${round}) results`);
    const data = await fetchJSON(`${year}/${round}/${endpoint}.json?limit=100`);
    const rawResults = data?.MRData?.RaceTable?.Races?.[0]?.[resultPath] ?? [];
    fs.writeFileSync(file, JSON.stringify(mapResults(rawResults), null, 2));
    await sleep(DELAY_MS);
  } else {
    console.log(`  [skip] ${year}/results-${raceNumber}.json already cached`);
  }
}

async function main() {
  console.log(`Fetching F1 data from ${START_YEAR} to ${CURRENT_YEAR}...\n`);

  for (let year = START_YEAR; year <= CURRENT_YEAR; year++) {
    console.log(`\n=== ${year} ===`);
    const races = await fetchSeason(year);

    for (const race of races) {
      await fetchEventResults(year, race.raceNumber, race.round, race.type);
    }
  }

  console.log("\nDone!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
