import test from 'node:test';
import assert from 'node:assert/strict';
import { readCalculationResults } from '../lib/calculation-results.ts';
import type { CalculatedChartData, LockInsight } from '../lib/calculate.ts';
import { renderInsightText } from '../lib/render-insight.ts';

function renderInsights(insights: LockInsight[] | undefined, data: CalculatedChartData): string[] {
  const entitiesById = new Map([...data.drivers, ...data.constructors].map(e => [e.id, { name: e.name }]));
  return (insights ?? []).map(i => renderInsightText(i, data.races, entitiesById));
}

test('Lock-in insight: Norris cannot lock P1 in the next race after Mexico 2025', () => {
  const data = readCalculationResults(2025)!;
  const mexicoRaceNum = data.races.findIndex((r) => r.round === 20 && r.type === 'race') + 1;

  const norrisNextRaceInsights = (data.driverLockInsights[String(mexicoRaceNum)] ?? []).filter(
    (insight) => insight.entityId === 'norris' && insight.type === 'can_be_locked_in_next_race'
  );
  assert.equal(norrisNextRaceInsights.length, 0, 'Expected no next-race guarantee insight for Norris after Mexico 2025');

  const texts = renderInsights(data.driverLockInsights[String(mexicoRaceNum)], data);
  assert.ok(texts.includes('Lando Norris can first guarantee at least P1 after R28 Qatar GP Sprint.'));
});

test('Lock-in insight: Verstappen exposes every next-race minimum lock from P1 through P4 after Italy 2022', () => {
  const data2022 = readCalculationResults(2022)!;
  const italyRaceNum = data2022.races.findIndex((r) => r.round === 16 && r.type === 'race') + 1;
  const texts = renderInsights(data2022.driverLockInsights[String(italyRaceNum)], data2022);

  assert.ok(texts.includes('Max Verstappen can guarantee at least P1 in Singapore GP if outscores Charles Leclerc by 23 points, Sergio Pérez by 14 points, George Russell by 7 points and is not outscored by Carlos Sainz by more than 9 points.'));
  assert.ok(texts.includes('Max Verstappen can guarantee at least P2 in Singapore GP if outscores Sergio Pérez by 14 points, George Russell by 7 points and is not outscored by Carlos Sainz by more than 9 points.'));
  assert.ok(texts.includes('Max Verstappen can guarantee at least P3 in Singapore GP if outscores George Russell by 7 points and is not outscored by Carlos Sainz by more than 9 points.'));
  assert.ok(texts.includes('Max Verstappen can guarantee at least P4 in Singapore GP if is not outscored by Carlos Sainz by more than 9 points.'));
});

test('Lock-in insight: 2025 title contenders show every lockable minimum position in the finale', () => {
  const data = readCalculationResults(2025)!;
  const qatarRaceNum = data.races.findIndex((r) => r.round === 23 && r.type === 'race') + 1;
  const texts = renderInsights(data.driverLockInsights[String(qatarRaceNum)], data);

  assert.ok(texts.some(t => t.startsWith('Lando Norris can guarantee at least P1 in')));
  assert.ok(texts.some(t => t.startsWith('Lando Norris can guarantee at least P2 in')));
  assert.ok(texts.some(t => t.startsWith('Max Verstappen can guarantee at least P1 in')));
  assert.ok(texts.some(t => t.startsWith('Max Verstappen can guarantee at least P2 in')));
  assert.ok(texts.some(t => t.startsWith('Oscar Piastri can guarantee at least P1 in')));
  assert.ok(texts.some(t => t.startsWith('Oscar Piastri can guarantee at least P2 in')));
});

test('Lock-in insight: later guarantees are emitted per position instead of stopping at the first one', () => {
  const data = readCalculationResults(2025)!;
  const mexicoRaceNum = data.races.findIndex((r) => r.round === 20 && r.type === 'race') + 1;
  const texts = renderInsights(data.driverLockInsights[String(mexicoRaceNum)], data);

  assert.ok(texts.includes('Lando Norris can first guarantee at least P1 after R28 Qatar GP Sprint.'));
  assert.ok(texts.includes('Lando Norris can first guarantee at least P2 after R28 Qatar GP Sprint.'));
  assert.ok(texts.includes('Lando Norris can first guarantee at least P3 after Las Vegas GP.'));
  assert.ok(texts.includes('Lando Norris can first guarantee at least P4 after Las Vegas GP.'));
});

