# Recipe catalog

a11y-sdk installs accessibility enforcement as **recipes** — named, versioned,
composable, scope-aware units. The catalog *is* the product surface: a third
party (e.g. a delivery vehicle like a PDLC toolkit) invokes the pinned installer
at a tag and composes the recipes it needs, without vendoring any recipe logic.

Invoke with no clone required:

```bash
npx a11y-sdk@<tag> init [flags]
```

The machine-readable manifest (`a11y-sdk recipes --json`, also shipped as
[`recipes.json`](../recipes.json)) lets callers introspect ids, aliases, and the
flags a recipe requires before running.

## The recipes

| Recipe | `--only` alias | What it does | Idempotent |
|---|---|---|---|
| `r1-context` | `context` | Installs `.a11y/context.md` + `.a11y/rules/` and patches AI-config files (`CLAUDE.md`, `.github/copilot-instructions.md`, `.cursorrules`, `AGENTS.md`) to point the assistant at the a11y rules. | yes |
| `r2-commit-gate` | `lint` | Installs the framework-correct ESLint a11y flat-config + runner and wires a commit gate (see hook strategies below). **Modifies the commit workflow — requires consent.** | yes |
| `r3-audit` | `audit` | Installs `.a11y/scripts/audit.cjs` (axe-core + Playwright) for on-demand audits with exact rule IDs and WCAG criteria. | yes |

Each recipe implements the same surface: `detect()`, `plan()`, `apply()`,
`verify()`, and an `idempotent` flag. Re-runs skip already-wired targets.

## `init` flags

| Flag | Purpose |
|---|---|
| `--scope <dir>` | Install target (default: git root). Enables **embedded mode**. |
| `--ai <claude\|copilot\|cursor\|agents\|all>` | Which AI-config files R1 patches (default `all`; comma-separated allowed). |
| `--framework <auto\|react\|vue\|svelte\|angular>` | Override framework detection. |
| `--only <context,lint,audit>` | Run a subset of recipes. |
| `--hook-strategy <hookspath\|integrate\|ci-step\|none>` | How R2 wires the gate (default: auto). |
| `--dry-run` | Print the plan, change nothing. Feeds a caller's preview. |
| `--json` | Machine-readable result (what changed / skipped). |
| `--yes` | Consent to workflow-modifying recipes (R2). |
| `--no-install` | Skip the ESLint plugin install. |

## Scope awareness (embedded mode)

By default `.a11y/` installs at the git root and R1 patches root-level AI config.
Under `--scope <dir>`, everything resolves relative to that directory: `.a11y/`
lands in `<dir>`, the AI-config file is patched **at that scope**, and audit paths
resolve relative to it. Nothing outside the declared scope is modified.

## R2 hook strategies — the sharp edge

`git config core.hooksPath` is **repo-global**. Forcing it onto a product repo
that already has husky / lint-staged / a hook manager silently breaks that repo.
So R2 splits:

| Strategy | Behavior |
|---|---|
| `hookspath` | Sets `core.hooksPath` to the a11y hooks dir. **Default for standalone.** |
| `integrate` | Registers the a11y lint step with an existing manager (husky) **without** taking over `core.hooksPath`. |
| `ci-step` | Changes no local git config; points you at `emit ci` (below). |
| `none` | Installs the ESLint config only; you wire the gate. |

**Auto-select** (when `--hook-strategy` is omitted):

- standalone repo with a safe (unset / a11y-owned) `core.hooksPath` → `hookspath`
- an existing hook manager is detected → `integrate`
- otherwise (embedded scope, or a foreign `core.hooksPath`) → `ci-step`

If `hookspath` is requested explicitly but the repo already manages hooks, the
installer **refuses** and tells you to pick `integrate` or `ci-step`.

**Consent.** Because R2 changes the commit workflow, it is never applied silently
in a non-interactive run. Pass `--yes`, or scope the run with `--only lint`, to
opt in. Otherwise R2 reports `needs-consent` and is skipped.

## CI snippets

```bash
a11y-sdk emit ci --provider github|bitbucket [--scope <dir>] [--audit-url <url>]
```

Prints a pipeline step that installs the toolkit pinned to this tag, runs the
a11y lint gate, and (with `--audit-url`) an axe-core audit. This is the artifact
`--hook-strategy ci-step` points teams at.

## `audit` subcommand

```bash
a11y-sdk audit <url> [--level AA|AAA] [--json]
```

`--json` emits a stable envelope (`{ violationCount, violations[] }` with rule
id, impact, WCAG criterion, and selectors) for programmatic callers.

## Release discipline (the contract boundary)

These are **public API** — stable, don't churn:

- `toolkit/context.md`, `toolkit/rules/*.md` (the WCAG content)
- the `init` / `emit` / `audit` flag surface above
- `recipes.json`

Every recipe/content change gets a tag + GitHub Release — **the tag is the
contract**. Vendorable content stays framework/product-clean (enforced by
`tests/content-clean.test.ts` in CI), so downstream consumers can vendor it
verbatim.
