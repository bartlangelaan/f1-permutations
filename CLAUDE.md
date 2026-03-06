# F1 Permutations

A Next.js app that calculates championship permutations after any F1 race since 2010 — showing which drivers/constructors can still win the championship and what results are needed.

## Tech Stack

- **Next.js 16** (App Router, TypeScript)
- **Tailwind CSS v4**
- **pnpm** as package manager
- **Ergast API** (or Jolpica as mirror) for F1 race data

## Project Structure

```
/
├── app/                        # Next.js App Router
│   ├── layout.tsx
│   ├── page.tsx                # Home: season/race selector
│   └── [year]/[round]/         # Permutation results page
│       └── page.tsx
├── scripts/
│   └── fetch-data.ts           # Script to fetch & cache F1 data as JSON
├── data/
│   └── {year}/
│       ├── races.json          # Race schedule/metadata for the season
│       └── results-{round}.json  # Race results up to and including each round
├── lib/
│   ├── api.ts                  # Ergast API client
│   ├── data.ts                 # Helpers to read cached JSON data
│   └── permutations.ts         # Core permutation calculation logic
└── CLAUDE.md
```

## Data Source

Use the **Jolpica API** (Ergast mirror, free, no auth needed):
- Base URL: `https://api.jolpi.ca/ergast/f1/`
- Race results: `GET /{year}/{round}/results.json`
- Season schedule: `GET /{year}.json`
- Documentation: https://jolpi.ca/

Fetch data from 2010 to present. Cache locally as JSON files under `data/` to avoid repeated API calls. The fetch script should be idempotent (skip already-cached files).

## Implementation Plan

### Step 1: Data Fetching Script

Create `scripts/fetch-data.ts` that:
1. Loops over years 2010 → current year
2. For each year, fetches the race schedule (`/{year}.json`) → saves to `data/{year}/races.json`
3. For each race round, fetches results (`/{year}/{round}/results.json`) → saves to `data/{year}/results-{round}.json`
4. Skips files that already exist (idempotent caching)
5. Respects rate limits (small delay between requests)

Add a `package.json` script: `"fetch-data": "tsx scripts/fetch-data.ts"`

### Step 2: Core Types

Define TypeScript types in `lib/types.ts`:
- `RaceResult` — driver, constructor, position, points for one race entry
- `Race` — round number, name, date, circuit
- `StandingsEntry` — driver/constructor, current points, wins
- `PermutationResult` — who can still win, required scenarios

### Step 3: Permutation Logic (`lib/permutations.ts`)

For a given year and round, calculate:

**Inputs:** All race results up to the selected round

**Algorithm:**
1. Compute current standings (sum points per driver/constructor)
2. Compute remaining races in the season (total rounds - current round)
3. Calculate maximum points still available (remaining races × 26 for drivers, adjusted for constructors)
4. For each driver/constructor:
   - **Can still win?** Check if `current_points + max_remaining_points >= leader_points`
   - **What's needed?** If they can still win, determine the minimum scenario: how many wins/points they need AND what the leader can score at most
5. Return structured results for display

**Points system (2010+):** 25-18-15-12-10-8-6-4-2-1 for P1–P10, +1 for fastest lap (from 2019)

**Constructor points:** Sum of both drivers' points each race

### Step 4: Data Layer (`lib/data.ts`)

Helper functions:
- `getSeasons()` — list available years from `data/` directory
- `getRaces(year)` — load `data/{year}/races.json`
- `getResults(year, upToRound)` — load and merge results for rounds 1..round
- `getStandings(year, upToRound)` — compute standings from results

### Step 5: Pages

**Home page (`app/page.tsx`):**
- Dropdown/grid to select year (2010–present)
- On year select, show list of races for that season
- Link each race to `/{year}/{round}`

**Results page (`app/[year]/[round]/page.tsx`):**
- Server component — reads data at build/request time
- Shows: race name, date
- Two sections: **Drivers Championship** and **Constructors Championship**
- For each: table of standings with columns: Position, Driver/Team, Points, Can Win?, Required Scenario

### Step 6: UI Polish

- Highlight drivers/constructors who have already clinched
- Show "ELIMINATED" for those who mathematically cannot win
- Show "CHAMPION" if already clinched
- Mobile-responsive layout

## Development Commands

```bash
pnpm dev              # Start dev server
pnpm build            # Production build
pnpm fetch-data       # Fetch & cache F1 data from API
```

## Key Decisions & Notes

- **Server components** for the results page (data is static/cached JSON, no client state needed)
- **Static generation** is possible since historical data doesn't change — use `generateStaticParams` for past seasons
- **Current season** data may need revalidation; use `revalidate` for current year pages
- The fetch script should run before build in CI/production
- Ergast/Jolpica returns paginated results with a default limit; use `?limit=100` to avoid pagination issues for most seasons
