# F1 permutations

A Next.js app for exploring Formula 1 championship permutations using precomputed race data.

## Local development

```bash
pnpm install
pnpm dev
```

## Verify

```bash
pnpm verify
```

## Deploy to GitHub Pages

This repository includes a GitHub Actions workflow at `.github/workflows/deploy.yml`.

1. Push to `main` (or run the workflow manually).
2. In repository settings, set **Pages** source to **GitHub Actions**.
3. The workflow builds a static export (`next build` with `output: "export"`) and deploys the `out/` directory.

The workflow automatically sets `BASE_PATH`:
- empty for `<user>.github.io` repositories
- `/<repo-name>` for project pages repositories
