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

// Insights from: https://www.formula1.com/en/latest/article/2024-drivers-championship-max-verstappen-lando-norris-red-bull-points-permutations.6BHWvf0q6MikIuW1IHEOyw
// Standings before Las Vegas 2024: Verstappen leads Norris by 62 points; Leclerc 3rd, Piastri 4th (mathematically eliminated)
//
// Max Verstappen:
//   - Can clinch the title at Las Vegas with victory (title guaranteed regardless of rivals)
//   - More precisely: guaranteed champion if not outscored by Norris by more than 1 point
//     and not outscored by Leclerc by more than 25 points
//
// Lando Norris:
//   - Cannot clinch the title at Las Vegas; earliest possible is after Abu Dhabi GP
//   - P1 is ruled out at Las Vegas if he fails to outscore Verstappen by at least 2 points
//
// Charles Leclerc:
//   - Mathematically alive but P1 ruled out at Las Vegas unless he outscores Verstappen by 26+ points
//   - Can first guarantee P2 only after Abu Dhabi GP
//
// Oscar Piastri:
//   - Has already been eliminated from the title fight ("can no longer take the title")
//   - No P1 lock-in possible; earliest P2 guarantee is after Abu Dhabi GP
//
// NOTE: The blog expresses conditions as race finishing positions (e.g. "win guarantees title"),
// while our system expresses them as points margins. These are equivalent but not directly comparable.
test('Las Vegas 2024 blog: championship permutation insights for Verstappen, Norris, Leclerc, Piastri', () => {
  const data = readCalculationResults(2024)!;
  const lasVegasIdx = data.races.findIndex((r) => r.round === 22 && r.type === 'race');
  const texts = renderInsights(data.driverLockInsights[String(lasVegasIdx)], data);

  // Verstappen can guarantee P1 (championship) in Las Vegas with conditions on Norris and Leclerc
  assert.ok(texts.includes('Max Verstappen can guarantee at least P1 in Las Vegas GP if is not outscored by Lando Norris by more than 1 points, Charles Leclerc by more than 25 points.'));

  // Verstappen can guarantee P2 with only a Leclerc condition
  assert.ok(texts.includes('Max Verstappen can guarantee at least P2 in Las Vegas GP if is not outscored by Charles Leclerc by more than 25 points.'));

  // Norris cannot clinch the title at Las Vegas; earliest is Abu Dhabi
  assert.ok(texts.includes('Lando Norris can first guarantee at least P1 after Abu Dhabi GP.'));

  // Norris P1 ruled out at Las Vegas if he fails to outscore Verstappen by 2+ points
  assert.ok(texts.includes('P1 is no longer possible for Lando Norris in Las Vegas GP if Lando Norris does not outscore Max Verstappen by more than 1 points.'));

  // Leclerc P1 ruled out at Las Vegas unless he outscores Verstappen by 26+ points
  assert.ok(texts.includes('P1 is no longer possible for Charles Leclerc in Las Vegas GP if Charles Leclerc does not outscore Max Verstappen by more than 25 points.'));

  // Piastri is eliminated: earliest P2 is Abu Dhabi, no P1 possible at all
  assert.ok(texts.includes('Oscar Piastri can first guarantee at least P2 after Abu Dhabi GP.'));
  assert.ok(!texts.some((t) => t.startsWith('Oscar Piastri can guarantee at least P1')));
});

