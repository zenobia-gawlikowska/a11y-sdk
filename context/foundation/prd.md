---
product_type: developer_tool
tech_preferences:
  language_family: typescript
status: draft
---

# PRD — a11y-sdk

## Vision

Accessibility is consistently skipped in AI-assisted development — not from malice but because no a11y integration layer exists for that workflow. Existing tools (axe, Lighthouse, eslint-plugin-jsx-a11y) were built for humans to consult at deliberate moments; they sit outside the loop where AI assistants (Claude, Cursor, Copilot) actually generate code. a11y-sdk closes that gap by dropping a `.a11y/` folder into any web project and putting accessibility enforcement in three places at once: in the AI's context (so it writes accessible code by default), at commit time (so violations that slip through are blocked before they land), and on demand (so a developer or their AI assistant can audit a live page and get violations grouped by WCAG criterion).

## Persona

A developer building a React, Vue, Svelte, or Angular project who works primarily through an AI coding assistant (Claude Code, Cursor, GitHub Copilot). They want accessibility handled by default rather than as a separate review pass — they do not want to manually check every AI-generated component against WCAG, and they do not want to bolt on a full accessibility QA process for a project that may not otherwise justify one. They are comfortable running a shell script and configuring a git hook, but they are not necessarily an accessibility specialist.

## Success Criteria

- An AI coding assistant operating in a project with `.a11y/` installed produces components that satisfy WCAG 2.1 AA defaults (alt text, labels, keyboard operability, focus management, landmarks, live regions) without the developer having to prompt for accessibility explicitly.
- A commit that introduces a static, ESLint-detectable a11y violation (missing alt text, unlabeled form control, etc.) in a staged file is blocked before it reaches the repository, with the violation's file, line, rule, and WCAG criterion reported.
- A developer (or their AI assistant, conversationally) can run an on-demand audit against a running page and receive violations grouped by WCAG criterion, ordered by impact (critical → serious → moderate → minor).
- The toolkit installs and activates across all four supported frameworks (React, Vue, Svelte, Angular) via a single `setup.sh` run, with framework auto-detected from `package.json` in the common case.
- Distribution stays copy-paste (`cp -r toolkit/ <project>/.a11y`) with no npm runtime dependency injected into the consuming project — the a11y tooling is peer-installed by `setup.sh`, not bundled.

## User Stories

**US-1 — AI gets WCAG context automatically**
Given a project with `.a11y/` installed and an AI coding assistant configured to read `CLAUDE.md` / `.cursorrules` / `AGENTS.md`,
When the developer asks the assistant to generate or modify a UI component,
Then the assistant has already loaded `.a11y/context.md` (WCAG 2.1 AA rules, component-aware ARIA/focus/keyboard patterns) via the stub file's reference, and applies those rules without the developer mentioning accessibility.

**US-2 — A commit with an a11y violation gets blocked**
Given the git pre-commit hook is wired (`core.hooksPath` = `.a11y/hooks`) and the developer's framework is detected or configured,
When the developer runs `git commit` with a staged file containing a static a11y violation (e.g. an `<img>` with no `alt`),
Then the hook runs the framework's ESLint a11y config against staged files, reports each violation's file, line, rule ID, and mapped WCAG criterion to stderr, and exits non-zero — blocking the commit unless the developer explicitly bypasses with `--no-verify`.

**US-3 — An on-demand audit surfaces violations grouped by WCAG criterion**
Given a project's dev server is running and Playwright + `@axe-core/playwright` are installed,
When the developer (or their AI assistant) runs `node .a11y/scripts/audit.cjs <url>`,
Then axe-core scans the live page, violations are sorted by impact (critical → serious → moderate → minor), each is presented with its WCAG success criterion and title where a mapping exists, and results are also written to `.a11y/audit-results.json`.

## Functional Requirements

