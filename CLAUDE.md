# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Start Next.js dev server
pnpm verify       # Run both tests and knip

pnpm fetch-data   # Download F1 race data from Ergast API into data/
pnpm calculate    # Recalculate chart.json files for all seasons
```

To run a single test file: `node --import tsx/esm --test scripts/calculate.test.ts`

## Architecture

**Data pipeline** (offline, before deployment):

1. `scripts/fetch-data.ts` — fetches from `api.jolpi.ca/ergast/f1`, writes JSON to `data/YYYY/` (races, results-N, sprint-N)
2. `scripts/calculate.ts` — reads the fetched data, runs projections, writes `data/YYYY/chart.json`

**Next.js app** (reads pre-computed data, no runtime API calls):

- `app/page.tsx` — redirects to the latest season that has data
- `app/[year]/page.tsx` — server component: reads `chart.json` and passes it to the client
- `app/[year]/SeasonChart.tsx` — client component: interactive chart with recharts

**Core logic in `lib/`**:

- `calculate.ts` — `buildSeasonChartData(year)` loads race data and accumulates cumulative points per entity per slot; `computeProjections(data, isDriver)` calculates min/max points and best/worst finishing positions from every completed race slot to every future slot
- `calculation-results.ts` — `readCalculationResults(year)` / `writeCalculationResults(year, data)` for reading and writing `data/YYYY/calculation-results.json`
- `points.ts` — per-year rules for max points (fastest lap 2019–2024, sprint points 2021+, expanded sprint 2023+)
- `data.ts` — file I/O: reads races.json, results-N.json, sprint-N.json from `data/YYYY/`
- `types.ts` — `Race` and `RaceResult` interfaces

**Key data types** (from `lib/calculate.ts`):

- `TimelineSlot` — one event (sprint or race) with its max available points
- `EntitySeries` — a driver or constructor with cumulative points array aligned to slots (null = not yet run)
- `ProjectionMap` — `projections[selectedSlotIdx][futureSlotIdx][entityId]` → `{ minPts, maxPts, bestPos, worstPos }`

The test in `scripts/calculate.test.ts` validates projection correctness by asserting specific point values for a known driver/race combination. When changing points logic or projection math, update this test's expected values to match the new season's final round.