// Insights from: https://www.formula1.com/en/latest/article/points-permutations-where-and-when-verstappen-can-become-the-2023-f1-world.412HcLWdfHinODX0u0sIub
// Standings before Qatar 2023: Verstappen 400 pts, Pérez 223 pts (177-point gap); Hamilton and others far behind
//
// Max Verstappen:
//   - Can clinch his third consecutive championship at the Qatar Sprint
//   - Guaranteed champion in the Sprint if not outscored by Pérez by more than 4 points
//   - If Pérez wins Sprint (8 pts) and Verstappen finishes 5th (4 pts): gap = 4, clinches
//   - If Pérez wins Sprint and Verstappen finishes 6th or lower (≤3 pts): gap ≥ 5, does not clinch in Sprint
//   - Verstappen actually clinched the title at the Qatar Sprint
//
// Sergio Pérez:
//   - P1 (championship) no longer possible at Qatar Sprint if he fails to outscore Verstappen by 5+ points
//   - Mathematically still alive before the Sprint by a very slim margin
//
// NOTE: The blog expresses clinch conditions as race finishing positions; our system uses points margins.
test('Qatar 2023 blog: Verstappen clinches championship at Qatar Sprint', () => {
  const data = readCalculationResults(2023)!;

  // Before Qatar Sprint: what can happen in the Sprint
  const qatarSprintIdx = data.races.findIndex((r) => r.round === 17 && r.type === 'sprint');
  const sprintTexts = renderInsights(data.driverLockInsights[String(qatarSprintIdx)], data);

  // Verstappen can guarantee P1 (title) in Qatar Sprint if not outscored by Pérez by more than 4 points
  assert.ok(sprintTexts.includes('Max Verstappen can guarantee at least P1 in R20 Qatar GP Sprint if is not outscored by Sergio Pérez by more than 4 points.'));

  // Pérez P1 ruled out at Sprint if he fails to outscore Verstappen by 5+ points
  assert.ok(sprintTexts.includes('P1 is no longer possible for Sergio Pérez in R20 Qatar GP Sprint if Sergio Pérez does not outscore Max Verstappen by more than 4 points.'));

  // After Qatar Sprint: Verstappen has already locked in P1 (he clinched the title there)
  const qatarRaceIdx = data.races.findIndex((r) => r.round === 17 && r.type === 'race');
  const raceTexts = renderInsights(data.driverLockInsights[String(qatarRaceIdx)], data);
  assert.ok(raceTexts.includes('Max Verstappen has already locked in P1.'));
});

// Insights from: https://www.formula1.com/en/latest/article/points-permutations-what-verstappen-needs-to-do-to-secure-the-f1-title-in.2YMQSetyej7cmdDtsDJZnC
// Standings before Singapore 2022: Verstappen 335 pts, Leclerc 219 pts (116-point gap), Pérez 210 pts (125-point gap)
//
// Max Verstappen:
//   - Singapore is his first opportunity to clinch the 2022 championship
//   - To guarantee at Singapore: outscores Leclerc by 23 pts, Pérez by 14 pts, Russell by 7 pts
//     and is not outscored by Sainz by more than 9 pts
//   - In race positions: wins (25 pts) while Leclerc finishes 9th or lower AND Pérez 4th or lower
//   - Or: wins with fastest lap (26 pts) while Leclerc 8th or lower AND Pérez 4th or lower
//
// Charles Leclerc:
//   - Title becomes impossible at Singapore if outscored by Verstappen by 23 points
//
// Sergio Pérez:
//   - Title becomes impossible at Singapore if outscored by Verstappen by 14 points
//
// George Russell / Carlos Sainz:
//   - Russell P1 ruled out if Verstappen outscores him by 7 points
//   - Sainz P1 ruled out unless he outscores Verstappen by more than 9 points
//
// NOTE: The blog expresses title-clinching conditions as race finishing positions;
// our system expresses them as points margins. These are equivalent but not directly comparable.
test('Singapore 2022 blog: Verstappen first title clinch opportunity', () => {
  const data = readCalculationResults(2022)!;
  const singaporeIdx = data.races.findIndex((r) => r.round === 17 && r.type === 'race');
  const texts = renderInsights(data.driverLockInsights[String(singaporeIdx)], data);

  // Verstappen can guarantee P1 (title) in Singapore GP with conditions on all top rivals
  assert.ok(texts.includes('Max Verstappen can guarantee at least P1 in Singapore GP if outscores Charles Leclerc by 23 points, Sergio Pérez by 14 points, George Russell by 7 points and is not outscored by Carlos Sainz by more than 9 points.'));

  // Leclerc P1 ruled out at Singapore if outscored by Verstappen by 23 points
  assert.ok(texts.includes('P1 is no longer possible for Charles Leclerc in Singapore GP if is outscored by Max Verstappen by 23 points.'));

  // Pérez P1 ruled out at Singapore if outscored by Verstappen by 14 points
  assert.ok(texts.includes('P1 is no longer possible for Sergio Pérez in Singapore GP if is outscored by Max Verstappen by 14 points.'));

  // Russell P1 ruled out if outscored by Verstappen by 7 points
  assert.ok(texts.includes('P1 is no longer possible for George Russell in Singapore GP if is outscored by Max Verstappen by 7 points.'));

  // Sainz P1 ruled out unless he outscores Verstappen by more than 9 points
  assert.ok(texts.includes('P1 is no longer possible for Carlos Sainz in Singapore GP if Carlos Sainz does not outscore Max Verstappen by more than 9 points.'));
});