- **FR-001 — Framework auto-detection.** The toolkit detects the consuming project's frontend framework by reading `package.json` dependencies/devDependencies/peerDependencies and checking, in priority order, for `@angular/core` (angular) → `svelte` (svelte) → `vue` (vue) → `react` (react); returns `unknown` if none match or `package.json` is absent. (`src/detect-framework.ts`, built to `toolkit/scripts/detect-framework.cjs`.)
- **FR-002 — Config loading with defaults.** The toolkit loads `.a11y/config/a11y.config.json` at project root; if the file is absent it returns typed in-code defaults (all eight rule categories enabled, `wcagLevel: "AA"`); if the file exists but is malformed JSON or has an invalid shape (wrong `wcagLevel`, missing/non-boolean rule flags), it throws a descriptive, prefixed error rather than silently falling back. (`src/config-loader.ts`.)
- **FR-003 — Pre-commit enforcement per framework.** On `git commit`, the hook: loads config, resolves the framework (auto-detected, or previously persisted in config, or interactively prompted once and then persisted), filters staged files to framework-relevant extensions (`.jsx`/`.tsx` for React, `.vue`, `.svelte`, `.html`/`.ts` for Angular), runs ESLint programmatically against the matching per-framework flat config, filters results through the config's enabled rule categories, and exits 1 (violations found, commit blocked), 0 (clean or nothing relevant staged), or 2 (config/ESLint error). (`src/pre-commit.ts`.)
- **FR-004 — On-demand audit layer.** A CLI script launches headless Chromium via Playwright, navigates to a given URL, runs axe-core (`@axe-core/playwright`) with WCAG 2.1 AA tags by default or AAA via `--level AAA`, formats violations grouped and sorted by impact with a WCAG criterion/title where the internal `RULE_TO_WCAG` map has an entry, writes raw results to `.a11y/audit-results.json`, and exits 1 if any violations were found. (`src/audit.ts`.)
- **FR-005 — One-command setup script.** `toolkit/scripts/setup.sh` wires the git hook (`core.hooksPath`), detects the package manager (pnpm/yarn/bun/npm by lockfile), installs the framework-appropriate ESLint a11y plugin, and creates or idempotently patches `CLAUDE.md`, `.cursorrules`, `AGENTS.md`, and `.github/copilot-instructions.md` at the consuming project's root from the `toolkit/wrappers/` templates — never overwriting an existing wrapper file, only appending a marker line if missing.
- **FR-006 — Sample-app validation harness.** Four minimal sample apps (`samples/{react,vue,svelte,angular}-app`), each pre-loaded with intentional WCAG violations and each its own git repository (`samples/init-samples.sh`) with `.a11y` symlinked to `../../toolkit`, exist so the pre-commit hook and ESLint configs can be exercised end-to-end against real framework tooling rather than only in-process unit tests.

## Non-Functional Requirements

- **Cross-framework support.** All four supported frameworks (React, Vue, Svelte, Angular) must go through the same three layers via the same `setup.sh` entry point; framework-specific behavior is isolated to the ESLint config file selection and file-extension filtering, not duplicated pipeline logic.
- **Graceful degradation without Playwright.** The audit script must not fail with an unhandled exception when Playwright / `@axe-core/playwright` are not installed in the consumer project — it must detect this via `require.resolve` before attempting any dynamic import, print the exact install commands, and exit with code `3` specifically (verified in `src/audit.ts`, lines 104–118). This exit code is distinct from the generic error exit code `2` used elsewhere in the same file, though nothing in the codebase currently documents *why* `3` was chosen as distinct from `2` — see Open Questions.
- **No devDependency bleed into consumer projects.** Because distribution is copy-paste (`cp -r toolkit/`), a11y-sdk itself is never a dependency of the consuming project's `package.json`. `setup.sh` installs the framework-specific ESLint plugin as a real devDependency of the consumer project, but the toolkit's own runtime code (the built `.cjs` scripts) ships as plain files, not as an installed package.
- **ESLint 9 required; ESLint 10 not yet supported.** Documented in README.md: ESLint 10 breaks `@angular-eslint/template-parser`'s scope manager. This is a real, current constraint, not a future intent — see Non-Goals.

## Business Logic

Framework detection selects which ESLint a11y plugin and WCAG rule-mapping applies — that is the single rule the rest of the system is built around; there is no other domain logic to speak of.

