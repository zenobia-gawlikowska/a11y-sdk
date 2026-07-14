# Sample apps — a11y SDK validation

Four minimal framework apps, each pre-loaded with intentional a11y violations,
used to validate the SDK's three enforcement layers. Each app also has a
corrected "good" version of the same page, used to prove the SDK doesn't
false-positive on well-built markup.

## Structure

```
samples/
  react-app/      Vite + React 18 (JSX)   — index.html (bad) + good.html (good)
  vue-app/        Vite + Vue 3 (SFC)      — index.html (bad) + good.html (good)
  svelte-app/     Vite + Svelte 5 (SFC)   — index.html (bad) + good.html (good)
  angular-app/    Angular 18 (standalone) — / (bad) + /good (good), one SPA shell
```

Each app has `.a11y → ../../toolkit` as a symlink, so the toolkit is available without any install step.

> **Each sample must be its own git repo** for the pre-commit hook to work —
> `git config core.hooksPath` applies to the nearest `.git` directory, so without
> one the hook would attach to the parent `a11y-sdk` repo instead.

**Note on Angular:** React/Vue/Svelte are each two separate static HTML entry
points (Vite's multi-page build), so the bad and good pages can differ on
everything, including `<html lang>`. Angular is a single-page app with one
shared `index.html` shell and two routes (`BadComponent` at `/`,
`GoodComponent` at `/good`) — `<html lang="en">` is set correctly in that
shared shell (as it would be in any real app) and therefore isn't part of
violation #1's bad-vs-good comparison for Angular specifically; see the
comment in `angular-app/src/app/bad.component.html`.

## First-time setup

Run once after cloning:

```bash
bash samples/init-samples.sh                    # init all four
bash samples/init-samples.sh react              # or just one framework
bash samples/init-samples.sh react vue svelte   # or a selection
```

This does three things per sample: `git init`, an initial commit of the scaffold,
and wires the pre-commit hook via `git config core.hooksPath .a11y/hooks`.

## Intentional violations (bad page/route, per app)

| # | Violation | WCAG | Layer caught by |
|---|-----------|------|-----------------|
| 1 | `<html>` has no `lang` attribute | 3.1.1 | Layer 3 (axe audit). N/A for Angular — see note above |
| 2 | `<img>` missing `alt` | 1.1.1 | Layer 2 (ESLint) + Layer 3 (axe) |
| 3 | Icon-only `<button>` with no `aria-label` | 4.1.2 | Layer 2 + Layer 3 (axe) |
| 4 | `<input>` with no associated `<label>` | 1.3.1 | Layer 2 + Layer 3 (axe) + Layer 3 (`behave:form-navigation`) |
| 5 | `<div onClick>` — no `role`, no keyboard handler | 2.1.1 | Layer 2 + Layer 3 (axe) |
| 6 | Link with generic text ("click here" / "read more") | 2.4.6 | Layer 2 |
| 7 | Heading hierarchy skips levels (h1 → h3/h4), no `<main>` | 1.3.1 | Layer 3 (axe) + Layer 3 (`behave:regions-headings`) |
| 8 | `<nav>` link to the current page missing `aria-current="page"` | 4.1.2 / 2.4.8 (AAA) | Layer 3 (`behave:nav-current`) |
| 9 | `role="button"` element with no `tabindex` — not Tab-reachable | 2.1.1 / 2.4.3 | Layer 2 (partial) + Layer 3 (`behave:tab-order`) |
| 10 | Large/bold `<div>` styled to look like a heading | 1.3.1 / 2.4.6 | Layer 3 (`behave:visual-headings`, warn-only) |
| 11 | Radio group with no `<fieldset>`/`<legend>` | 1.3.1 | Layer 3 (`behave:form-navigation`) |
| 12 | `aria-invalid="true"` with no `aria-describedby` | 3.3.1 | Layer 3 (`behave:form-navigation`) |
| 13 | `<table>` without `<caption>` / `scope` on `<th>` | 1.3.1 | Layer 3 (`behave:table`, Angular only) |

Violations #8–#12 were added alongside the `tab-order`, `nav-current`,
`regions-headings`, `visual-headings`, and `form-navigation` behave recipes —
see the root `README.md`'s recipe table for what each one checks. Every one
of these is fixed on the corresponding good page/route; run `behave.cjs`
against both (see the Layer 3 quickstart below) to see the fail → pass
contrast directly.

**Note on Svelte:** Svelte's a11y rules are built into the compiler itself, not a
separate ESLint plugin. They are surfaced via the `svelte/valid-compile` rule which
runs the compiler and promotes its diagnostics to ESLint errors.

## ESLint results per framework

| Framework | Violations caught by Layer 2 |
|-----------|------------------------------|
| React | `alt-text`, `click-events-have-key-events`, `no-static-element-interactions`, `interactive-supports-focus` |
| Vue | `alt-text`, `form-control-has-label`, `click-events-have-key-events`, `no-static-element-interactions`, `interactive-supports-focus`, `label-has-for` |
| Angular | `alt-text`, `click-events-have-key-events`, `interactive-supports-focus` |
| Svelte | `a11y_missing_attribute`, `a11y_click_events_have_key_events`, `a11y_no_static_element_interactions`, `a11y_interactive_supports_focus` |

The good pages/routes produce zero ESLint errors under the same config.

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

cd svelte-app
../../node_modules/.bin/eslint src --config .a11y/config/eslint/svelte.cjs
```

### Layer 3 — axe audit

Requires Playwright in the sample app:

```bash
cd react-app
npm install
npm install --save-dev playwright @axe-core/playwright
npx playwright install chromium
npm run dev &         # start dev server on localhost:5173
node .a11y/scripts/audit.cjs http://localhost:5173             # bad page — violations
node .a11y/scripts/audit.cjs http://localhost:5173/good.html   # good page — clean
```

For `angular-app` (needs `npm run start`, i.e. `ng serve`, default port 4200):

```bash
cd angular-app
npm install
npm install --save-dev playwright @axe-core/playwright
npx playwright install chromium
npm start &
node .a11y/scripts/audit.cjs http://localhost:4200        # bad route
node .a11y/scripts/audit.cjs http://localhost:4200/good   # good route
```

Results are written to `.a11y/audit-results.json`.

### Layer 3 — behave.cjs (behavioral recipes)

Same Playwright install as above. Run all recipes, or just the five added
alongside violations #8–#12:

```bash
cd react-app
npm run dev &
node .a11y/scripts/behave.cjs http://localhost:5173
node .a11y/scripts/behave.cjs http://localhost:5173/good.html
node .a11y/scripts/behave.cjs http://localhost:5173 \
  --recipes tab-order,nav-current,regions-headings,visual-headings,form-navigation
```

Every recipe in that `--recipes` list fails (or, for `visual-headings`, warns)
on the bad page/route and passes cleanly on the good one, across all four
frameworks. Results are written to `.a11y/behave-results.json`.

### Layer 1 — AI context

After `setup.sh` runs, `.a11y/context.md` is referenced in your AI tool wrapper (`CLAUDE.md` / `AGENTS.md`). No further action needed — the AI applies a11y rules on every session.
