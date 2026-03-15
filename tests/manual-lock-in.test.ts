import test from 'node:test';
import assert from 'node:assert/strict';
import { readCalculationResults } from '../lib/calculation-results.ts';
import type { CalculatedChartData, LockInsight } from '../lib/calculate.ts';
import { renderInsightText } from '../lib/render-insight.ts';

function findInsight(
  insights: LockInsight[] | undefined,
  type: LockInsight['type'],
  entityId: string,
  position: number
): LockInsight | undefined {
  return insights?.find(
    (insight) => insight.type === type && insight.entityId === entityId && insight.position === position
  );
}

function renderInsight(insight: LockInsight, data: CalculatedChartData): string {
  const entitiesById = new Map([...data.drivers, ...data.constructors].map(e => [e.id, { name: e.name }]));
  return renderInsightText(insight, data.races, entitiesById);
}

test('Lock-in insight: Norris cannot lock P1 in the next race after Mexico 2025', () => {
  const data2025 = readCalculationResults(2025);
  assert.ok(data2025, 'No calculation results found for 2025. Run pnpm calculate first.');

  const mexicoRaceNum = data2025.races.findIndex((r) => r.round === 20 && r.type === 'race') + 1;
  assert.ok(mexicoRaceNum > 0, 'Mexico 2025 race not found');

  const norrisNextRaceInsights = (data2025.driverLockInsights[String(mexicoRaceNum)] ?? []).filter(
    (insight) => insight.entityId === 'norris' && insight.type === 'can_be_locked_in_next_race'
  );
  assert.equal(norrisNextRaceInsights.length, 0, 'Expected no next-race guarantee insight for Norris after Mexico 2025');

  const norrisP1Later = findInsight(
    data2025.driverLockInsights[String(mexicoRaceNum)],
    'can_be_locked_in_later',
    'norris',
    1
  );
  assert.ok(norrisP1Later, 'Expected a later P1 guarantee insight for Norris after Mexico 2025');
  assert.equal(
    renderInsight(norrisP1Later, data2025),
    'Lando Norris can first guarantee at least P1 after R28 Qatar GP Sprint.'
  );
});

test('Lock-in insight: Verstappen exposes every next-race minimum lock from P1 through P4 after Italy 2022', () => {
  const data2022 = readCalculationResults(2022);
  assert.ok(data2022, 'No calculation results found for 2022. Run pnpm calculate first.');

  const italyRaceNum = data2022.races.findIndex((r) => r.round === 16 && r.type === 'race') + 1;
  assert.ok(italyRaceNum > 0, 'Italy 2022 race not found');

  const insights = data2022.driverLockInsights[String(italyRaceNum)];

  const verstappenP1 = findInsight(insights, 'can_be_locked_in_next_race', 'max_verstappen', 1);
  const verstappenP2 = findInsight(insights, 'can_be_locked_in_next_race', 'max_verstappen', 2);
  const verstappenP3 = findInsight(insights, 'can_be_locked_in_next_race', 'max_verstappen', 3);
  const verstappenP4 = findInsight(insights, 'can_be_locked_in_next_race', 'max_verstappen', 4);

  assert.ok(verstappenP1, 'Verstappen P1 guarantee insight missing after Italy 2022');
  assert.ok(verstappenP2, 'Verstappen P2 guarantee insight missing after Italy 2022');
  assert.ok(verstappenP3, 'Verstappen P3 guarantee insight missing after Italy 2022');
  assert.ok(verstappenP4, 'Verstappen P4 guarantee insight missing after Italy 2022');

  assert.equal(
    renderInsight(verstappenP1, data2022),
    'Max Verstappen can guarantee at least P1 in Singapore GP if outscores Charles Leclerc by 23 points, Sergio Pérez by 14 points, George Russell by 7 points and is not outscored by Carlos Sainz by more than 9 points.'
  );
  assert.equal(
    renderInsight(verstappenP2, data2022),
    'Max Verstappen can guarantee at least P2 in Singapore GP if outscores Sergio Pérez by 14 points, George Russell by 7 points and is not outscored by Carlos Sainz by more than 9 points.'
  );
  assert.equal(
    renderInsight(verstappenP3, data2022),
    'Max Verstappen can guarantee at least P3 in Singapore GP if outscores George Russell by 7 points and is not outscored by Carlos Sainz by more than 9 points.'
  );
  assert.equal(
    renderInsight(verstappenP4, data2022),
    'Max Verstappen can guarantee at least P4 in Singapore GP if is not outscored by Carlos Sainz by more than 9 points.'
  );
});