Detection priority order (from `src/detect-framework.ts`, confirmed): **angular > svelte > vue > react**, checked against `@angular/core`, `svelte`, `vue`, `react` respectively in the merged `dependencies`/`devDependencies`/`peerDependencies` of the consumer's `package.json`. If none match, the result is `unknown` and the pre-commit hook falls back to an interactive TUI prompt (`promptFramework()`), persisting the developer's choice into `.a11y/config/a11y.config.json` under a `framework` key so future runs skip the prompt. Once a framework is resolved, it selects: (a) the ESLint flat-config file (`toolkit/config/eslint/{react,vue,svelte,angular}.cjs`), (b) the file-extension filter applied to staged files, and (c) which of the two rule-ID-to-WCAG-criterion maps (`WCAG_MAP` in `pre-commit.ts` for the static layer, `RULE_TO_WCAG` in `audit.ts` for the dynamic layer — these are separate, independently maintained maps) is consulted when reporting violations.

## Data Model

This is a stateless CLI/build-tool, not a data-backed application — there is no database, no persisted user record, and no traditional entity model. The closest analog is the config schema:

```
A11yConfig {
  wcagLevel: "AA" | "AAA"
  rules: {
    "focus-management": boolean
    "aria-roles": boolean
    "keyboard-navigation": boolean
    "color-contrast": boolean
    "form-labeling": boolean
    "landmark-structure": boolean
    "live-regions": boolean
    "images": boolean
  }
}
```

This lives at `.a11y/config/a11y.config.json` in the consuming project (default shape defined in `src/config-loader.ts`, `defaultConfig`) and is the one piece of state the toolkit reads and — in exactly one code path (`persistFrameworkChoice` in `pre-commit.ts`) — writes back to, to cache a manually-chosen framework. Note two things worth flagging honestly: (1) two of the eight rule categories, `color-contrast` and `live-regions`, have empty rule-prefix arrays in `rule-filter.ts`'s `CATEGORY_RULE_PREFIXES` — they exist in the config schema and are documented as toggle-able, but there is currently no static ESLint rule wired to either category, so toggling them off has no effect on the pre-commit hook (contrast and live-region timing are inherently runtime concerns static analysis can't catch — this is a real, self-acknowledged limitation, not a bug); (2) the audit layer (Layer 3) does not read this config at all — per `toolkit/context.md`, "the audit script always runs all checks regardless of this config."

## Access Control

Does not apply to this project the way it does to an end-user application. a11y-sdk has no login, no user accounts, no sessions, and no multi-tenant data to gate access to. The nearest thing to "access control" is filesystem/git-level: whichever developer has write access to the consuming repository can edit `.a11y/config/a11y.config.json` to disable rule categories, or bypass the pre-commit hook entirely with `git commit --no-verify`. Both are by design (the config is meant to be developer-editable; `--no-verify` is documented as the standard escape hatch for WIP commits) rather than gaps to close. See Open Questions for how this interacts with the certification rubric.

## Testing Strategy

Vitest unit and integration tests, no separate e2e framework:

- `tests/detect-framework.test.ts` — unit tests for detection priority and fallbacks (unknown framework, missing `package.json`, devDependency-only declarations).
- `tests/config-loader.test.ts` — unit tests for default fallback, valid parsing, malformed JSON, invalid shape, and missing rule flags.
- `tests/rule-filter.test.ts` — unit tests for `isRuleEnabled` category-to-rule-prefix suppression logic.
- `tests/audit-formatter.test.ts` — unit tests for `formatResults` (impact ordering, WCAG-map fallback to raw rule ID).
- `tests/pre-commit-integration.test.ts` — integration tests that spawn `toolkit/scripts/pre-commit.cjs` as a real child process against a temp git project with staged files, covering: real violation detection with correct WCAG citation, no false positives, no-op on irrelevant staged files, config-driven suppression (both directions, including a regression guard), malformed-config error exit code, and an Angular smoke test.
- `tests/setup-integration.test.ts` — integration tests that spawn `setup.sh` against a temp project, covering fresh-install hook wiring, wrapper file creation from `toolkit/wrappers/` templates, idempotent marker-append behavior (no duplicate markers on repeated runs), and partial-state re-entry (hook already wired, wrapper not yet patched).
- `tests/index.test.ts` — smoke test for the library entry point.
- `tests/helpers/make-project.ts` — shared fixture helper (`initGitProject`) for integration tests.

## Deployment & CI/CD Strategy

