# Agent Instructions

- Always run `pnpm verify` after every step to confirm everything is working as expected.
- For `scripts/fetch-data.ts`, use cached fetched data as-is when it exists; do not transform cached `races.json` after loading it. If the fetch logic changes, refresh the stored data itself so the cache stays up to date, instead of adding compatibility or normalization logic on read.