// Insights from: https://www.formula1.com/en/latest/article/points-permutations-what-verstappen-needs-to-do-to-win-his-second-drivers.2y2rFRR2d2o6LRHPijDzLP
// Standings before Japan 2022: Verstappen 341 pts, Leclerc 237 pts (104-point gap), Pérez 235 pts (106-point gap)
//
// Max Verstappen:
//   - Can clinch his second championship at the Japanese GP
//   - Guaranteed title if: outscores Leclerc by 9 pts AND Pérez by 7 pts AND not outscored by Russell by more than 25 pts
//   - In race positions: 1st place (25 pts) while Leclerc finishes 3rd or lower AND Pérez 4th or lower (with/without fastest lap)
//   - 2nd place with fastest lap (19 pts): Leclerc 5th or lower AND Pérez 4th or lower
//   - 6th place with fastest lap (9 pts): Leclerc 10th or lower AND Pérez 9th or lower
//
// Charles Leclerc:
//   - Title becomes impossible at Japan if outscored by Verstappen by 9 points
//
// Sergio Pérez:
//   - Title becomes impossible at Japan if outscored by Verstappen by 7 points
//
// George Russell:
//   - P1 (title) ruled out unless he outscores Verstappen by more than 25 points
//
// NOTE: The blog expresses title-clinching conditions as race finishing positions;
// our system expresses them as points margins. These are equivalent but not directly comparable.
test('Japan 2022 blog: Verstappen clinches second championship', () => {
  const data = readCalculationResults(2022)!;
  const japanIdx = data.races.findIndex((r) => r.round === 18 && r.type === 'race');
  const texts = renderInsights(data.driverLockInsights[String(japanIdx)], data);

  // Verstappen can guarantee P1 (title) in Japanese GP with conditions on Leclerc, Pérez, and Russell
  assert.ok(texts.includes('Max Verstappen can guarantee at least P1 in Japanese GP if outscores Charles Leclerc by 9 points, Sergio Pérez by 7 points and is not outscored by George Russell by more than 25 points.'));

  // Verstappen can guarantee at least P2 with Pérez and Russell conditions
  assert.ok(texts.includes('Max Verstappen can guarantee at least P2 in Japanese GP if outscores Sergio Pérez by 7 points and is not outscored by George Russell by more than 25 points.'));

  // Verstappen can guarantee at least P3 with only the Russell condition
  assert.ok(texts.includes('Max Verstappen can guarantee at least P3 in Japanese GP if is not outscored by George Russell by more than 25 points.'));

  // Leclerc P1 ruled out at Japan if outscored by Verstappen by 9 points
  assert.ok(texts.includes('P1 is no longer possible for Charles Leclerc in Japanese GP if is outscored by Max Verstappen by 9 points.'));

  // Pérez P1 ruled out at Japan if outscored by Verstappen by 7 points
  assert.ok(texts.includes('P1 is no longer possible for Sergio Pérez in Japanese GP if is outscored by Max Verstappen by 7 points.'));

  // Russell P1 ruled out unless he outscores Verstappen by more than 25 points
  assert.ok(texts.includes('P1 is no longer possible for George Russell in Japanese GP if George Russell does not outscore Max Verstappen by more than 25 points.'));
});
