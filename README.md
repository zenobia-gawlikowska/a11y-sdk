# a11y-sdk

Accessibility toolkit for AI-assisted development workflows. Drops into any web project as a `.a11y/` folder and adds three layers of a11y enforcement — no package manager required.

## The problem

Accessibility is consistently skipped in AI-assisted development — not from malice but because no a11y integration layer exists for that workflow. Existing tools (axe, Lighthouse, eslint-plugin-jsx-a11y) were built for humans to consult at deliberate moments. They sit outside the AI-assisted loop where code is actually written.

This toolkit puts a11y enforcement where code is written: in the AI's context, at commit time, and on demand.

## How it works

Three layers, each independent:

| Layer | When it runs | What it does |
|---|---|---|
| **1 — AI context** | Every prompt | AI reads WCAG rules + component patterns before generating code |
| **2 — Pre-commit hook** | Every commit | ESLint a11y plugin + built-in contract checks catch violations in staged files |
| **3 — Audit** | On request | axe-core scans a running page; behavioral recipes drive keyboard/focus/reflow checks axe can't |

## Installation

```bash
cp -r toolkit/ <your-project>/.a11y
cd <your-project>
bash .a11y/scripts/setup.sh
```

`setup.sh` does four things:
1. Wires the git pre-commit hook (`git config core.hooksPath .a11y/hooks`)
2. Detects your framework (React, Vue, Svelte, Angular) and installs the right ESLint a11y plugin — plus ESLint itself if your package manager didn't pull it in as a peer dependency (yarn classic never does)
3. Patches your `CLAUDE.md` / `.cursorrules` / `AGENTS.md` to point your AI at the a11y rules
4. Reports what it did

**Requires:** git ≥ 2.9, Node ≥ 18.

## Layer 1 — AI context injection

After `setup.sh` runs, your AI coding assistant automatically reads `.a11y/context.md` on every session. It covers:

- WCAG 2.1 AA minimum rules (alt text, labels, keyboard, focus, contrast, headings, landmarks, live regions)
- Component-aware patterns for modal/dialog, form, data table, navigation, toast/alert — correct ARIA roles, focus management contracts, keyboard shortcuts
- Six deep-dive rule docs in `.a11y/rules/` for patterns static checkers can't reach (focus traps, ARIA state transitions, live region timing)

No extra prompting needed — the AI applies a11y patterns by default.

## Layer 2 — Pre-commit hook

The hook runs automatically on every `git commit`. It:

1. Gets staged files
2. Runs the built-in source contract checks on markup (`.jsx`/`.tsx`, `.vue`, `.svelte`, `.html`) and stylesheet (`.css`/`.scss`/`.sass`/`.less`) files
3. Filters to framework-relevant extensions and runs ESLint with the framework-specific a11y flat config
4. Outputs violations with filename, line, rule ID, and WCAG criterion
5. Exits non-zero on violations (blocks the commit)

If your framework isn't detected automatically, the hook prompts once and saves your choice to `.a11y/config/a11y.config.json`. When there's no terminal to prompt on (IDE/GUI commits, CI), it skips only the ESLint layer with an explicit warning instead — the contract checks always run — and you can set `"framework"` in `.a11y/config/a11y.config.json` to enable ESLint there too.

### Source contract checks

Four static checks run alongside ESLint. Each is the commit-time twin of a Layer 3 behavioral recipe — it catches the same contract earlier, on staged source, without needing a running page:

| Rule | Contract | WCAG | Runtime twin |
|---|---|---|---|
| `a11y-sdk/dialog-contract` | `role="dialog"` must declare `aria-modal` and an accessible name (`aria-labelledby`/`aria-label`) | 4.1.2 | `behave:dialog` |
| `a11y-sdk/expanded-controls` | `aria-expanded` must be paired with `aria-controls` | 4.1.2 | `behave:disclosure` |
| `a11y-sdk/no-px-font-size` | no `px` font sizes in component styles or stylesheets (`font-size: 0` exempt) | 1.4.4 | `behave:zoom-200` |
| `a11y-sdk/autocomplete-required` | inputs collecting personal data (by `type` or static `name`/`id`) must declare `autocomplete`; the message suggests the concrete token | 1.3.5 | `behave:autocomplete` |

The checks are text-based and deliberately under-flagging: dynamically bound attribute values are skipped, and plain `.ts` files are excluded so DOM code like `setAttribute("aria-expanded", …)` can't false-positive. Stylesheets are checked even though ESLint never sees them — a commit touching only CSS still gets the font-size check, and ESLint (with its install requirement) only kicks in when framework files are staged. The dialog and `aria-expanded` checks honor the `aria-roles` config category, the autocomplete check honors `form-labeling`.

