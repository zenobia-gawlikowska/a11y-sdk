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
| **2 — Pre-commit hook** | Every commit | ESLint a11y plugin catches violations in staged files |
| **3 — Audit** | On request | axe-core scans a running page and reports violations by WCAG criterion |

## Installation

```bash
cp -r toolkit/ <your-project>/.a11y
cd <your-project>
bash .a11y/scripts/setup.sh
```

`setup.sh` does four things:
1. Wires the git pre-commit hook (`git config core.hooksPath .a11y/hooks`)
2. Detects your framework (React, Vue, Svelte, Angular) and installs the right ESLint a11y plugin
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
2. Filters to framework-relevant extensions (`.jsx`/`.tsx` for React, `.vue`, `.svelte`, `.html`)
3. Runs ESLint with the framework-specific a11y flat config
4. Outputs violations with filename, line, rule ID, and WCAG criterion
5. Exits non-zero on violations (blocks the commit)

If your framework isn't detected automatically, the hook prompts once and saves your choice to `.a11y/config/a11y.config.json`.

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
node .a11y/scripts/audit.cjs <url>
node .a11y/scripts/audit.cjs <url> --level AAA
```

Results are grouped by WCAG criterion, ordered by impact (`critical → serious → moderate → minor`), and written to `.a11y/audit-results.json`.

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
  pre-commit.ts             # Layer 2 — pre-commit hook runner
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
