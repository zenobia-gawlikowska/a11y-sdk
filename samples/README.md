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

```bash
cd react-app
npm install
npm run lint          # runs eslint via .a11y/config/eslint/react.mjs
```

Or run via the toolkit setup script to wire the git hook:

```bash
bash .a11y/scripts/setup.sh
git add src/App.jsx
git commit -m "test"  # hook fires and blocks on violations
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