**Configuration** — `.a11y/config/a11y.config.json`:
```json
{
  "wcagLevel": "AA",
  "rules": {
    "focus-management": true,
    "aria-roles": true,
    "keyboard-navigation": true,
    "color-contrast": true,
    "form-labeling": true,
    "landmark-structure": true,
    "live-regions": true,
    "images": true
  }
}
```

Set any category to `false` to disable it. To skip the hook for a single commit: `git commit --no-verify`.

## Layer 3 — Audit

Ask your AI: *"audit the dashboard at localhost:3000/dashboard"* — it will run:

```bash
node .a11y/scripts/audit.cjs <url>                  # axe-core static scan
node .a11y/scripts/audit.cjs <url> --level AAA
node .a11y/scripts/behave.cjs <url>                 # behavioral recipes
```

`audit.cjs` runs the axe-core scan; results are grouped by WCAG criterion, ordered by impact (`critical → serious → moderate → minor`), and written to `.a11y/audit-results.json`. It scans against `wcag2a`/`wcag2aa`/`wcag21a`/`wcag21aa`/`wcag22aa` (all AA-and-below rules across WCAG 2.0/2.1/2.2), plus `wcag2aaa` when `--level AAA` is passed. On top of that tag set, it force-enables two curated groups of axe-core rules that the tag filter alone would otherwise skip: rules tagged only `best-practice` (no `wcag2a`/`wcag2aa`/`wcag2aaa` tag) — `region` (all page content must sit inside a landmark), `landmark-one-main`, `landmark-unique`, the `landmark-*-is-top-level` and `landmark-no-duplicate-*` family, `heading-order`, `page-has-heading-one`, and `empty-heading` (see `BEST_PRACTICE_RULES` in `src/audit.ts`) — and WCAG 2.1/2.2-tagged rules that axe-core silently drops once any custom `.options({ rules })` map is in play — `target-size`, `css-orientation-lock`, and `label-content-name-mismatch` (see `WCAG_21_22_RULES` in `src/audit.ts`).

`behave.cjs` runs deterministic *behavioral* recipes that axe can't check — it drives a real page with Playwright and observes what happens. Three recipes are organized around assistive-technology personas rather than a single component: `tab-order` audits the page the way a keyboard-only user would, and `regions-headings` / `nav-current` / `form-navigation` audit it the way a screen reader user's rotor and forms modes would.

| Recipe | WCAG | What it checks |
|---|---|---|
| `reflow-320` | 1.4.10 | No horizontal scroll at a 320px viewport |
| `zoom-200` | 1.4.4 | No horizontal scroll at 200%-zoom-equivalent width; text responds to root font-size scaling |
| `text-spacing` | 1.4.12 | No clipped/overflowing content after injecting WCAG-minimum text spacing (1.5 line-height, 0.12em letter-spacing, 0.16em word-spacing, 2em paragraph spacing); pre-existing clipping is excluded |
| `target-size` | 2.5.8 | Interactive targets under 24×24px `fail` when another target's zone overlaps theirs, `warn` (exception candidate) when isolated |
| `skip-link` | 2.4.1 | First Tab stop is a working skip link when a nav landmark exists |
| `focus-visible` | 2.4.7 | Every Tab stop has a visible focus indicator (computed style changes on focus) |
| `tab-order` | 2.1.1 / 2.4.3 | *(keyboard-user persona)* Every ARIA-interactive element is Tab-reachable (composite-widget roving-tabindex items excepted); no positive `tabindex`; Shift+Tab retraces the Tab sequence exactly |
| `dialog` | 2.1.2 / 4.1.2 | `aria-modal`, accessible name, focus trap, Escape-to-close, focus restore on close |
| `disclosure` | 4.1.2 | `aria-expanded` toggles actually toggle on activation; `aria-controls` resolves |
| `menu-keyboard` | 2.1.1 | `role="menu"` implements the arrow-key contract it promises |
| `nav-labels` | 1.3.1 | Multiple `<nav>` landmarks have unique accessible names |
| `nav-current` | 4.1.2 / 2.4.8 (AAA) | *(screen-reader persona)* Any nav link resolving to the current page's URL carries `aria-current="page"`, and only one link per nav claims it |
| `regions-headings` | 1.3.1 / 2.4.6 | *(screen-reader persona)* Exactly one `<main>`; uniquely-labelled banner/contentinfo/complementary landmarks; a single `<h1>` with no skipped or empty heading levels |
| `visual-headings` | 1.3.1 / 2.4.6 | Visually prominent text (large/bold relative to body text) not marked up as a heading — `warn`-only, never `fail`; surfaces candidates for a human/LLM read, not a verdict |
| `table` | 1.3.1 | Caption/name, `<th>` scope, `aria-sort` actually toggles |
| `autocomplete` | 1.3.5 | Personal-data inputs carry `autocomplete` |
| `form-navigation` | 1.3.1 / 3.3.1 / 3.3.2 | *(screen-reader persona)* Every visible control resolves to an accessible name; same-name radio groups sit inside a labelled `<fieldset><legend>`; `aria-invalid="true"` fields carry a real `aria-describedby` |
| `unique-labels` | 2.4.4 / 2.4.6 / 4.1.2 | Links sharing text must share a destination (`fail`); distinct form fields must not share an accessible name (`fail`); repeated button names are flagged (`warn` — common in card-grid UIs, lower severity) |
| `live-region-static` | 4.1.3 | No live region nested inside another; no static alert text present at load |