GitHub Actions (`.github/workflows/ci.yml`), triggered on push to `main`/`develop` and PRs to `main`. Single job, sequential steps: checkout → pnpm setup → Node 20 → `pnpm install --frozen-lockfile` → `pnpm typecheck` → `pnpm lint` (oxlint) → `pnpm test` (vitest run) → `pnpm build` (library → `dist/`) → `pnpm build:toolkit` (toolkit scripts → `toolkit/scripts/*.cjs` via a second tsup target) → an explicit artifact-existence check (`test -f` on the three built `.cjs` entry points). There is no separate deploy step: this pipeline is a build/verify gate, not a release pipeline — nothing in CI publishes anywhere. No CD exists today; distribution to end users is a manual `cp -r toolkit/` by the person adopting the toolkit, with no automated release process, no git tags, and no GitHub Releases (verified: `git tag` and `gh release list` both return empty).

## Non-Goals

- **ESLint 10 support.** Explicitly and currently blocked, not merely deprioritized: ESLint 10 breaks `@angular-eslint/template-parser`'s scope manager (stated in README.md). Revisiting this depends on upstream `@angular-eslint` compatibility work, not on anything in this project's control.
- **npm-registry publishing.** Deliberately not done today — distribution is copy-paste by design (`cp -r toolkit/ <project>/.a11y`), explicitly framed in the README as a way to avoid adding a package-manager dependency to consumer projects. Whether this should change is live — see `context/changes/npm-release-strategy/research.md` and Open Questions below.
- **Contrast and live-region static checking.** Not a gap to close by adding more ESLint rules — these are runtime-dependent properties (rendered color values; timing of live-region DOM mutations) that static analysis structurally cannot verify. The config schema keeps both categories as documented, inert placeholders rather than pretending they're enforced.

## Open Questions

1. **Certification Builder-tier structural mismatch (access control / CRUD).** The certification's mandatory 10xBuilder checklist requires "a mechanism kontroli dostępu odpowiedni dla typu aplikacji" (access control appropriate to the app type) and sensible CRUD data management for the domain. a11y-sdk is a CLI / static-analysis / build-time tool with no login, no user accounts, and no persisted user-editable record — there is no natural analog to either requirement, and the Access Control section above states this plainly rather than inventing a fake login flow or CRUD feature to force a checkbox. The certification text itself explicitly invites raising exactly this kind of case with the instructors before assuming a non-standard project qualifies ("załóż wątek w przestrzeni Dyskusje / Praktyka i oznacz prowadzących"). **This needs explicit instructor confirmation before this project is submitted for the Builder badge** — it is not something the project can resolve unilaterally by reshaping its own architecture to fit the checklist.
2. **Should the copy-paste distribution model become a real npm package?** Today's model (manual `cp -r toolkit/`) has real advantages the README states outright (no devDependency bleed) but also real costs: no versioning, no changelog, no way for a consumer to know if their copied `.a11y/` is stale relative to `toolkit/` upstream, and — concretely for this certification — it is the reason the 10xChampion "artifact registry" gap (a released-version list is a named requirement there) is currently unclosed, since no git tags or GitHub Releases exist. `context/changes/npm-release-strategy/research.md` researches this in depth but does not resolve it; the decision of whether to pursue npm publish, GitHub Releases with tagged tarballs, both, or neither is still open.
3. **Why does the audit script use exit code `3` specifically for "Playwright not installed," distinct from the generic error exit code `2` used everywhere else in the same file?** The behavior is intentional and tested (this NFR is real and verified in code), but no comment or doc explains why `3` was chosen over reusing `2` with a different message. Not blocking, but worth a one-line rationale if anyone revisits the exit-code contract.
4. **`color-contrast` and `live-regions` config categories are inert for the static hook.** Both exist in the config schema and are documented as toggle-able in `context.md`/README, but `CATEGORY_RULE_PREFIXES` in `rule-filter.ts` maps both to empty rule-prefix arrays — there is no ESLint rule currently wired to either, so setting them to `false` has no observable effect on Layer 2. This is defensible (contrast and live-region timing are runtime concerns) but is not stated anywhere in user-facing docs, so a developer reading `context.md` could reasonably believe toggling `color-contrast: false` changes pre-commit behavior when it does not.
