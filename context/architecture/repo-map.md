# Repository Map — a11y-sdk

## Top-level layout

```
src/                  TypeScript source — the library
  index.ts            Library entry point (dist/index.{js,cjs} via tsup)
  detect-framework.ts Framework detection (package.json dependency sniffing)
  config-loader.ts    Loads/validates .a11y/config/a11y.config.json, exports defaults
  rule-filter.ts       Maps config rule categories → ESLint rule-ID prefixes
  pre-commit.ts        Layer 2 entry point: staged-file filtering + ESLint run + reporting
  audit.ts              Layer 3 entry point: Playwright + axe-core page audit + reporting

toolkit/              The distributable — this directory is what setup.sh's
                       consumers actually copy: `cp -r toolkit/ <project>/.a11y`
  context.md           Master AI-context document (WCAG 2.1 AA rules + component patterns)
  rules/                Six per-pattern deep-dive docs referenced from context.md
  config/
    a11y.config.json    Default developer-editable config, copied into .a11y/config/
    eslint/
      react.cjs          Per-framework ESLint flat configs (hand-written, not built)
      vue.cjs
      svelte.cjs
      angular.cjs
  scripts/
    detect-framework.cjs  Built output of src/detect-framework.ts
    pre-commit.cjs         Built output of src/pre-commit.ts
    audit.cjs               Built output of src/audit.ts
    config-loader.cjs      Built output of src/config-loader.ts
    setup.sh                 Hand-written bash — no TS/build equivalent exists
  hooks/
    pre-commit            Thin bash shim: execs node toolkit/scripts/pre-commit.cjs
  wrappers/
    CLAUDE.md, AGENTS.md, .cursorrules, copilot-instructions.md
                           Templates setup.sh copies to the consumer project root
                           when the corresponding file doesn't already exist there

samples/              Four minimal framework apps for manual/integration validation
  react-app/ vue-app/ svelte-app/ angular-app/
                       Each seeded with intentional WCAG violations, each its own
                       git repo (required for core.hooksPath to apply at the right
                       scope), each with .a11y symlinked to ../../toolkit
  init-samples.sh      One-time setup: git init + hook wiring per sample app

tests/                Vitest unit + integration tests (see prd.md Testing Strategy)
```

## The src/ → toolkit/scripts/ relationship (verified, not assumed)

This is the single most important structural fact about the repository, and it is the opposite of what a surface read of the directory names might suggest. **`toolkit/scripts/*.cjs` are real build outputs of `src/*.ts`, not hand-maintained duplicates.**

Evidence, in order of directness:

1. **`tsup.config.ts` defines two build targets in the same config array.** The first (`entry: ["src/index.ts"]`) builds the library to `dist/`. The second builds four named entries — `detect-framework`, `pre-commit`, `audit`, `config-loader` — from their `src/*.ts` counterparts, with `format: ["cjs"]`, `outDir: "toolkit/scripts"`, and a `#!/usr/bin/env node` shebang banner. `eslint`, `playwright`, and `@axe-core/playwright` are marked `external` so they're never bundled — they stay peer-installed in the consumer project, which is exactly what the NFR in `prd.md` about no devDependency bleed depends on.
2. **`package.json` wires this as `"build:toolkit": "tsup --config tsup.config.ts"`** — a real script, not a manual step someone might skip.
3. **CI enforces it.** `.github/workflows/ci.yml` runs `pnpm build:toolkit` as its own step, followed immediately by a hard artifact-existence check: `test -f toolkit/scripts/pre-commit.cjs && test -f toolkit/scripts/audit.cjs && test -f toolkit/scripts/detect-framework.cjs`. If someone edited a `.cjs` file directly and it drifted from what the build would produce, CI would still pass today (the check only verifies the files *exist*, not that they match a fresh build) — but the build step itself would silently overwrite any hand-edit on the next `build:toolkit` run, which is a real (if narrow) foot-gun. See `refactoring-plan.md`.
4. **The built files are still committed to git** (`git ls-files toolkit/scripts/` lists all five including `setup.sh`), despite being build output. This is necessary, not accidental: because distribution is `cp -r toolkit/` with no install/build step on the consumer's side, the `.cjs` files *must* be checked in and current at all times, or a fresh copy-paste breaks immediately. This is an unusual but coherent pattern for a copy-paste-distributed tool — it inverts the normal "don't commit build output" convention on purpose.

**One file breaks this pattern and is correctly hand-maintained: `toolkit/scripts/setup.sh`.** There is no `src/setup.ts` — it is bash, has no TypeScript equivalent, and is authored directly in place. This is fine as-is; bash has no reason to round-trip through tsup.

**One directory sits outside the build pipeline entirely and is intentionally hand-written: `toolkit/config/eslint/*.cjs`.** These four flat-config files are authored directly, not generated from `src/`. Each requires and re-exports a third-party plugin's flat config (`eslint-plugin-jsx-a11y`, `eslint-plugin-vuejs-accessibility`, `eslint-plugin-svelte`, `@angular-eslint/eslint-plugin-template`), sometimes reshaping it (the Angular config manually rebuilds an eslintrc-style config object into flat-config shape, per its own inline comment). There is no `src/` counterpart for these because they're declarative config, not runtime logic with meaningful test surface beyond "does ESLint load it and run" — which is exactly what `tests/pre-commit-integration.test.ts` exercises end-to-end.

## What "the toolkit" actually is, precisely

`toolkit/` is not a bundle produced by a single command — it's a directory containing a mix of (a) tsup-built executables, (b) hand-written bash, (c) hand-written declarative ESLint configs, and (d) static markdown/JSON content (`context.md`, `rules/*.md`, `config/a11y.config.json`, `wrappers/*`) that has no build step because it isn't code. `pnpm build:toolkit` only touches category (a). A contributor editing `context.md` or a `wrappers/` template needs no build step at all — the file is used as-is. A contributor editing one of the four ESLint configs also needs no build step — same reasoning. Only a change to one of the four `src/*.ts` files feeding `toolkit/scripts/` requires running `build:toolkit` before the change is live in a fresh copy-paste.

## samples/ vs toolkit/ — a second, smaller distinction worth naming

The four sample apps are not shipped to consumers and are not part of `.a11y/` — they exist purely for this repository's own validation (manual pre-commit-hook smoke testing per framework, referenced from the README's "Validating the SDK locally" section, and as the subject of `samples/init-samples.sh`). Each has its own git history (`samples/*/.git`), which is why `init-samples.sh` exists — `core.hooksPath` must be set at each sample's own repo root, not at the monorepo root, for the pre-commit hook under test to fire in the expected scope.

## Files referenced by relative path across layer boundaries (fragility notes)

- `src/pre-commit.ts`'s `getEslintConfigPath()` resolves `../config/eslint/<file>.cjs` relative to `__dirname`, which at runtime is `toolkit/scripts/` (the compiled location), not `src/`. This is correct today but means the relative path contract between `toolkit/scripts/` and `toolkit/config/eslint/` is implicit — nothing enforces that `toolkit/config/eslint/` stays a sibling of `toolkit/scripts/` if the directory layout ever changes.
- `toolkit/hooks/pre-commit` hardcodes `../scripts/pre-commit.cjs` relative to its own location — same category of implicit-but-currently-correct coupling.