Run all of them, or a subset with `--recipes`:
```bash
node .a11y/scripts/behave.cjs <url> --recipes dialog,focus-visible
node .a11y/scripts/behave.cjs <url> --recipes tab-order,regions-headings,form-navigation
```

Results go to `.a11y/behave-results.json`. If a modal needs a specific control to open it, pass `--dialog-trigger "<css selector>"`.

The enforcement split — which rule is owned by which deterministic layer, and what remains genuine judgment — is captured in `.a11y/rules/registry.json` and summarized in `context.md`'s Enforcement Map, so AI assistants orchestrate the scripts instead of re-deriving script-owned rules by reasoning.

**Requires Playwright** (installed in your project, not bundled):
```bash
npm install --save-dev playwright @axe-core/playwright
npx playwright install chromium
```

If Playwright isn't installed, the script prints the exact commands and exits with code `3`.

## Supported frameworks

| Framework | ESLint plugin | Min version |
|---|---|---|
| React | `eslint-plugin-jsx-a11y` | ≥ 6.9.0 |
| Vue | `eslint-plugin-vuejs-accessibility` + `eslint-plugin-vue` | ≥ 2.5.0 |
| Svelte | `eslint-plugin-svelte` + `svelte` | ≥ 3.0.0 |
| Angular | `@angular-eslint/eslint-plugin-template` | ≥ 19.0.0 |

**ESLint version:** ESLint 9 is required. ESLint 10 breaks `@angular-eslint/template-parser`'s scope manager and is not yet supported.

## Repository structure

```
src/                        # TypeScript source
  audit.ts                  # Layer 3 — axe-core audit runner
  behave.ts                 # Layer 3 — behavioral audit recipes
  pre-commit.ts             # Layer 2 — pre-commit hook runner
  contract-checks.ts        # Layer 2 — static source contract checks
  detect-framework.ts       # Framework detection
  config-loader.ts          # Config loader
toolkit/                    # Distributable — copy this as .a11y/
  context.md                # Master a11y knowledge document
  rules/                    # Per-pattern deep-dive docs
  scripts/                  # Built CJS executables
  hooks/pre-commit          # Git hook shim
  config/a11y.config.json   # Default config
  wrappers/                 # AI tool wrapper files
samples/                    # Minimal sample apps for SDK validation
  react-app/                # Vite + React 18 (JSX)
  vue-app/                  # Vite + Vue 3 (SFC)
  angular-app/              # Angular 18 component template
  svelte-app/               # Vite + Svelte 5 (SFC)
  init-samples.sh           # One-time setup: git init + hook wiring per app
tests/                      # Vitest unit tests
```

## Validating the SDK locally

The `samples/` directory contains four minimal apps pre-loaded with intentional
WCAG 2.1 AA violations. Each has `.a11y` symlinked to `../../toolkit` so the
toolkit is available without a separate install.

Each sample must be its own git repo for `core.hooksPath` to apply at the right
scope. Run once after cloning:

```bash
bash samples/init-samples.sh
```

Then trigger the pre-commit hook:

```bash
cd samples/react-app
git add src/App.jsx
git commit -m "test"   # hook fires and lists violations with WCAG citations
```

Or run ESLint directly (no commit needed):

```bash
cd samples/react-app
../../node_modules/.bin/eslint src --config .a11y/config/eslint/react.cjs
```

See [`samples/README.md`](samples/README.md) for the full violation inventory and Layer 3 audit instructions.

## Development

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build:toolkit          # builds toolkit/scripts/*.cjs
pnpm build                  # builds dist/ (library)
```

## Standards coverage

WCAG 2.1 AA is the minimum floor. Every issue surfaced maps to a named success criterion. WCAG 2.1 AAA is available via `--level AAA` on the audit script.
