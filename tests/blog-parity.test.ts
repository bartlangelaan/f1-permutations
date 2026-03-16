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
 * itself says: the URL, the standings context, and every scenario described.
 * This covers drivers and constructors alike — whatever the post talks about.
 * Include any detail an F1 nerd would find interesting: position-based clinch
 * tables, fastest-lap variants, tiebreaker rules, cross-event conditions, etc.
 * The examples below are illustrative, not exhaustive. Nothing about our
 * system belongs in the block comment.
 *
 * INSIDE EACH TEST
 * ----------------
 * assert.ok() calls cover every blog condition our system currently produces,
 * for both drivers and constructors. Any blog condition not yet generated ends
 * up as a TODO comment at the bottom of the test body, explaining what kind
 * of insight is missing.
 *
 * HOW TO ADD A NEW BLOG TEST
 * --------------------------
 * 1. Fetch the article and extract every championship scenario it mentions:
 *    - Standings before the race weekend (drivers and constructors, points, gaps)
 *    - For each driver/constructor: every finishing-position combination that
 *      clinches or eliminates the title, including fastest-lap variants
 *    - Any cross-event scenarios (e.g. "if X wins the Sprint then Y needs Z
 *      in the race")
 *    - Any tiebreaker rules cited
 *    - Any other insight that would interest an F1 fan
 *
 * 2. Write the block comment above the test with only the above content.
 *    No references to our system, no "(Covered)" or "(TODO)" annotations.
 *
 * 3. Write assert.ok() calls for every blog condition our system produces,
 *    for both driver and constructor insights.
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
//
// Constructors' championship:
//   - McLaren leads Ferrari by 36 pts, Red Bull a further 13 pts behind Ferrari; 147 pts available
//   - Nobody can clinch the constructors' title at Las Vegas; earliest opportunity is Abu Dhabi
//   - Mercedes are already eliminated from the top 3
test('Las Vegas 2024 blog: championship permutation insights for Verstappen, Norris, Leclerc, Piastri', () => {
  const data = readCalculationResults(2024)!;
  const lasVegasIdx = data.races.findIndex((r) => r.round === 22 && r.type === 'race');
  const texts = renderInsights(data.driverLockInsights[String(lasVegasIdx)], data);
  const constructorTexts = renderInsights(data.constructorLockInsights[String(lasVegasIdx)], data);

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

  // Nobody can clinch the constructors' title at Las Vegas; all top teams' earliest guarantee is Abu Dhabi
  assert.ok(constructorTexts.includes('McLaren can first guarantee at least P1 after Abu Dhabi GP.'));
  assert.ok(constructorTexts.includes('Ferrari can first guarantee at least P1 after Abu Dhabi GP.'));
  assert.ok(constructorTexts.includes('Red Bull can first guarantee at least P1 after Abu Dhabi GP.'));

  // Mercedes is already locked into P4 — eliminated from the top 3
  assert.ok(constructorTexts.includes('Mercedes has already locked in P4.'));

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
//
// Constructors' championship:
//   - Red Bull cannot clinch the constructors' title at Singapore; earliest opportunity is after United States GP
//   - Red Bull would need a 191-pt lead after Japan; currently 139 pts up with only 88 pts available
//     across Singapore and Japan combined
test('Singapore 2022 blog: Verstappen first title clinch opportunity', () => {
  const data = readCalculationResults(2022)!;
  const singaporeIdx = data.races.findIndex((r) => r.round === 17 && r.type === 'race');
  const texts = renderInsights(data.driverLockInsights[String(singaporeIdx)], data);
  const constructorTexts = renderInsights(data.constructorLockInsights[String(singaporeIdx)], data);

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

  // Red Bull cannot clinch constructors' at Singapore; earliest is after United States GP
  assert.ok(constructorTexts.includes('Red Bull can first guarantee at least P1 after United States GP.'));

  // TODO: The blog expresses Verstappen's clinch as specific finishing-position combinations
  // ("wins + Leclerc 9th or lower + Pérez 4th or lower"), including a fastest-lap variant for Pérez
  // ("Pérez 5th or lower with FL"). Position-based clinch conditions and the fastest-lap distinction
  // are not yet generated.
  // TODO: The blog describes the constructors' gap in terms of what Red Bull would need to clinch
  // (a 191-pt lead) versus what is achievable (139 pts up with 88 remaining). Insight types for
  // "cannot clinch this weekend due to insufficient points available" are not yet generated.
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
//
// Constructors' championship:
//   - Red Bull leads Ferrari by 137 pts with 235 pts remaining across the final 8 rounds
//   - Even a Red Bull 1-2 with fastest lap at Japan does not clinch the constructors' title;
//     Ferrari's Singapore double podium kept them alive and the fight continues at least to USA
test('Japan 2022 blog: Verstappen clinches second championship', () => {
  const data = readCalculationResults(2022)!;
  const japanIdx = data.races.findIndex((r) => r.round === 18 && r.type === 'race');
  const texts = renderInsights(data.driverLockInsights[String(japanIdx)], data);
  const constructorTexts = renderInsights(data.constructorLockInsights[String(japanIdx)], data);

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

  // Red Bull cannot clinch constructors' at Japan; earliest is after Mexico City GP
  assert.ok(constructorTexts.includes('Red Bull can first guarantee at least P1 after Mexico City GP.'));

  // Red Bull can guarantee constructors' P2 in Japan (locking out Mercedes) with a small margin condition
  assert.ok(constructorTexts.includes('Red Bull can guarantee at least P2 in Japanese GP if is not outscored by Mercedes by more than 11 points.'));

  // TODO: The blog provides a full position-based table with fastest-lap variants for every finishing
  // position (e.g. "1st + FL → title regardless", "1st no FL → Leclerc must be 3rd or lower",
  // "2nd + FL → Leclerc 5th or lower AND Pérez 4th or lower"). It also lists conditions under which
  // the title fight stays alive. Position-based clinch conditions and fastest-lap distinctions
  // are not yet generated.
  // TODO: The blog explains that even a Red Bull 1-2 + fastest lap cannot clinch the constructors'
  // title at Japan. Insight types that describe "insufficient points available to clinch this
  // weekend" are not yet generated.
});

// Insights from: https://www.formula1.com/en/latest/features/2015/10/title-permutations---how-hamilton-can-wrap-it-up-in-austin.html
// Standings before United States 2015: Hamilton 302 pts, Vettel 236 pts (66-point gap), Rosberg 229 pts
// 4 races remain (Austin + 3 more); max 75 pts available after Austin
//
// Lewis Hamilton:
//   - Blog: needs to outscore Vettel by nine points and Rosberg by two points to clinch
//   - (With 66-pt gap and 75 remaining, Hamilton clinches if he extends lead by ≥9)
//
// Constructors' championship:
//   - Mercedes has already won the 2015 constructors' title before Austin
test('United States 2015 blog: Hamilton clinches third drivers\' championship', () => {
  const data = readCalculationResults(2015)!;
  const usIdx = data.races.findIndex((r) => r.round === 16 && r.type === 'race');
  const texts = renderInsights(data.driverLockInsights[String(usIdx)], data);
  const constructorTexts = renderInsights(data.constructorLockInsights[String(usIdx)], data);

  // Hamilton can guarantee P1 (title) with conditions on both Vettel and Rosberg
  // Blog says "nine points over Vettel" — system produces 10 (the strict ≥ threshold)
  assert.ok(texts.includes('Lewis Hamilton can guarantee at least P1 in United States GP if outscores Sebastian Vettel by 10 points, Nico Rosberg by 3 points.'));

  // Hamilton can guarantee P2 with only the Rosberg condition
  assert.ok(texts.includes('Lewis Hamilton can guarantee at least P2 in United States GP if outscores Nico Rosberg by 3 points.'));

  // Vettel is eliminated from P1 at Austin if Hamilton outscores him by enough
  assert.ok(texts.includes('P1 is no longer possible for Sebastian Vettel in United States GP if is outscored by Lewis Hamilton by 10 points.'));

  // Rosberg is eliminated from P1 at Austin if Hamilton outscores him enough
  assert.ok(texts.includes('P1 is no longer possible for Nico Rosberg in United States GP if is outscored by Lewis Hamilton by 3 points.'));

  // Mercedes has already clinched the constructors' title before Austin
  assert.ok(constructorTexts.includes('Mercedes has already locked in P1.'));

  // TODO: The blog expresses conditions as finishing positions ("outscore Vettel by nine
  // points"), meaning Hamilton winning and Vettel finishing P3 or lower (25-15=10) or Hamilton
  // P2 and Vettel outside the points. Position-based clinch conditions are not yet generated.
});

// Insights from: https://www.formula1.com/en/latest/features/2016/11/f1-2016-title-permutations-abu-dhabi-gp.html
// Standings before Abu Dhabi 2016: Rosberg 367 pts, Hamilton 355 pts (Rosberg leads by 12 pts)
// Final race of the season; whoever finishes ahead wins the title
//
// Nico Rosberg (clinches with any of):
//   - Finishes P3 or better → champion regardless of Hamilton
//   - Finishes P6 or higher while Hamilton doesn't win
//   - Finishes P8 or higher while Hamilton finishes P4 or lower
//
// Lewis Hamilton (needs all of):
//   - Wins the race AND Rosberg finishes P4 or lower
//
// Constructors' championship:
//   - Mercedes, Red Bull, Ferrari have already locked in P1, P2, P3 respectively
//   - Only P4 (Force India vs Williams) and P6 (McLaren vs Toro Rosso) remain open
test('Abu Dhabi 2016 blog: Rosberg vs Hamilton title decider', () => {
  const data = readCalculationResults(2016)!;
  const abuDhabiIdx = data.races.findIndex((r) => r.round === 21 && r.type === 'race');
  const texts = renderInsights(data.driverLockInsights[String(abuDhabiIdx)], data);
  const constructorTexts = renderInsights(data.constructorLockInsights[String(abuDhabiIdx)], data);

  // Rosberg can guarantee P1 (title) if not outscored by Hamilton by more than 11 points
  // (12-pt lead; tie on points → Rosberg wins on wins count; Hamilton needs 13+ to flip it)
  assert.ok(texts.includes('Nico Rosberg can guarantee at least P1 in Abu Dhabi GP if is not outscored by Lewis Hamilton by more than 11 points.'));

  // Rosberg P1 eliminated only if Hamilton outscores by 13+
  assert.ok(texts.includes('P1 is no longer possible for Nico Rosberg in Abu Dhabi GP if is outscored by Lewis Hamilton by 13 points.'));

  // Hamilton can guarantee P1 (title) only by outscoring Rosberg by 13+
  assert.ok(texts.includes('Lewis Hamilton can guarantee at least P1 in Abu Dhabi GP if outscores Nico Rosberg by 13 points.'));

  // Hamilton P1 eliminated if he doesn't outscore Rosberg by more than 11
  assert.ok(texts.includes('P1 is no longer possible for Lewis Hamilton in Abu Dhabi GP if Lewis Hamilton does not outscore Nico Rosberg by more than 11 points.'));

  // Ricciardo has already secured P3 in the drivers' standings
  assert.ok(texts.includes('Daniel Ricciardo has already locked in P3.'));

  // Constructors' top three are already decided
  assert.ok(constructorTexts.includes('Mercedes has already locked in P1.'));
  assert.ok(constructorTexts.includes('Red Bull has already locked in P2.'));
  assert.ok(constructorTexts.includes('Ferrari has already locked in P3.'));

  // TODO: The blog provides detailed finishing-position combinations for both drivers
  // ("Rosberg P3 or better → champion", "Hamilton wins + Rosberg P4 or lower → Hamilton wins").
  // Position-based clinch conditions are not yet generated by our system.
});

// Insights from: https://www.formula1.com/en/latest/article.the-title-permutations-what-hamilton-needs-to-do-to-be-crowned-f1-champion-in-austin.5uZgCVSRZSma080U4CUSEc.html
// Standings before United States 2018: Hamilton 331 pts, Vettel 264 pts (Hamilton leads by 67 pts)
// 4 races remain (Austin + 3 more); max 75 points available after Austin
//
// Lewis Hamilton:
//   - Blog: "outscore his Ferrari rival by eight points on Sunday and the 2018 drivers' crown is his"
//   - (67-pt lead + 9-pt race margin > 75 remaining; system requires 9 for strict guarantee)
//
// Constructors' championship:
//   - Mercedes cannot clinch at Austin; earliest opportunity is after Brazilian GP
test('United States 2018 blog: Hamilton fifth championship clinch opportunity', () => {
  const data = readCalculationResults(2018)!;
  const usIdx = data.races.findIndex((r) => r.round === 18 && r.type === 'race');
  const texts = renderInsights(data.driverLockInsights[String(usIdx)], data);
  const constructorTexts = renderInsights(data.constructorLockInsights[String(usIdx)], data);

  // Hamilton can guarantee P1 (title) by outscoring Vettel by 9 points
  // Blog says "eight points" — system produces 9 (the strict ≥ threshold: 67 + 9 = 76 > 75)
  assert.ok(texts.includes('Lewis Hamilton can guarantee at least P1 in United States GP if outscores Sebastian Vettel by 9 points.'));

  // Vettel P1 eliminated if outscored by Hamilton by 9 points
  assert.ok(texts.includes('P1 is no longer possible for Sebastian Vettel in United States GP if is outscored by Lewis Hamilton by 9 points.'));

  // Mercedes cannot clinch constructors' at Austin; earliest is Brazilian GP
  assert.ok(constructorTexts.includes('Mercedes can first guarantee at least P1 after Brazilian GP.'));

  // TODO: The blog expresses the clinch in position-based terms (e.g., "Hamilton wins and Vettel
  // finishes 3rd or lower") and includes a permutation chart image. Position-based clinch
  // conditions are not yet generated.
});

// Insights from: https://www.formula1.com/en/latest/article/title-permutations-how-hamilton-and-mercedes-can-be-crowned-champions-in.5dcz3gODYWuuIia8cgC4uo
// Standings before Mexico 2018: Hamilton 346 pts, Vettel 276 pts (Hamilton leads by 70 pts)
// Constructors: Mercedes 563, Ferrari 497 (Mercedes leads by 66 pts); Red Bull already locked P3
// 3 races remain after Mexico; max 75 points available
//
// Lewis Hamilton:
//   - Clinches if Vettel doesn't outscore him by more than 19 points
//   - "All-or-nothing for Vettel" — must win and hope Hamilton hits misfortune
//
// Constructors' championship:
//   - Mercedes can clinch at Mexico by outscoring Ferrari by 20 points
//     (blog says 20 pts; system requires 21 for strict guarantee)
//   - Red Bull have already clinched P3 in the constructors' standings
test('Mexico 2018 blog: Hamilton clinches title, Mercedes win constructors\'', () => {
  const data = readCalculationResults(2018)!;
  const mexicoIdx = data.races.findIndex((r) => r.round === 19 && r.type === 'race');
  const texts = renderInsights(data.driverLockInsights[String(mexicoIdx)], data);
  const constructorTexts = renderInsights(data.constructorLockInsights[String(mexicoIdx)], data);

  // Hamilton clinches P1 (title) if Vettel doesn't outscore him by more than 19 points
  assert.ok(texts.includes('Lewis Hamilton can guarantee at least P1 in Mexican GP if is not outscored by Sebastian Vettel by more than 19 points.'));

  // Vettel P1 eliminated unless he outscores Hamilton by more than 19 points
  assert.ok(texts.includes('P1 is no longer possible for Sebastian Vettel in Mexican GP if Sebastian Vettel does not outscore Lewis Hamilton by more than 19 points.'));

  // Mercedes can clinch the constructors' title at Mexico
  // Blog says "outscore Ferrari by 20 points" — system requires 21 (strict ≥ threshold)
  assert.ok(constructorTexts.includes('Mercedes can guarantee at least P1 in Mexican GP if outscores Ferrari by 21 points.'));

  // Ferrari P1 eliminated if outscored by Mercedes by 21 points
  assert.ok(constructorTexts.includes('P1 is no longer possible for Ferrari in Mexican GP if is outscored by Mercedes by 21 points.'));

  // Red Bull has already locked in P3 in the constructors' standings
  assert.ok(constructorTexts.includes('Red Bull has already locked in P3.'));

  // TODO: The blog expresses Vettel's path as "must win – and hope that Hamilton hits some form
  // of misfortune." Position-based clinch/elimination conditions are not yet generated.
});

// Insights from: https://www.formula1.com/en/latest/article/what-does-verstappen-need-to-do-to-win-the-title-over-hamilton-in-saudi.24ex2L0wnanvf5ATHe0CCO
// Standings before Saudi Arabia 2021: Verstappen 351.5 pts, Hamilton 343.5 pts (Verstappen leads by 8 pts)
// Penultimate round; 1 race remains after Saudi (Abu Dhabi); max 26 pts available (race + fastest lap)
//
// Max Verstappen clinches at Saudi (position-based table from blog):
//   - 1st + fastest lap:  Hamilton 6th or lower
//   - 1st (no FL):        Hamilton 7th or lower
//   - 2nd + fastest lap:  Hamilton outside points (11th or lower)
//   - 2nd (no FL):        Hamilton does not score (DNF/DSQ)
//
// Lewis Hamilton:
//   - Cannot clinch at Saudi; earliest is Abu Dhabi
test('Saudi Arabia 2021 blog: Verstappen championship clinch opportunity', () => {
  const data = readCalculationResults(2021)!;
  const saudiIdx = data.races.findIndex((r) => r.round === 21 && r.type === 'race');
  const texts = renderInsights(data.driverLockInsights[String(saudiIdx)], data);

  // Verstappen can guarantee P1 (title) by outscoring Hamilton by 19 points
  // Blog's top scenario: Verstappen wins (25) + Hamilton 7th or lower (≤6 pts) = 19+ margin
  assert.ok(texts.includes('Max Verstappen can guarantee at least P1 in Saudi Arabian GP if outscores Lewis Hamilton by 19 points.'));

  // Hamilton P1 eliminated if outscored by Verstappen by 19 points
  assert.ok(texts.includes('P1 is no longer possible for Lewis Hamilton in Saudi Arabian GP if is outscored by Max Verstappen by 19 points.'));

  // Hamilton cannot clinch at Saudi; earliest opportunity is Abu Dhabi
  assert.ok(texts.includes('Lewis Hamilton can first guarantee at least P1 after Abu Dhabi GP.'));

  // TODO: The blog provides a full position-by-position table with fastest-lap variants
  // (e.g., "1st + FL → Hamilton 6th or lower", "2nd + FL → Hamilton outside points").
  // Position-based and fastest-lap clinch conditions are not yet generated.
});

// Insights from: https://www.formula1.com/en/latest/article/what-to-watch-for-in-the-abu-dhabi-gp-the-championship-decider-nervous.1DFTdUW3mbcjM8ManPkbYJ
// Standings before Abu Dhabi 2021: Verstappen 369.5 pts, Hamilton 369.5 pts (level on points!)
// Both entered the finale tied; Verstappen leads on wins count (9 to 8) — tiebreaker in his favour
// Final race of the season
//
// Championship rule: whoever finishes ahead wins, as long as both are in the top eight
//   - If both finish level on points: Verstappen wins (more wins)
//   - Tie scenarios: both DNF, both outside top 10, or Hamilton P9 + Verstappen P10 + Verstappen fastest lap
//
// Constructors' championship:
//   - Mercedes 587.5 pts, Red Bull 559.5 pts (Mercedes leads by 28 pts)
//   - Red Bull must outscore Mercedes by 28 pts to clinch; blog says 28, system requires 29
test('Abu Dhabi 2021 blog: Verstappen vs Hamilton title decider', () => {
  const data = readCalculationResults(2021)!;
  const abuDhabiIdx = data.races.findIndex((r) => r.round === 22 && r.type === 'race');
  const texts = renderInsights(data.driverLockInsights[String(abuDhabiIdx)], data);
  const constructorTexts = renderInsights(data.constructorLockInsights[String(abuDhabiIdx)], data);

  // Both drivers need only 1 point margin to lock in P1 (tied on points entering the race)
  assert.ok(texts.includes('Max Verstappen can guarantee at least P1 in Abu Dhabi GP if outscores Lewis Hamilton by 1 points.'));
  assert.ok(texts.includes('Lewis Hamilton can guarantee at least P1 in Abu Dhabi GP if outscores Max Verstappen by 1 points.'));

  // Each driver's P1 is eliminated if outscored by the other by 1 point
  assert.ok(texts.includes('P1 is no longer possible for Max Verstappen in Abu Dhabi GP if is outscored by Lewis Hamilton by 1 points.'));
  assert.ok(texts.includes('P1 is no longer possible for Lewis Hamilton in Abu Dhabi GP if is outscored by Max Verstappen by 1 points.'));

  // Bottas and Pérez have already locked in P3 and P4 respectively
  assert.ok(texts.includes('Valtteri Bottas has already locked in P3.'));
  assert.ok(texts.includes('Sergio Pérez has already locked in P4.'));

  // Red Bull constructors: need to outscore Mercedes by 29 to win (blog says 28)
  assert.ok(constructorTexts.includes('Red Bull can guarantee at least P1 in Abu Dhabi GP if outscores Mercedes by 29 points.'));

  // Mercedes constructors: guaranteed P1 if not outscored by Red Bull by more than 27
  assert.ok(constructorTexts.includes('Mercedes can guarantee at least P1 in Abu Dhabi GP if is not outscored by Red Bull by more than 27 points.'));

  // TODO: The blog describes the tiebreaker rule ("tied on points → Verstappen wins via wins count")
  // and edge-case tie scenarios (both DNF, or Hamilton 9th + Verstappen 10th + FL). Tiebreaker
  // logic and fastest-lap tie scenarios are not yet expressed as distinct insights.
});

// Insights from: https://www.formula1.com/en/latest/article/points-permutations-how-red-bull-can-seal-their-first-constructors-title.642CzC8rC2a20cSbbxswyv
// Standings before United States 2022: Verstappen 366 pts (already champion), Leclerc 252 pts, Pérez 253 pts
// Constructors: Red Bull 619, Ferrari 454 (Red Bull leads by 165 pts); 191 pts remain across 4 rounds
//
// Red Bull clinch constructors' at Austin:
//   - "Need to hold an advantage of 147 points at end of Austin weekend"
//   - Win (no fastest lap): Ferrari 1-2 (no FL) is not enough to prevent clinch
//   - Clinch if Ferrari fails to outscore Red Bull by 19 pts (blog figure; system requires 18 margin)
//
// Ferrari:
//   - Must outscore Red Bull by 19 pts to stay alive, requiring a 1-2 finish with fastest lap
test('United States 2022 blog: Red Bull clinch first constructors\' title since 2013', () => {
  const data = readCalculationResults(2022)!;
  const usIdx = data.races.findIndex((r) => r.round === 19 && r.type === 'race');
  const texts = renderInsights(data.driverLockInsights[String(usIdx)], data);
  const constructorTexts = renderInsights(data.constructorLockInsights[String(usIdx)], data);

  // Verstappen already locked in P1 (drivers' champion)
  assert.ok(texts.includes('Max Verstappen has already locked in P1.'));

  // Red Bull can guarantee constructors' P1 at Austin if not outscored by Ferrari by more than 17 pts
  assert.ok(constructorTexts.includes('Red Bull can guarantee at least P1 in United States GP if is not outscored by Ferrari by more than 17 points.'));

  // Ferrari P1 eliminated if they don't outscore Red Bull by more than 17 points
  assert.ok(constructorTexts.includes('P1 is no longer possible for Ferrari in United States GP if Ferrari does not outscore Red Bull by more than 17 points.'));

  // TODO: The blog provides the exact "147-point threshold" and specific race-result combinations
  // (e.g., "Red Bull 1-2 clinches", "Ferrari 1-2 + fastest lap required to stay alive").
  // Position-based clinch conditions and fastest-lap variants are not yet generated.
});

// Insights from: https://www.formula1.com/en/latest/article/what-do-mclaren-need-to-do-to-win-the-2024-constructors-championship-in.6wkARNJU3HGjZnq2vaLeAM
// Standings before Abu Dhabi 2024: Verstappen 429 pts (already champion), Norris 349 pts, Leclerc 341 pts
// Constructors: McLaren 640, Ferrari 619, Red Bull 581 (McLaren leads Ferrari by 21 pts)
// 44 points maximum available; McLaren needs 24 points (or 23 if Ferrari doesn't win) to clinch
//
// McLaren constructors:
//   - A race victory alone is enough to guarantee the title
//   - Must score 24 points to guarantee the title regardless of Ferrari
//
// Ferrari constructors:
//   - Must outscore McLaren by 22 points to win the title
//
// Constructors already decided:
//   - Red Bull can no longer win the title (eliminated after Qatar Sprint)
//   - Mercedes has already locked in P4
test('Abu Dhabi 2024 blog: McLaren win constructors\' championship', () => {
  const data = readCalculationResults(2024)!;
  const abuDhabiIdx = data.races.findIndex((r) => r.round === 24 && r.type === 'race');
  const driverTexts = renderInsights(data.driverLockInsights[String(abuDhabiIdx)], data);
  const constructorTexts = renderInsights(data.constructorLockInsights[String(abuDhabiIdx)], data);

  // Verstappen has already locked in P1 (drivers' champion)
  assert.ok(driverTexts.includes('Max Verstappen has already locked in P1.'));

  // McLaren can guarantee constructors' P1 if not outscored by Ferrari by more than 20 pts
  assert.ok(constructorTexts.includes('McLaren can guarantee at least P1 in Abu Dhabi GP if is not outscored by Ferrari by more than 20 points.'));

  // Ferrari can guarantee constructors' P1 only by outscoring McLaren by 22 pts
  assert.ok(constructorTexts.includes('Ferrari can guarantee at least P1 in Abu Dhabi GP if outscores McLaren by 22 points and is not outscored by Red Bull by more than 37 points.'));

  // McLaren P1 eliminated if outscored by Ferrari by 22 pts
  assert.ok(constructorTexts.includes('P1 is no longer possible for McLaren in Abu Dhabi GP if is outscored by Ferrari by 22 points.'));

  // Ferrari P1 eliminated if they don't outscore McLaren by more than 20 pts
  assert.ok(constructorTexts.includes('P1 is no longer possible for Ferrari in Abu Dhabi GP if Ferrari does not outscore McLaren by more than 20 points.'));

  // Mercedes has already secured P4 in the constructors' standings
  assert.ok(constructorTexts.includes('Mercedes has already locked in P4.'));

  // TODO: The blog provides specific race-result combinations ("a win alone is enough for McLaren",
  // "McLaren needs 24 pts or 23 if Ferrari doesn't win"). Position-based clinch conditions and
  // scenario-based "if Ferrari scores zero" variants are not yet generated.
});

// Insights from: https://www.formula1.com/en/latest/article/points-permutations-how-can-mclaren-win-the-2025-constructors-championship.SXmo98z0aCzJ4L1oVdf2b
// Standings before Singapore 2025: McLaren 623 pts, Mercedes 290 pts (gap 333), Ferrari 286 pts (gap 337)
// Red Bull 272 pts — already mathematically eliminated from P1 after Azerbaijan GP
// 7 rounds remain with 346 points available
//
// McLaren constructors:
//   - Can clinch with just 13 points in Singapore (one car on the podium is enough)
//   - A 333-point lead means even worst-case outcomes can't cost them the title beyond Singapore
//
// Mercedes:
//   - Must outscore McLaren by 31 points at Singapore to prevent McLaren from clinching
//
// Ferrari:
//   - Must outscore McLaren by 35 points at Singapore to prevent McLaren from clinching
//
// Red Bull:
//   - Already eliminated from the constructors' title after the Azerbaijan Grand Prix
test('Singapore 2025 blog: McLaren win constructors\' championship', () => {
  const data = readCalculationResults(2025)!;
  const singaporeIdx = data.races.findIndex((r) => r.round === 18 && r.type === 'race');
  const constructorTexts = renderInsights(data.constructorLockInsights[String(singaporeIdx)], data);

  // McLaren can guarantee constructors' P1 at Singapore with conditions on both Mercedes and Ferrari
  assert.ok(constructorTexts.includes('McLaren can guarantee at least P1 in Singapore GP if is not outscored by Mercedes by more than 29 points, Ferrari by more than 33 points.'));

  // McLaren can guarantee P2 with only the Ferrari condition
  assert.ok(constructorTexts.includes('McLaren can guarantee at least P2 in Singapore GP if is not outscored by Ferrari by more than 33 points.'));

  // Mercedes P1 eliminated at Singapore unless they outscore McLaren by more than 29 pts
  assert.ok(constructorTexts.includes('P1 is no longer possible for Mercedes in Singapore GP if Mercedes does not outscore McLaren by more than 29 points.'));

  // Ferrari P1 eliminated at Singapore unless they outscore McLaren by more than 33 pts
  assert.ok(constructorTexts.includes('P1 is no longer possible for Ferrari in Singapore GP if Ferrari does not outscore McLaren by more than 33 points.'));

  // Red Bull already eliminated from P1 before Singapore — no P1 insight appears for them
  assert.ok(!constructorTexts.some((t) => t.startsWith('Red Bull can guarantee at least P1')));
  assert.ok(!constructorTexts.some((t) => t.startsWith('P1 is no longer possible for Red Bull in Singapore')));

  // TODO: The blog expresses McLaren's clinch as "just 13 points = one car on the podium".
  // Position-based clinch conditions ("finish P3 or better") are not yet generated.
});

// Insights from: https://www.formula1.com/en/latest/article/points-permutations-when-is-the-earliest-norris-could-claim-the-world.T4F6V6THiKksJ6GdcYfvo
// Standings before Las Vegas 2025: Norris 390 pts, Piastri 366 pts (gap 24), Verstappen 341 pts (gap 49)
// Maximum 83 points available across the three final weekends (Las Vegas, Qatar sprint+race, Abu Dhabi)
//
// Lando Norris:
//   - Cannot clinch at Las Vegas; earliest possible is Qatar Sprint (under best-case scenario)
//   - Wins tiebreaker: Norris 8 wins vs Verstappen 7 — relevant if they tie on total points
//
// Constructors' championship:
//   - McLaren have already clinched the constructors' title before Las Vegas
test('Las Vegas 2025 blog: earliest Norris championship clinch analysis', () => {
  const data = readCalculationResults(2025)!;
  const lasVegasIdx = data.races.findIndex((r) => r.round === 22 && r.type === 'race');
  const texts = renderInsights(data.driverLockInsights[String(lasVegasIdx)], data);
  const constructorTexts = renderInsights(data.constructorLockInsights[String(lasVegasIdx)], data);

  // Norris can guarantee P2 at Las Vegas by outscoring Verstappen by 10 points
  // (49-pt lead + 10 more = 59 > 58 remaining max → Verstappen can't catch Norris)
  assert.ok(texts.includes('Lando Norris can guarantee at least P2 in Las Vegas GP if outscores Max Verstappen by 10 points.'));

  // Norris cannot clinch P1 at Las Vegas; earliest is Abu Dhabi GP
  assert.ok(texts.includes('Lando Norris can first guarantee at least P1 after Abu Dhabi GP.'));

  // Piastri also cannot clinch at Las Vegas; earliest is Abu Dhabi GP
  assert.ok(texts.includes('Oscar Piastri can first guarantee at least P1 after Abu Dhabi GP.'));

  // Verstappen P1 eliminated at Las Vegas if outscored by Norris by 10 points
  assert.ok(texts.includes('P1 is no longer possible for Max Verstappen in Las Vegas GP if is outscored by Lando Norris by 10 points.'));

  // Verstappen also cannot clinch at Las Vegas; earliest is Abu Dhabi GP
  assert.ok(texts.includes('Max Verstappen can first guarantee at least P1 after Abu Dhabi GP.'));

  // McLaren have already locked in the constructors' title
  assert.ok(constructorTexts.includes('McLaren has already locked in P1.'));

  // TODO: The blog identifies the Qatar Sprint as the earliest clinch opportunity under the
  // best-case scenario ("Norris wins Las Vegas + rivals score zero → needs P7 in Sprint").
  // Our system does not distinguish Sprint from GP for earliest-clinch calculations — it
  // reports Abu Dhabi GP as the earliest regardless of sprint scenarios.
});

// Insights from: https://www.formula1.com/en/latest/article/championship-permutations-can-norris-still-win-the-title-in-qatar-after-his.6Yl07za0DPgfybgFrUXE6u
// Standings before Qatar GP 2025 (after Qatar Sprint): Norris 396 pts, Piastri 374 pts, Verstappen 371 pts
// 50 points remain across two races (Qatar GP + Abu Dhabi GP)
//
// Lando Norris:
//   - Wins Qatar → champion regardless of where Piastri and Verstappen finish
//   - Can also clinch without winning if rivals finish far enough behind
//
// Max Verstappen:
//   - "Must beat Norris in Sunday's race" to keep title fight alive into Abu Dhabi
//
// Oscar Piastri:
//   - "Must not be outscored by four or more points" to keep title hopes alive
test('Qatar 2025 blog: Norris can clinch championship at Qatar Grand Prix', () => {
  const data = readCalculationResults(2025)!;
  const qatarIdx = data.races.findIndex((r) => r.round === 23 && r.type === 'race');
  const texts = renderInsights(data.driverLockInsights[String(qatarIdx)], data);

  // Norris can guarantee P1 (title) by outscoring Piastri by 4 and Verstappen by 1
  // (Norris wins = 25 pts; need 25 > Piastri's score + 3 and 25 > Verstappen's score)
  assert.ok(texts.includes('Lando Norris can guarantee at least P1 in Qatar GP if outscores Oscar Piastri by 4 points, Max Verstappen by 1 points.'));

  // Norris can guarantee P2 with only the Verstappen condition
  assert.ok(texts.includes('Lando Norris can guarantee at least P2 in Qatar GP if outscores Max Verstappen by 1 points.'));

  // Piastri P1 eliminated if Norris outscores him by 4 points
  assert.ok(texts.includes('P1 is no longer possible for Oscar Piastri in Qatar GP if is outscored by Lando Norris by 4 points.'));

  // Verstappen P1 eliminated if Norris outscores him by 1 point (= Norris finishes ahead of Verstappen)
  assert.ok(texts.includes('P1 is no longer possible for Max Verstappen in Qatar GP if is outscored by Lando Norris by 1 points.'));

  // TODO: The blog says "if Norris wins, he's champion regardless." Our system expresses this
  // as points-margin conditions rather than position-based finishing scenarios.
  // The exact scenario where Verstappen must "beat Norris" to keep the title alive is implicit
  // in the points-margin insight but not expressed as a direct position comparison.
});
