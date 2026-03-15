/**
 * Blog parity tests
 *
 * Each test corresponds to one F1.com championship-permutations article. The
 * goal is to verify that every insight stated in a blog post is also produced
 * by our system, and to document any insights the blog expresses that we do
 * not yet generate — so future work on feature parity is easy to discover.
 *
 * COMMENT BLOCK ABOVE EACH TEST
 * ------------------------------
 * The block comment directly above each test contains only what the blog
 * itself says: the URL, the standings context, and every position-based
 * scenario described per driver. Nothing about our system belongs there.
 *
 * INSIDE EACH TEST
 * ----------------
 * assert.ok() calls cover every blog condition our system currently produces.
 * Any blog condition not yet generated ends up as a TODO comment at the
 * bottom of the test body, explaining what kind of insight is missing.
 *
 * HOW TO ADD A NEW BLOG TEST
 * --------------------------
 * 1. Fetch the article and extract every championship scenario it mentions:
 *    - Standings before the race weekend (driver, points, gap to leader)
 *    - For each driver: every finishing-position combination that clinches or
 *      eliminates the title, including fastest-lap variants
 *    - Any cross-event scenarios (e.g. "if X wins the Sprint then Y needs Z
 *      in the race")
 *    - Any tiebreaker rules cited
 *
 * 2. Write the block comment above the test with only the above content.
 *    No references to our system, no "(Covered)" or "(TODO)" annotations.
 *
 * 3. Write assert.ok() calls for every blog condition our system produces.
 *    Use renderInsights() and match the exact string from renderInsightText().
 *
 * 4. At the end of the test body, add TODO comments for any blog conditions
 *    our system does not yet generate.
 *
 * HOW TO FIND THE RIGHT raceIdx
 * ------------------------------
 * Insights are keyed by 1-based race number. To get insights *about* a target
 * race, use its 0-based index in data.races as the key:
 *
 *   const idx = data.races.findIndex((r) => r.round === X && r.type === 'race');
 *   const texts = renderInsights(data.driverLockInsights[String(idx)], data);
 *
 * This works because findIndex() returns the 0-based position, which equals
 * the 1-based race number of the preceding race — the slot where insights
 * about the target race are stored.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readCalculationResults } from '../lib/calculation-results.ts';
import type { CalculatedChartData, LockInsight } from '../lib/calculate.ts';
import { renderInsightText } from '../lib/render-insight.ts';

function renderInsights(insights: LockInsight[] | undefined, data: CalculatedChartData): string[] {
  const entitiesById = new Map([...data.drivers, ...data.constructors].map(e => [e.id, { name: e.name }]));
  return (insights ?? []).map(i => renderInsightText(i, data.races, entitiesById));
}

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

  // Piastri is ruled out of P1 (can't win championship) if he doesn't outscore Norris by enough
  assert.ok(texts.includes('P1 is no longer possible for Oscar Piastri in Abu Dhabi GP if Oscar Piastri does not outscore Lando Norris by more than 15 points.'));

  // TODO: The blog expresses all conditions as finishing positions (e.g. "Norris P3 or better wins
  // regardless", "Verstappen P1 + Norris P4 or worse → Verstappen wins"). Our system expresses them
  // as points margins only. Position-based clinch/elimination insights are not yet generated.
});

// Insights from: https://www.formula1.com/en/latest/article/2024-drivers-championship-max-verstappen-lando-norris-red-bull-points-permutations.6BHWvf0q6MikIuW1IHEOyw
// Standings before Las Vegas 2024: Verstappen leads Norris by 62 points; Leclerc 3rd, Piastri 4th
// 86 points available across final three rounds (Las Vegas, Qatar sprint+race, Abu Dhabi)
//
// Max Verstappen:
//   - Wins Las Vegas → title clinched regardless of Norris result
//   - Finishes 2nd  → Norris must finish 1st to stay alive
//   - Finishes 3rd  → Norris must finish 2nd (or 1st if Verstappen takes fastest lap)
//   - Finishes 4th  → Norris must finish 3rd (or 2nd if Verstappen takes fastest lap)
//   - Finishes 5th  → Norris must finish 4th with fastest lap, or 3rd
//   - Finishes 6th  → Norris must finish 5th with fastest lap, or 4th
//   - Finishes 7th  → Norris must finish 6th with fastest lap, or 5th
//   - Finishes 8th  → Norris must finish 7th with fastest lap, or 6th
//   - Finishes 9th  → Norris must finish 8th with fastest lap, or 7th
//   - Finishes 10th → Norris must finish 9th with fastest lap, or 8th
//   - Finishes 11th or lower → Norris must finish 9th with fastest lap, or 8th
//
// Lando Norris:
//   - Cannot clinch the title at Las Vegas; earliest possible is after Abu Dhabi GP
//   - Must outscore Verstappen at every remaining race to keep title hopes alive
//   - Needs minimum 3-point advantage at Las Vegas to keep the fight going
//
// Charles Leclerc:
//   - Mathematically alive: 86 pts behind with 86 pts remaining, but only if Verstappen scores zero
//     AND Leclerc wins every race/sprint with fastest laps — even then they'd tie and Verstappen
//     wins on tie-breaker (more race wins)
//
// Oscar Piastri:
//   - "Can no longer take the title" after Brazil (131 pts down with only 86 remaining)
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

  // TODO: The blog provides a full position-based table ("Verstappen finishes Xth → Norris needs Yth
  // to stay alive", including fastest-lap variants). Our system does not yet generate position-based
  // clinch or keep-alive scenarios; only points-margin conditions are produced.
});

// Insights from: https://www.formula1.com/en/latest/article/points-permutations-where-and-when-verstappen-can-become-the-2023-f1-world.412HcLWdfHinODX0u0sIub
// Standings before Qatar 2023: Verstappen 400 pts, Pérez 223 pts (177-point gap); Hamilton 190 pts
// 180 points available across final 6 rounds; Verstappen clinches if he leaves Qatar with ≥146-pt lead
//
// Qatar Sprint:
//   - If Pérez wins Sprint (8 pts): Verstappen clinches by finishing 6th or better in the Sprint
//   - If Verstappen finishes outside the Sprint points AND Pérez wins: Verstappen needs 8th in the GP
//
// Qatar GP race:
//   - Verstappen clinches if he leaves Qatar with ≥146-pt lead over Pérez
//   - Pérez can only stay mathematically alive by winning the GP and reducing the gap to 145 pts
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

  // TODO: The blog describes position-based Sprint scenarios ("Verstappen finishes 6th or better →
  // clinches if Pérez wins") and cross-event conditions ("if Verstappen scores nothing in Sprint,
  // he needs 8th in the GP"). Neither position-based scenarios nor cross-event Sprint+Race
  // combinations are currently generated.
});

// Insights from: https://www.formula1.com/en/latest/article/points-permutations-what-verstappen-needs-to-do-to-secure-the-f1-title-in.2YMQSetyej7cmdDtsDJZnC
// Standings before Singapore 2022: Verstappen 335 pts, Leclerc 219 pts (116-point gap), Pérez 210 pts (125-point gap)
// Singapore is Verstappen's first opportunity to clinch; must outscore Leclerc by 22 pts to eliminate him
//
// Verstappen clinches at Singapore:
//   - Wins (no fastest lap):   Leclerc 9th or lower  AND  Pérez 4th or lower (no FL) or 5th or lower (with FL)
//   - Wins (with fastest lap): Leclerc 8th or lower  AND  Pérez 4th or lower
//   - Any other Verstappen result → no clinch at Singapore; title fight rolls on to Japan
//
// Charles Leclerc:
//   - Title becomes impossible at Singapore if outscored by Verstappen by 23 points
//
// Sergio Pérez:
//   - Title becomes impossible at Singapore if outscored by Verstappen by 14 points
//
// George Russell:
//   - Title becomes impossible at Singapore if outscored by Verstappen by 7 points
//
// Carlos Sainz:
//   - Title becomes impossible at Singapore unless he outscores Verstappen by more than 9 points
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

  // TODO: The blog expresses Verstappen's clinch as specific finishing-position combinations
  // ("wins + Leclerc 9th or lower + Pérez 4th or lower"), including a fastest-lap variant for Pérez
  // ("Pérez 5th or lower with FL"). Position-based clinch conditions and the fastest-lap distinction
  // are not yet generated.
});

// Insights from: https://www.formula1.com/en/latest/article/points-permutations-what-verstappen-needs-to-do-to-win-his-second-drivers.2y2rFRR2d2o6LRHPijDzLP
// Standings before Japan 2022: Verstappen 341 pts, Leclerc 237 pts (104-point gap), Pérez 235 pts (106-point gap)
// Verstappen needs a 112-point lead to mathematically clinch; Japan is where he can reach that
//
// Verstappen clinches at Japan (full table from the blog):
//   - 1st + fastest lap:  title regardless of Leclerc and Pérez positions
//   - 1st (no FL):        Leclerc 3rd or lower  (Pérez position irrelevant)
//   - 2nd + fastest lap:  Leclerc 5th or lower   AND  Pérez 4th or lower
//   - 2nd (no FL):        Leclerc 5th or lower (no FL)  AND  Pérez 4th or lower (no FL)
//   - 3rd + fastest lap:  Leclerc 6th or lower   AND  Pérez 5th or lower
//   - 3rd (no FL):        Leclerc 7th or lower   AND  Pérez 6th or lower
//   - 4th + fastest lap:  Leclerc 8th or lower   AND  Pérez 7th or lower
//   - 4th (no FL):        Leclerc 8th or lower (no FL)  AND  Pérez 7th or lower (no FL)
//   - 5th + fastest lap:  Leclerc 9th or lower   AND  Pérez 8th or lower
//   - 5th (no FL):        Leclerc 9th (no FL) or lower  AND  Pérez 8th or lower (no FL)
//   - 6th + fastest lap:  Leclerc 10th or lower  AND  Pérez 9th or lower
//   - 6th (no FL):        Leclerc out of points  AND  Pérez 9th or lower (no FL)
//
// Title fight stays alive if:
//   - Leclerc wins
//   - Pérez wins
//   - Verstappen wins (no FL) but Leclerc finishes 2nd with fastest lap
//
// Charles Leclerc:
//   - Title becomes impossible at Japan if outscored by Verstappen by 9 points
//
// Sergio Pérez:
//   - Title becomes impossible at Japan if outscored by Verstappen by 7 points
//
// George Russell:
//   - Title becomes impossible at Japan unless he outscores Verstappen by more than 25 points
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

  // TODO: The blog provides a full position-based table with fastest-lap variants for every finishing
  // position (e.g. "1st + FL → title regardless", "1st no FL → Leclerc must be 3rd or lower",
  // "2nd + FL → Leclerc 5th or lower AND Pérez 4th or lower"). It also lists conditions under which
  // the title fight stays alive. Position-based clinch conditions and fastest-lap distinctions
  // are not yet generated.
});
