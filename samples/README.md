# Sample apps — a11y SDK validation

Three minimal framework apps, each pre-loaded with intentional a11y violations, used to validate the SDK's three enforcement layers.

## Structure

```
samples/
  react-app/      Vite + React 18 (JSX)
  vue-app/        Vite + Vue 3 (SFC)
  angular-app/    Angular 18 (component template)
```

Each app has `.a11y → ../../toolkit` as a symlink, so the toolkit is available without any install step.

> **Each sample must be its own git repo** for the pre-commit hook to work —
> `git config core.hooksPath` applies to the nearest `.git` directory, so without
> one the hook would attach to the parent `a11y-sdk` repo instead.

## First-time setup

Run once after cloning:

```bash
bash samples/init-samples.sh          # init all three
bash samples/init-samples.sh react    # or just one framework
```

This does three things per sample: `git init`, an initial commit of the scaffold,
and `bash .a11y/scripts/setup.sh` to wire the pre-commit hook.

## Intentional violations (per app)

| # | Violation | WCAG | Layer caught by |
|---|-----------|------|-----------------|
| 1 | `<html>` has no `lang` attribute | 3.1.1 | Layer 3 (axe audit) |
| 2 | `<img>` missing `alt` | 1.1.1 | Layer 2 (ESLint) + Layer 3 |
| 3 | Icon-only `<button>` with no `aria-label` | 4.1.2 | Layer 2 + Layer 3 |
| 4 | `<input>` with no associated `<label>` | 1.3.1 | Layer 2 + Layer 3 |
| 5 | `<div onClick>` — no `role`, no keyboard handler | 2.1.1 | Layer 2 + Layer 3 |
| 6 | Link with generic text ("click here") | 2.4.6 | Layer 2 |
| 7 | Heading hierarchy skips levels (h1 → h3/h4) | 1.3.1 | Layer 3 |
| 8 | `<table>` without `<caption>` / `scope` on `<th>` | 1.3.1 | Layer 3 (Angular only) |

## Quickstart per layer

### Layer 2 — ESLint pre-commit hook

After `init-samples.sh`, the hook is already wired. Touch a file and commit:

```bash
cd react-app
touch src/App.jsx          # or make any edit
git add src/App.jsx
git commit -m "test"       # hook fires and blocks on violations
```

To run ESLint directly without committing (uses the parent a11y-sdk's ESLint):

```bash
cd react-app
../../node_modules/.bin/eslint src --config .a11y/config/eslint/react.cjs
```

### Layer 3 — axe audit

Requires Playwright in the sample app:

```bash
cd react-app
npm install
npm install --save-dev playwright @axe-core/playwright
npx playwright install chromium
npm run dev &         # start dev server on localhost:5173
node .a11y/scripts/audit.cjs http://localhost:5173
```

Results are written to `.a11y/audit-results.json`.

### Layer 1 — AI context

After `setup.sh` runs, `.a11y/context.md` is referenced in your AI tool wrapper (`CLAUDE.md` / `AGENTS.md`). No further action needed — the AI applies a11y rules on every session.
