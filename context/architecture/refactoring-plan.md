# Refactoring Plan — a11y-sdk

Each item below was checked against the actual files before inclusion. Two candidates from the initial hypothesis list were checked and are *not* included, with the reasoning stated, rather than forced in to pad the list.

## 1. Version-pin drift between `package.json`, `setup.sh`, and the ESLint config comments (Angular)

**What's wrong.** This repository's own `package.json` devDependency pins `@angular-eslint/eslint-plugin-template` and `@angular-eslint/template-parser` at `^19.8.1`. `toolkit/scripts/setup.sh` — the script that actually runs in a *consumer's* project — installs `@angular-eslint/eslint-plugin-template@^18.0.0`, one major version behind, and does not even mention `@angular-eslint/template-parser` as a separate install target even though `toolkit/config/eslint/angular.cjs` `require()`s it directly. The inline comment atop `angular.cjs` repeats the stale `^18.0.0` figure a third time.

**Why it matters.** This repo's own CI tests against `^19.8.1` (that's what's in `node_modules` when `pnpm test` runs), but a real consumer running `setup.sh` gets `^18.0.0` and never gets `@angular-eslint/template-parser` installed as an explicit dependency at all — it would only end up present if some other Angular tooling already pulled it in transitively. This is exactly the kind of drift that stays invisible in CI (because CI never runs `setup.sh` against a real npm install the way a consumer would — the sample apps use a symlinked `.a11y`, not a fresh `cp -r` + `setup.sh` + npm install cycle) and only surfaces when an actual new user tries to adopt the Angular path.

**Concretely what to change.** Bump `setup.sh`'s Angular install line to match the version this repo actually tests against, add `@angular-eslint/template-parser` as an explicit second install target (mirroring how Vue's `install_deps` call already installs two packages), and update the three comment lines in `angular.cjs` to match. Ideally, extract these version strings into one place `setup.sh` and the `.cjs` comments both read from, so this can't drift silently again — though that's a larger change than fixing the immediate mismatch and could be deferred (see item 3, which proposes exactly this kind of shared source).

**Priority: High.** This is the one item on this list that is a live, shippable bug for real Angular adopters today, not a maintainability concern.

## 2. Three near-duplicate AI-tool stub files at the repo root, with a fourth copy already living as the canonical template

**What's wrong.** `CLAUDE.md`, `AGENTS.md`, and `.cursorrules` at the repository root are three separate 1–3 line files, each independently pointing an AI coding assistant at `.a11y/context.md`:

```
CLAUDE.md:       # a11y-sdk: accessibility rules loaded from .a11y/context.md
                 @.a11y/context.md
AGENTS.md:       # a11y-sdk
                 Accessibility context: see .a11y/context.md for WCAG rules and component patterns.
.cursorrules:    # a11y-sdk
                 Always read .a11y/context.md before generating any UI component.
```

These are word-for-word identical to `toolkit/wrappers/CLAUDE.md`, `toolkit/wrappers/AGENTS.md`, and `toolkit/wrappers/.cursorrules` respectively — confirmed by direct comparison. `toolkit/wrappers/` already exists specifically to be the canonical source `setup.sh` copies from into a *consumer's* project root. This repository's own root copies are a fourth, hand-synced instance of content that already has a designated single source of truth one directory away.

**Why it matters.** Nothing currently checks that the root copies stay identical to the `wrappers/` templates. If the wrapper templates change (say, to add a note about a new rule doc), the three root stub files silently go stale, and there is no test or CI step that would catch it — `tests/setup-integration.test.ts` verifies `setup.sh`'s *behavior* toward wrapper files in a fresh temp project, but nothing verifies this repository's own root files against its own `toolkit/wrappers/` templates.

**Concretely what to change.** Two options, in order of how much they change: (a) minimal — add a cheap CI or test check that diffs the three root files against their `toolkit/wrappers/` counterparts and fails on drift, which costs almost nothing and catches exactly the failure mode above; (b) more thorough — this repo could dogfood its own `setup.sh` (run it against itself, since the repo root already has `.a11y`-equivalent content) so the root files are generated rather than hand-authored, though this is circular enough (the tool managing its own onboarding files) that option (a) is the more honest fix for the actual risk.

**Priority: Medium.** Not a bug today — the three files are currently in sync — but it's the textbook shape of a "forgot to update all three" bug waiting to happen, and the fix is cheap.