test('Lock-in insight: 2025 title contenders show every lockable minimum position in the finale', () => {
  const data2025 = readCalculationResults(2025);
  assert.ok(data2025, 'No calculation results found for 2025. Run pnpm calculate first.');

  const qatarRaceNum = data2025.races.findIndex((r) => r.round === 23 && r.type === 'race') + 1;
  assert.ok(qatarRaceNum > 0, 'Qatar 2025 race not found');

  for (const entityId of ['norris', 'max_verstappen', 'piastri'] as const) {
    const p1Insight = findInsight(data2025.driverLockInsights[String(qatarRaceNum)], 'can_be_locked_in_next_race', entityId, 1);
    const p2Insight = findInsight(data2025.driverLockInsights[String(qatarRaceNum)], 'can_be_locked_in_next_race', entityId, 2);
    assert.ok(p1Insight, `${entityId} P1 guarantee insight missing after Qatar 2025`);
    assert.ok(p2Insight, `${entityId} P2 guarantee insight missing after Qatar 2025`);
  }
});

test('Lock-in insight: later guarantees are emitted per position instead of stopping at the first one', () => {
  const data2025 = readCalculationResults(2025);
  assert.ok(data2025, 'No calculation results found for 2025. Run pnpm calculate first.');

  const mexicoRaceNum = data2025.races.findIndex((r) => r.round === 20 && r.type === 'race') + 1;
  assert.ok(mexicoRaceNum > 0, 'Mexico 2025 race not found');

  const insights = data2025.driverLockInsights[String(mexicoRaceNum)];

  assert.ok(findInsight(insights, 'can_be_locked_in_later', 'norris', 1), 'Expected a later P1 guarantee insight for Norris after Mexico 2025');
  assert.ok(findInsight(insights, 'can_be_locked_in_later', 'norris', 2), 'Expected a later P2 guarantee insight for Norris after Mexico 2025');
  assert.ok(findInsight(insights, 'can_be_locked_in_later', 'norris', 3), 'Expected a later P3 guarantee insight for Norris after Mexico 2025');
  assert.ok(findInsight(insights, 'can_be_locked_in_later', 'norris', 4), 'Expected a later P4 guarantee insight for Norris after Mexico 2025');
});

test('Lock-in insight: next-race ruled-out positions are exposed', () => {
  const data2025 = readCalculationResults(2025);
  assert.ok(data2025, 'No calculation results found for 2025. Run pnpm calculate first.');

  const mexicoRaceNum = data2025.races.findIndex((r) => r.round === 20 && r.type === 'race') + 1;
  assert.ok(mexicoRaceNum > 0, 'Mexico 2025 race not found');

  const leclercP3RuleOut = findInsight(
    data2025.driverLockInsights[String(mexicoRaceNum)],
    'can_be_ruled_out_next_race',
    'leclerc',
    3
  );
  assert.ok(leclercP3RuleOut, 'Leclerc P3 rule-out insight missing after Mexico 2025');
  assert.equal(
    renderInsight(leclercP3RuleOut, data2025),
    'P3 is no longer possible for Charles Leclerc in R25 São Paulo GP Sprint if Charles Leclerc does not outscore Max Verstappen by more than 2 points.'
  );
});