// Insights from: https://www.formula1.com/en/latest/article/championship-permutations-where-does-norris-need-to-finish-in-abu-dhabi-to.DtWufByimYARjI5kujzt3
// Standings before Abu Dhabi 2025: Norris 408 pts, Verstappen 396 pts, Piastri 392 pts
//
// Lando Norris:
//   - Finishes P1, P2, or P3 → wins championship regardless of rivals
//   - Finishes P4 or P5 → wins if Verstappen finishes P2 or worse AND Piastri doesn't win
//   - Finishes P6 or P7 → wins if both Verstappen and Piastri finish outside the top 2
//   - Finishes P8 → wins if Verstappen finishes P3 or worse AND Piastri finishes P2 or worse
//   - Finishes P9 or lower → needs increasingly specific results from competitors
//
// Max Verstappen:
//   - Finishes P1 + Norris finishes P4 or worse → wins championship
//   - Finishes P2 + Norris finishes P8 or worse + Piastri finishes P3 or worse → wins
//   - Finishes P3 + Norris finishes P9 or worse + Piastri finishes P2 or worse → wins
//
// Oscar Piastri:
//   - Can only win the title if he finishes P1 or P2
//   - Finishes P1 + Norris finishes P6 or worse → wins championship
//   - Finishes P2 + Norris finishes P10 or worse + Verstappen finishes P4 or worse → wins
test('Abu Dhabi 2025 blog: championship permutation insights for Norris, Verstappen, and Piastri', () => {
  const data = readCalculationResults(2025)!;
  const afterRaceNum = data.races.findIndex((r) => r.fullLabel === 'Abu Dhabi GP' && r.type === 'race');
  const texts = renderInsights(data.driverLockInsights[String(afterRaceNum)], data);

  // Norris can guarantee P1 (championship win) with conditions on Verstappen and Piastri
  assert.ok(texts.includes('Lando Norris can guarantee at least P1 in Abu Dhabi GP if is not outscored by Max Verstappen by more than 11 points, Oscar Piastri by more than 15 points.'));

  // Norris can guarantee P2 with a condition only on Piastri
  assert.ok(texts.includes('Lando Norris can guarantee at least P2 in Abu Dhabi GP if is not outscored by Oscar Piastri by more than 15 points.'));

  // Verstappen can guarantee P1 (championship win) if he outscores Norris by enough and Piastri doesn't beat him
  assert.ok(texts.includes('Max Verstappen can guarantee at least P1 in Abu Dhabi GP if outscores Lando Norris by 13 points and is not outscored by Oscar Piastri by more than 3 points.'));

  // Verstappen can guarantee P2 with a condition only on Piastri
  assert.ok(texts.includes('Max Verstappen can guarantee at least P2 in Abu Dhabi GP if is not outscored by Oscar Piastri by more than 3 points.'));

  // Piastri can guarantee P1 (championship win) by outscoring both Norris and Verstappen by enough
  assert.ok(texts.includes('Oscar Piastri can guarantee at least P1 in Abu Dhabi GP if outscores Lando Norris by 17 points, Max Verstappen by 5 points.'));

  // Piastri can guarantee P2 with a condition only on Verstappen
  assert.ok(texts.includes('Oscar Piastri can guarantee at least P2 in Abu Dhabi GP if outscores Max Verstappen by 5 points.'));

  // Norris is ruled out of P1 (loses championship) if Verstappen outscores him by enough
  assert.ok(texts.includes('P1 is no longer possible for Lando Norris in Abu Dhabi GP if is outscored by Max Verstappen by 13 points.'));

  // Piastri is ruled out of P1 (can\'t win championship) if he doesn\'t outscore Norris by enough
  assert.ok(texts.includes('P1 is no longer possible for Oscar Piastri in Abu Dhabi GP if Oscar Piastri does not outscore Lando Norris by more than 15 points.'));

  // NOTE: The blog expresses conditions as race finishing positions (e.g. "Norris P3 or better wins regardless"),
  // while our system expresses them as points margins. These are equivalent but not yet directly comparable.
  // Bridging race positions to points margins is not yet implemented.
});

test('Lock-in insight: next-race ruled-out positions are exposed', () => {
  const data = readCalculationResults(2025)!;
  const mexicoRaceNum = data.races.findIndex((r) => r.round === 20 && r.type === 'race') + 1;
  const texts = renderInsights(data.driverLockInsights[String(mexicoRaceNum)], data);

  assert.ok(texts.includes('P3 is no longer possible for Charles Leclerc in R25 São Paulo GP Sprint if Charles Leclerc does not outscore Max Verstappen by more than 2 points.'));
});
