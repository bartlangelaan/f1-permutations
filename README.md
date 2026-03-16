# F1 Permutations

**Who can still win? Who's already out? What needs to happen next?**

[f1-permutations.pages.dev](https://f1-permutations.pages.dev)

---

F1 Permutations answers the questions that the official championship standings don't — not just _who leads_, but _who can still mathematically finish where_, and _what it would take_.

Every season, F1 publishes "championship permutations" articles when a title is about to be decided — but only for P1. This project goes much further.

## What you get

**Every position, not just P1.** See which drivers and constructors can still mathematically reach P1, P2, P3, and beyond — and who has already been eliminated from each.

**Lock-ins and eliminations.** Know when a driver has _guaranteed_ a position (e.g. "Verstappen has locked in at least P2") and when a position becomes impossible (e.g. "P1 is no longer reachable for Norris").

**Next-race scenarios.** The most actionable insights focus on the upcoming race: _"Hamilton can clinch P1 if he outscores Leclerc by 8 points"_ or _"P3 is no longer possible for Piastri if he is outscored by Russell by 12 points"_. Practical finish-position thresholds are included where applicable.

**Time-travel through any season.** Drag the race slider to see what was mathematically possible at any point during a season — revisit the moment a championship fight was truly over, or discover when an unlikely contender still had a shot.

**Points progression chart.** An interactive chart shows cumulative points over the season with projection cones illustrating each driver's remaining range of possible outcomes.

**Drivers and Constructors.** Toggle between both championships with a single click.

**Seasons back to 2010.** All modern F1 points systems are covered — including sprint races, fastest-lap bonuses, and rule changes across eras.

## How it works

The app precomputes every mathematical permutation for every race in a season. For each driver and constructor at each point in time, it determines:

- The **minimum and maximum** points still achievable
- The **best and worst** championship positions still possible
- Whether any position can be **locked in or ruled out** at the next race, and under what conditions

These calculations account for the full F1 points structure: race results, sprint races, fastest-lap bonuses (where applicable), and constructor scoring rules.

Results are frozen per race — the snapshot after Round 5 of 2023 will always show exactly what was mathematically possible at that moment, making the system verifiable against historical outcomes.

## At a glance

|                   |                                                                          |
| ----------------- | ------------------------------------------------------------------------ |
| **Seasons**       | 2010 – present                                                           |
| **Championships** | Drivers and Constructors                                                 |
| **Updated**       | After every race and sprint                                              |
| **Insight types** | Lock-ins, eliminations, next-race scenarios, earliest-possible timelines |
| **Shareable**     | URL state — link directly to a specific season, race, and view           |