## 3. The four `toolkit/config/eslint/*.cjs` files — checked for real shared structure, and mostly *not* a refactor target

**What was checked.** All four flat configs were read in full: `react.cjs`, `vue.cjs`, `svelte.cjs`, `angular.cjs`. Each does the same *shape* of thing — require a third-party plugin, apply its recommended flat config scoped to a `files` glob — but the actual content differs enough per-framework that forcing a shared base would add indirection without removing real duplication:

- `react.cjs` spreads `jsxA11y.flatConfigs.recommended` directly with a `files` override — three lines of real logic.
- `vue.cjs` maps over an *array* of configs (`pluginVueA11y.configs['flat/recommended']`), because Vue's recommended config is itself multiple config objects, not one — structurally different from React's.
- `svelte.cjs` does the same array-map as Vue, but then appends a second, hand-written config block enabling `svelte/valid-compile` as `'error'` — with a comment explaining *why* (Svelte's a11y rules are compiler warnings promoted to ESLint errors, not a standard plugin rule set). This extra block has no equivalent in the other three files.
- `angular.cjs` does something genuinely different from the other three: it manually reconstructs a flat-config object from an eslintrc-shaped `angular.configs.accessibility`, because (per its own comment) the upstream config isn't flat-config-native. This is the most divergent of the four.

**Verdict: not a real refactor target.** The four files share a *pattern* (require plugin, scope to files, export array) but not enough *content* to justify a shared base — Vue and Svelte's array-mapping could plausibly share three lines, but that's the only true overlap, and extracting it would trade three duplicated lines for a level of indirection (an imported helper, another file to open when debugging a config-loading issue) that costs more than it saves given there are only four of these and they change rarely. This candidate was raised as a hypothesis and is being explicitly ruled out rather than forced.

## 4. `getEslintConfigPath()`'s framework→file mapping duplicates the same four-way switch already expressed twice elsewhere

**What's wrong.** The React/Vue/Svelte/Angular framework enum gets re-expressed as a lookup/switch in at least three independent places with no shared source: `src/pre-commit.ts`'s `getExtensionsForFramework()` (framework → file extensions), the same file's `getEslintConfigPath()`'s `frameworkToFile` object (framework → config filename), and `toolkit/scripts/setup.sh`'s `case "${FRAMEWORK}" in …esac` (framework → install command). A fourth, softer instance is the `WCAG_MAP` in `pre-commit.ts` and `RULE_TO_WCAG` in `audit.ts`, which both encode framework-plugin-specific rule-ID knowledge independently (see `context/domain/ubiquitous-language.md` for the plugin mapping itself).

**Why it matters.** Adding a fifth framework (say, SolidJS) means touching four-plus independent switch statements across two languages (TypeScript and bash), with no compiler or test forcing all of them to be updated together. `tests/pre-commit-integration.test.ts` and `tests/detect-framework.test.ts` would catch a *missing* case (an unhandled framework falls through to a default), but wouldn't catch a case handled *inconsistently* across the different switches — e.g., if a new framework were added to `detect-framework.ts` but the corresponding `.cjs` config file were never created, `getEslintConfigPath()`'s `?? "react.cjs"` fallback would silently apply the *wrong* framework's rules rather than failing loudly.

**Concretely what to change.** This is real but lower priority than items 1–2: the four frameworks supported today are stable and this hasn't caused an actual bug (unlike item 1). If a fifth framework is ever seriously planned, the right fix is a single `FRAMEWORK_REGISTRY` table (framework → extensions, config filename, install command, plugin name) that the TypeScript switches and the bash case statement both read from — bash reading a shared JSON/data file is more friction than it sounds, so this is worth deferring until there's a concrete second-or-later framework on the roadmap, not speculatively building for one now.

**Priority: Low.** No current bug; a real but deferrable maintainability cost that only bites if/when a fifth framework is added.

## Candidates considered and explicitly not included

- **`src/*.ts` vs `toolkit/scripts/*.cjs` as a drift risk.** This was flagged as a hypothesis to check before writing this plan. Verified false: `toolkit/scripts/*.cjs` are real `tsup` build outputs (see `tsup.config.ts`'s second build target and the `build:toolkit` CI step), not hand-maintained duplicates. There is no drift risk here beyond the ordinary "did someone remember to run the build before committing" risk any committed-build-output pattern carries — see `context/architecture/repo-map.md` for the full verification.
