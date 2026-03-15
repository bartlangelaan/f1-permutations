import ky from "ky";
import { z } from "zod";

export type EventType = "race" | "sprint";

const BASE_URL = "https://api.jolpi.ca/ergast/f1";

const scheduleRaceSchema = z.object({
  round: z.string().optional(),
  raceName: z.string().min(1),
  Sprint: z.unknown().optional(),
});

const seasonResponseSchema = z.object({
  MRData: z.object({
    RaceTable: z.object({
      Races: z.array(scheduleRaceSchema),
    }),
  }),
});

const rawEventResultSchema = z.object({
  points: z.coerce.number(),
  Driver: z.object({
    driverId: z.string().min(1),
    givenName: z.string().min(1),
    familyName: z.string().min(1),
  }),
  Constructor: z.object({
    constructorId: z.string().min(1),
    name: z.string().min(1),
  }),
});

const seasonRaceResultsResponseSchema = z.object({
  MRData: z.object({
    limit: z.coerce.number(),
    offset: z.coerce.number(),
    total: z.coerce.number(),
    RaceTable: z.object({
      Races: z.array(
        z.object({
          round: z.string(),
          Results: z.array(rawEventResultSchema).optional(),
        })
      ),
    }),
  }),
});

const seasonSprintResultsResponseSchema = z.object({
  MRData: z.object({
    limit: z.coerce.number(),
    offset: z.coerce.number(),
    total: z.coerce.number(),
    RaceTable: z.object({
      Races: z.array(
        z.object({
          round: z.string(),
          SprintResults: z.array(rawEventResultSchema).optional(),
        })
      ),
    }),
  }),
});

const client = ky.create({
  prefixUrl: BASE_URL,
  retry: {
    limit: 5,
    retryOnTimeout: true,
  },
  hooks: {
    beforeRequest: [
      (request) => {
        console.log(`  [fetch] ${request.method} ${request.url}`);
      },
    ],
    beforeRetry: [
      ({ retryCount, error }) => {
        console.log(`  ${error.message}`)
        console.log(`  [retry ${retryCount}] waiting before next attempt...`);
      },
    ],
  },
});

async function fetchJson(path: string): Promise<unknown> {
  return client.get(path).json<unknown>();
}

export async function fetchSeasonSchedule(year: number): Promise<z.infer<typeof scheduleRaceSchema>[]> {
  const response = seasonResponseSchema.parse(await fetchJson(`${year}.json?limit=100`));
  return response.MRData.RaceTable.Races;
}

export async function fetchEventResults(
  year: number,
  type: EventType
): Promise<Array<{ round: string; result: z.infer<typeof rawEventResultSchema> }>> {
  const endpoint = type === "sprint" ? "sprint" : "results";
  const results: Array<{ round: string; result: z.infer<typeof rawEventResultSchema> }> = [];
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    if (type === "sprint") {
      const response = seasonSprintResultsResponseSchema.parse(
        await fetchJson(`${year}/${endpoint}.json?limit=100&offset=${offset}`)
      );

      total = response.MRData.total;
      offset = response.MRData.offset + response.MRData.limit;
      for (const race of response.MRData.RaceTable.Races) {
        for (const result of race.SprintResults ?? []) {
          results.push({
            round: race.round,
            result,
          });
        }
      }
      continue;
    }

    const response = seasonRaceResultsResponseSchema.parse(
      await fetchJson(`${year}/${endpoint}.json?limit=100&offset=${offset}`)
    );

    total = response.MRData.total;
    offset = response.MRData.offset + response.MRData.limit;
    for (const race of response.MRData.RaceTable.Races) {
      for (const result of race.Results ?? []) {
        results.push({
          round: race.round,
          result,
        });
      }
    }
  }

  return results;
}
