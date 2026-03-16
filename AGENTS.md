# F1 Permutations — Project Description

This project computes and surfaces mathematical championship permutations for Formula 1. The goal is to give fans and analysts clear insight into what is still mathematically possible — not just who can win the championship, but who can still finish in any given position, and who has already been eliminated from a position.

F1 officially publishes "championship permutations" articles when a title is about to be decided, but only for P1. This project aims to go further:

- **All positions, not just P1**: show which drivers/constructors can still mathematically reach P1, P2, P3, etc., and which have already been eliminated from each position.
- **Gaining and losing possibilities**: highlight both when a driver can no longer finish lower than a certain position (i.e. that position is mathematically guaranteed), and when they are eliminated from finishing that high.
- **Prioritised by relevance**: P1 championship outcomes are the most important insight and should stand out most prominently. Deeper position analysis (P2, P3, lower) is also available for the enthusiast.
- **Next-race focus**: the most important insights are about what can be decided or changed at the very next race. Lookahead across the next few races is also valuable context.
- **Drivers and constructors**: both championships are covered.
- **Default view is current season, latest results**: most users just want to see the permutations as they stand after the most recent race. However, it is also possible to view the state after any specific past race — useful for testing and for enthusiasts who want to see what was mathematically possible at an earlier point in the season. These historical snapshots are frozen: they do not change when new race results come in, which allows the system to be validated over time.

# Agent Instructions

- Always run `pnpm verify` after every step to confirm everything is working as expected.
- For `scripts/fetch-data.ts`, use cached fetched data as-is when it exists; do not transform cached `races.json` after loading it. If the fetch logic changes, refresh the stored data itself so the cache stays up to date, instead of adding compatibility or normalization logic on read.
