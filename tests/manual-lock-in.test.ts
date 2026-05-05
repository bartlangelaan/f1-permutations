import assert from "node:assert/strict";
import test from "node:test";
import type { CalculatedChartData, LockInsight } from "../lib/calculate.ts";
import { readCalculationResults } from "../lib/calculation-results.ts";
import { renderInsightTexts } from "../lib/render-insight.ts";

function renderInsights(insights: LockInsight[] | undefined, data: CalculatedChartData): string[] {
  const entitiesById = new Map(
    [...data.drivers, ...data.constructors].map((e) => [
      e.id,
      { name: e.name, shortLabel: e.shortLabel },
    ]),
  );
  return (insights ?? []).flatMap((i) => renderInsightTexts(i, data.races, entitiesById));
}

test("Lock-in insight: Norris cannot lock P1 in the next race after Mexico 2025", () => {
  const data = readCalculationResults(2025)!;
  const mexicoRaceNum = data.races.findIndex((r) => r.round === 20 && r.type === "race") + 1;

  const norrisNextRaceP1Insights = (data.driverLockInsights[String(mexicoRaceNum)] ?? []).filter(
    (insight) =>
      insight.entityId === "norris" &&
      insight.type === "can_be_locked_in_next_race" &&
      insight.position === 1,
  );
  assert.equal(
    norrisNextRaceP1Insights.length,
    0,
    "Expected no P1 next-race guarantee insight for Norris after Mexico 2025",
  );

  const texts = renderInsights(data.driverLockInsights[String(mexicoRaceNum)], data);
  assert.ok(texts.includes("Norris can first guarantee at least P1 after Qatar (23) Sprint."));
});

test("Lock-in insight: Verstappen exposes every next-race minimum lock from P1 through P4 after Italy 2022", () => {
  const data2022 = readCalculationResults(2022)!;
  const italyRaceNum = data2022.races.findIndex((r) => r.round === 16 && r.type === "race") + 1;
  const texts = renderInsights(data2022.driverLockInsights[String(italyRaceNum)], data2022);

  assert.ok(
    texts.includes(
      "Verstappen can guarantee at least P1 in Singapore (17) Race if outscores Leclerc by 23 points, Pérez by 14 points, Russell by 7 points and is not outscored by Sainz by more than 9 points.",
    ),
  );
  assert.ok(
    texts.includes(
      "Verstappen can guarantee at least P2 in Singapore (17) Race if outscores Pérez by 14 points, Russell by 7 points and is not outscored by Sainz by more than 9 points.",
    ),
  );
  assert.ok(
    texts.includes(
      "Verstappen can guarantee at least P3 in Singapore (17) Race if outscores Russell by 7 points and is not outscored by Sainz by more than 9 points.",
    ),
  );
  assert.ok(
    texts.includes(
      "Verstappen can guarantee at least P4 in Singapore (17) Race if is not outscored by Sainz by more than 9 points.",
    ),
  );
});

test("Lock-in insight: 2025 title contenders show every lockable minimum position in the finale", () => {
  const data = readCalculationResults(2025)!;
  const qatarRaceNum = data.races.findIndex((r) => r.round === 23 && r.type === "race") + 1;
  const texts = renderInsights(data.driverLockInsights[String(qatarRaceNum)], data);

  assert.ok(texts.some((t) => t.startsWith("Norris can guarantee at least P1 in")));
  assert.ok(texts.some((t) => t.startsWith("Norris can guarantee at least P2 in")));
  assert.ok(texts.some((t) => t.startsWith("Verstappen can guarantee at least P1 in")));
  assert.ok(texts.some((t) => t.startsWith("Verstappen can guarantee at least P2 in")));
  assert.ok(texts.some((t) => t.startsWith("Piastri can guarantee at least P1 in")));
  assert.ok(texts.some((t) => t.startsWith("Piastri can guarantee at least P2 in")));
});

test("Lock-in insight: later guarantees are emitted per position instead of stopping at the first one", () => {
  const data = readCalculationResults(2025)!;
  const mexicoRaceNum = data.races.findIndex((r) => r.round === 20 && r.type === "race") + 1;
  const texts = renderInsights(data.driverLockInsights[String(mexicoRaceNum)], data);

  assert.ok(texts.includes("Norris can first guarantee at least P1 after Qatar (23) Sprint."));
  assert.ok(texts.includes("Norris can first guarantee at least P2 after Qatar (23) Sprint."));
  assert.ok(texts.includes("Norris can first guarantee at least P3 after Las Vegas (22) Race."));
  assert.ok(texts.includes("Norris can first guarantee at least P4 after Las Vegas (22) Race."));
});

test("Lock-in insight: next-race ruled-out positions are exposed", () => {
  const data = readCalculationResults(2025)!;
  const mexicoRaceNum = data.races.findIndex((r) => r.round === 20 && r.type === "race") + 1;
  const texts = renderInsights(data.driverLockInsights[String(mexicoRaceNum)], data);

  assert.ok(
    texts.includes(
      "P3 is no longer possible for Leclerc in São Paulo (21) Sprint if Leclerc does not outscore Verstappen by more than 2 points.",
    ),
  );
});
