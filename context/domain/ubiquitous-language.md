# Ubiquitous Language — a11y-sdk

Terms here are grounded in `toolkit/context.md` and the six `toolkit/rules/*.md` documents, plus the source code that implements them. Nothing below is invented — every WCAG criterion cited is one this project's own documentation already names.

## WCAG 2.1 AA criteria categories (Perceivable / Operable / Understandable / Robust)

`toolkit/context.md` organizes its "Minimum Coverage" section under exactly these four POUR headings, each with named, numbered success criteria:

**Perceivable** — content must be presentable to users in ways they can perceive. Criteria named: 1.1.1 Non-text Content, 1.3.1 Info and Relationships, 1.3.2 Meaningful Sequence, 1.3.5 Identify Input Purpose, 1.4.1 Use of Color, 1.4.3 Contrast (Minimum), 1.4.4 Resize Text, 1.4.10 Reflow, 1.4.11 Non-text Contrast, 1.4.13 Content on Hover or Focus.

**Operable** — interface components and navigation must be operable. Criteria named: 2.1.1 Keyboard, 2.1.2 No Keyboard Trap, 2.4.1 Bypass Blocks, 2.4.3 Focus Order, 2.4.4 Link Purpose, 2.4.6 Headings and Labels, 2.4.7 Focus Visible, 2.4.11 Focus Appearance (AA, WCAG 2.2 — explicitly flagged in the source as a 2.2 criterion included alongside 2.1 baseline coverage), 2.5.3 Label in Name.

**Understandable** — content and operation must be understandable. Criteria named: 3.1.1 Language of Page, 3.2.1 On Focus, 3.2.2 On Input, 3.3.1 Error Identification, 3.3.2 Labels or Instructions.

**Robust** — content must be robust enough to work with assistive technologies. Criteria named: 4.1.1 Parsing, 4.1.2 Name, Role, Value, 4.1.3 Status Messages.

The audit layer (`src/audit.ts`, `RULE_TO_WCAG`) and pre-commit layer (`src/pre-commit.ts`, `WCAG_MAP`) each independently cite a subset of these same criterion numbers when reporting violations — confirmed by cross-referencing both maps against the list above; no criterion appears in either map that isn't traceable to a numbered item in `context.md`.

## Violation severity levels (critical / serious / moderate / minor)

Sourced directly from axe-core's own `impact` field, as consumed in `src/audit.ts`:

```typescript
impact: "critical" | "serious" | "moderate" | "minor" | null
```

`formatResults()` sorts violations by an explicit `IMPACT_ORDER` (`critical: 0, serious: 1, moderate: 2, minor: 3`) so the most severe issues are always listed first. `toolkit/context.md`'s "Running an Audit" section states the same ordering as user-facing guidance: *"Present results grouped by WCAG criterion, ordered by impact level: critical → serious → moderate → minor."* This severity vocabulary belongs specifically to **Layer 3 (Runtime Audit)** — the static pre-commit layer (Layer 2) has no equivalent severity concept; a violation there is binary (it fires or it doesn't), reported with file/line/rule/WCAG-criterion but no impact tier.

## Framework → plugin mapping

This is the concrete expression of the project's one real piece of business logic (framework detection selects which plugin and rule-mapping applies — see `prd.md`). Four frameworks, four distinct enforcement mechanisms, verified against `toolkit/config/eslint/*.cjs` and `README.md`'s "Supported frameworks" table:

| Framework | Mechanism | Nature |
|---|---|---|
| **React** | `eslint-plugin-jsx-a11y` (≥ 6.9.0) | A conventional ESLint plugin — rules are authored against JSX AST nodes. |
| **Vue** | `eslint-plugin-vuejs-accessibility` (≥ 2.5.0 per this repo's own pin; setup.sh installs ≥2.3.0) + `eslint-plugin-vue` | Also a conventional plugin, but its recommended config is an *array* of config objects rather than one, which `vue.cjs` maps over. |
| **Svelte** | `eslint-plugin-svelte` (≥ 3.0.0) + the Svelte **compiler's own** a11y warnings, promoted via `svelte/valid-compile` | Structurally different from the other three: Svelte's a11y rules (`a11y-alt-text`, `a11y-click-events-have-key-events`, etc., per `svelte.cjs`'s comment) are not ESLint-plugin rules at all — they are warnings the Svelte compiler itself emits, which `svelte/valid-compile: 'error'` turns into ESLint-visible errors. This is not a plugin providing rules; it's an ESLint rule providing a *bridge* to compiler diagnostics. |
| **Angular** | `@angular-eslint/eslint-plugin-template` (`.accessibility` rule set) + `@angular-eslint/template-parser` | Also structurally distinct: the upstream `angular.configs.accessibility` ships in eslintrc shape (string-array plugins, top-level parser), not flat-config shape, so `angular.cjs` manually reconstructs a flat-config object around it — per its own inline comment, this is a deliberate workaround, not an oversight. |

Two of the four (Svelte, Angular) are not "just install a plugin" in the way React and Vue are — this is a real, load-bearing asymmetry in how the project supports its four frameworks, not a naming convenience.

## Rule categories (the config-facing vocabulary)

`toolkit/config/a11y.config.json`'s `rules` object defines eight named categories that are the vocabulary a *developer* interacts with (as opposed to the WCAG-criterion vocabulary the *audit output* uses): `focus-management`, `aria-roles`, `keyboard-navigation`, `color-contrast`, `form-labeling`, `landmark-structure`, `live-regions`, `images`. These map many-to-one onto WCAG criteria and ESLint rule-ID prefixes via `src/rule-filter.ts`'s `CATEGORY_RULE_PREFIXES` — notably, `color-contrast` and `live-regions` map to *empty* prefix arrays today (no static rule is wired to either), which is documented as a real, acknowledged limitation in `prd.md` rather than a term this glossary should paper over.
