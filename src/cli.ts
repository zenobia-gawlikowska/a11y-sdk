import { realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { detectFramework, FRAMEWORKS, type Framework } from "./detect-framework.js";
import { VERSION } from "./index.js";
import { RECIPES, resolveRecipe } from "./recipes/registry.js";
import {
  AI_TARGETS,
  CI_PROVIDERS,
  HOOK_STRATEGIES,
  type AiTarget,
  type CiProvider,
  type HookStrategy,
  type Recipe,
  type RecipeContext,
  type RecipeResult,
} from "./recipes/types.js";
import {
  detectHookEnvironment,
  gitToplevel,
  hooksPathIsSafe,
} from "./recipes/util.js";
import { emitCiSnippet } from "./ci-templates.js";
import { parseAuditArgs, runAudit } from "./audit.js";

// ---------------------------------------------------------------------------
// Environment injected by the entrypoint (overridable in tests).
// ---------------------------------------------------------------------------

export interface CliEnv {
  cwd: string;
  toolkitDir: string;
  version: string;
  interactive: boolean;
}

export interface CliOutcome {
  exitCode: number;
  /** Text to print to stdout. */
  stdout: string;
  /** Text to print to stderr. */
  stderr: string;
  /** Structured result (populated for --json / recipes). */
  json?: unknown;
}

// ---------------------------------------------------------------------------
// Minimal flag parser
// ---------------------------------------------------------------------------

interface Parsed {
  _: string[];
  flags: Record<string, string | boolean>;
}

const BOOLEAN_FLAGS = new Set([
  "dry-run",
  "json",
  "yes",
  "no-install",
  "help",
  "version",
]);

function parseArgs(argv: string[]): Parsed {
  const _: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq >= 0) {
        flags[a.slice(2, eq)] = a.slice(eq + 1);
      } else {
        const name = a.slice(2);
        if (BOOLEAN_FLAGS.has(name)) {
          flags[name] = true;
        } else {
          const next = argv[i + 1];
          if (next !== undefined && !next.startsWith("--")) {
            flags[name] = next;
            i++;
          } else {
            flags[name] = true;
          }
        }
      }
    } else {
      _.push(a);
    }
  }
  return { _, flags };
}

function str(flags: Parsed["flags"], name: string): string | undefined {
  const v = flags[name];
  return typeof v === "string" ? v : undefined;
}

// ---------------------------------------------------------------------------
// Resolution helpers
// ---------------------------------------------------------------------------

function resolveAi(raw: string | undefined): AiTarget[] | { error: string } {
  if (!raw || raw === "all") return [...AI_TARGETS];
  const parts = raw.split(",").map((s) => s.trim());
  const out: AiTarget[] = [];
  for (const p of parts) {
    if (p === "all") return [...AI_TARGETS];
    if ((AI_TARGETS as readonly string[]).includes(p)) out.push(p as AiTarget);
    else return { error: `unknown --ai target "${p}" (expected ${AI_TARGETS.join("|")}|all)` };
  }
  return out;
}

function resolveFramework(
  raw: string | undefined,
  scope: string,
): Framework | { error: string } {
  if (!raw || raw === "auto") return detectFramework(scope);
  if ((FRAMEWORKS as readonly string[]).includes(raw)) return raw as Framework;
  return { error: `unknown --framework "${raw}" (expected auto|${FRAMEWORKS.join("|")})` };
}

function resolveProvider(raw: string | undefined): CiProvider | { error: string } {
  if (!raw) return "github";
  if ((CI_PROVIDERS as readonly string[]).includes(raw)) return raw as CiProvider;
  return { error: `unknown --provider "${raw}" (expected ${CI_PROVIDERS.join("|")})` };
}

function resolveRecipes(raw: string | undefined): Recipe[] | { error: string } {
  if (!raw) return [...RECIPES];
  const out: Recipe[] = [];
  for (const token of raw.split(",").map((s) => s.trim())) {
    const r = resolveRecipe(token);
    if (!r) return { error: `unknown --only recipe "${token}" (expected context|lint|audit or r1/r2/r3 ids)` };
    if (!out.includes(r)) out.push(r);
  }
  // Preserve registry order for deterministic output.
  return RECIPES.filter((r) => out.includes(r));
}

interface HookResolution {
  strategy: HookStrategy;
  error?: string;
  note?: string;
}

function resolveHookStrategy(
  raw: string | undefined,
  scope: string,
  gitRoot: string | null,
): HookResolution {
  const env = detectHookEnvironment(scope, gitRoot);
  const standalone = gitRoot !== null && scope === gitRoot;

  if (raw) {
    if (!(HOOK_STRATEGIES as readonly string[]).includes(raw)) {
      return { strategy: "none", error: `unknown --hook-strategy "${raw}"` };
    }
    const strategy = raw as HookStrategy;
    if (strategy === "hookspath") {
      if (gitRoot === null) {
        return { strategy, error: "hookspath requires a git repository (run git init or use --hook-strategy none)" };
      }
      if (!standalone) {
        // core.hooksPath is repo-global: pointed at an embedded scope it would
        // gate every commit in the repo while the hook reads config from the
        // wrong directory. Refuse rather than half-work.
        return {
          strategy,
          error:
            "refusing hookspath: --scope is not the git root, but core.hooksPath " +
            "is repo-global — the hook would gate the whole repo while missing " +
            "the scoped .a11y config. Use --hook-strategy integrate or ci-step.",
        };
      }
      if (!hooksPathIsSafe(env)) {
        return {
          strategy,
          error:
            "refusing hookspath: this repo already manages git hooks " +
            `(${env.husky ? "husky" : `core.hooksPath=${env.hooksPath}`}). ` +
            "Use --hook-strategy integrate or ci-step.",
        };
      }
    }
    return { strategy };
  }

  // Auto-select (plan §1.4).
  if (standalone && hooksPathIsSafe(env)) {
    return { strategy: "hookspath" };
  }
  if (env.husky || env.lintStaged || env.preCommitFramework) {
    return {
      strategy: "integrate",
      note: "auto-selected integrate (existing hook manager detected)",
    };
  }
  return {
    strategy: "ci-step",
    note: standalone
      ? "auto-selected ci-step (core.hooksPath already set by another tool)"
      : "auto-selected ci-step (embedded scope — never hijacks the product repo's hooks)",
  };
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/** True when the strategy modifies the local commit workflow (needs consent). */
function strategyModifiesWorkflow(s: HookStrategy): boolean {
  return s === "hookspath" || s === "integrate";
}

async function cmdInit(parsed: Parsed, env: CliEnv): Promise<CliOutcome> {
  const { flags } = parsed;

  const scopeArg = str(flags, "scope");
  const scope = scopeArg ? resolve(env.cwd, scopeArg) : (gitToplevel(env.cwd) ?? env.cwd);
  const gitRoot = gitToplevel(scope);

  const ai = resolveAi(str(flags, "ai"));
  if ("error" in ai) return fail(ai.error);

  const framework = resolveFramework(str(flags, "framework"), scope);
  if (typeof framework === "object") return fail(framework.error);

  const recipes = resolveRecipes(str(flags, "only"));
  if ("error" in recipes) return fail(recipes.error);
  const onlyGiven = typeof str(flags, "only") === "string";
  // Consent via --only requires the run to be scoped to the commit gate alone;
  // merely including lint in a larger list is not an explicit opt-in.
  const explicitLint =
    onlyGiven && recipes.length === 1 && recipes[0]!.id === "r2-commit-gate";

  const provider = resolveProvider(str(flags, "provider"));
  if (typeof provider === "object") return fail(provider.error);
  const hook = resolveHookStrategy(str(flags, "hook-strategy"), scope, gitRoot);
  if (hook.error) return fail(hook.error);

  const dryRun = flags["dry-run"] === true;
  const jsonOut = flags["json"] === true;
  const installDeps = flags["no-install"] !== true;
  const consent = flags["yes"] === true || explicitLint || env.interactive;

  const ctx: RecipeContext = {
    scope,
    gitRoot,
    toolkitDir: env.toolkitDir,
    framework,
    ai,
    hookStrategy: hook.strategy,
    dryRun,
    installDeps,
    provider,
    version: env.version,
  };

  const results: RecipeResult[] = [];
  for (const recipe of recipes) {
    const needsConsent =
      recipe.id === "r2-commit-gate" && strategyModifiesWorkflow(ctx.hookStrategy);
    if (needsConsent && !consent) {
      results.push({
        id: recipe.id,
        status: "needs-consent",
        changes: [],
        messages: [
          "R2 modifies your commit workflow. Re-run with --yes, or scope it " +
            "explicitly with --only lint, to apply the commit gate.",
        ],
      });
      continue;
    }
    results.push(recipe.apply(ctx));
  }

  // Verify (skipped in dry-run — nothing was written).
  const verifySummary = dryRun
    ? undefined
    : recipes
        .filter((r) => results.find((res) => res.id === r.id)?.status === "applied")
        .map((r) => ({ id: r.id, ...r.verify(ctx) }));

  const meta = {
    version: ctx.version,
    scope,
    gitRoot,
    framework,
    ai,
    hookStrategy: ctx.hookStrategy,
    dryRun,
    ...(hook.note ? { hookNote: hook.note } : {}),
  };

  if (jsonOut) {
    return {
      exitCode: results.some((r) => r.status === "error") ? 1 : 0,
      stdout: JSON.stringify({ ...meta, recipes: results, verify: verifySummary }, null, 2),
      stderr: "",
      json: { ...meta, recipes: results, verify: verifySummary },
    };
  }

  return {
    exitCode: results.some((r) => r.status === "error") ? 1 : 0,
    stdout: renderHuman(meta, results, verifySummary, hook.note),
    stderr: "",
  };
}

function cmdEmit(parsed: Parsed, env: CliEnv): CliOutcome {
  const sub = parsed._[1];
  if (sub !== "ci") {
    return fail(`unknown emit target "${sub ?? ""}" (expected: emit ci)`);
  }
  const { flags } = parsed;
  const provider = resolveProvider(str(flags, "provider"));
  if (typeof provider === "object") return fail(provider.error);
  const scopeArg = str(flags, "scope");
  const scope = scopeArg ? scopeArg : ".";
  const auditUrl = str(flags, "audit-url");

  // The emitted lint step must run the framework-correct ESLint config —
  // init installs only that framework's plugin, so react.cjs on a Vue repo
  // would fail with MODULE_NOT_FOUND in CI.
  const framework = resolveFramework(str(flags, "framework"), resolve(env.cwd, scope));
  if (typeof framework === "object") return fail(framework.error);

  const snippet = emitCiSnippet({
    provider,
    version: env.version,
    scope,
    framework,
    ...(auditUrl ? { auditUrl } : {}),
  });
  return { exitCode: 0, stdout: snippet, stderr: "" };
}

export function buildManifest(version: string): unknown {
  return {
    version,
    recipes: RECIPES.map((r) => ({
      id: r.id,
      alias: r.alias,
      title: r.title,
      idempotent: r.idempotent,
      requiredFlags: r.requiredFlags,
    })),
  };
}

function cmdRecipes(parsed: Parsed, env: CliEnv): CliOutcome {
  const manifest = buildManifest(env.version);
  if (parsed.flags["json"] === true) {
    return { exitCode: 0, stdout: JSON.stringify(manifest, null, 2), stderr: "", json: manifest };
  }
  const lines = ["a11y-sdk recipe catalog:", ""];
  for (const r of RECIPES) {
    lines.push(`  ${r.id}  (--only ${r.alias})`);
    lines.push(`    ${r.title}${r.idempotent ? " · idempotent" : ""}`);
    if (r.requiredFlags.length > 0) {
      lines.push(`    requires: ${r.requiredFlags.join(", ")}`);
    }
  }
  return { exitCode: 0, stdout: lines.join("\n"), stderr: "" };
}

async function cmdAudit(args: string[]): Promise<CliOutcome> {
  // audit owns its argv (parseAuditArgs is shared with the toolkit script) —
  // re-parsing through the generic flag parser would let an unknown flag
  // swallow the URL as its value.
  const { url, opts, error } = parseAuditArgs(args);
  if (error) return fail(error);
  // audit prints directly to stdout/stderr and returns an exit code.
  const code = await runAudit(url, opts);
  return { exitCode: code, stdout: "", stderr: "" };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const STATUS_GLYPH: Record<string, string> = {
  applied: "✔",
  planned: "•",
  skipped: "–",
  "needs-consent": "⚠",
  "not-applicable": "–",
  error: "✖",
};

function renderHuman(
  meta: Record<string, unknown>,
  results: RecipeResult[],
  verify: Array<{ id: string; ok: boolean }> | undefined,
  hookNote: string | undefined,
): string {
  const lines: string[] = [];
  lines.push(
    `a11y-sdk ${meta["version"]} — scope: ${meta["scope"]}` +
      `${meta["dryRun"] ? "  (dry-run)" : ""}`,
  );
  lines.push(
    `framework: ${meta["framework"]}  ·  ai: ${(meta["ai"] as string[]).join(", ")}  ·  hooks: ${meta["hookStrategy"]}`,
  );
  if (hookNote) lines.push(`  ${hookNote}`);
  lines.push("");

  for (const res of results) {
    const recipe = RECIPES.find((r) => r.id === res.id);
    lines.push(`${STATUS_GLYPH[res.status] ?? "?"} ${recipe?.title ?? res.id} (${res.id}) — ${res.status}`);
    for (const c of res.changes) {
      const detail = c.detail ? ` (${c.detail})` : "";
      lines.push(`    ${c.action.padEnd(7)} ${c.target}${detail}`);
    }
    for (const m of res.messages) {
      lines.push(`    → ${m}`);
    }
    if (res.error) lines.push(`    ✖ ${res.error}`);
    lines.push("");
  }

  if (verify && verify.length > 0) {
    const allOk = verify.every((v) => v.ok);
    lines.push(allOk ? "verify: all checks passed" : "verify: some checks FAILED");
  }

  return lines.join("\n").trimEnd();
}

function fail(message: string): CliOutcome {
  return { exitCode: 2, stdout: "", stderr: `a11y-sdk: ${message}` };
}

const HELP = `a11y-sdk <command> [flags]

Commands:
  init                 Install a11y recipes into a project (default)
  emit ci              Print a CI pipeline step pinned to this tag
  recipes              List the recipe catalog (add --json for the manifest)
  audit <url>          Run the axe-core audit (add --json / --level AAA)

init flags:
  --scope <dir>              Install target (default: git root). Enables embedded mode.
  --ai <claude|copilot|cursor|agents|all>   Which AI-config files R1 patches (default: all)
  --framework <auto|react|vue|svelte|angular>   Override framework detection
  --only <context,lint,audit>   Run a subset of recipes
  --hook-strategy <hookspath|integrate|ci-step|none>   R2 wiring (default: auto)
  --dry-run                  Print the plan, change nothing
  --json                     Machine-readable result
  --yes                      Consent to workflow-modifying recipes (R2)
  --no-install               Skip the ESLint plugin install

emit ci flags:
  --provider <github|bitbucket>   Pipeline flavour (default: github)
  --scope <dir>                   Install target for the step
  --framework <auto|react|vue|svelte|angular>   ESLint config the lint step runs
  --audit-url <url>               Include an axe-core audit step

Docs: docs/recipes.md`;

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

export async function runCli(argv: string[], env: CliEnv): Promise<CliOutcome> {
  const parsed = parseArgs(argv);

  if (parsed.flags["version"] === true) {
    return { exitCode: 0, stdout: env.version, stderr: "" };
  }
  if (parsed.flags["help"] === true || parsed._[0] === "help") {
    return { exitCode: 0, stdout: HELP, stderr: "" };
  }

  const command = parsed._[0] ?? "init";
  switch (command) {
    case "init":
      return cmdInit(parsed, env);
    case "emit":
      return cmdEmit(parsed, env);
    case "recipes":
      return cmdRecipes(parsed, env);
    case "audit":
      return cmdAudit(argv.slice(argv.indexOf("audit") + 1));
    default:
      return { exitCode: 2, stdout: "", stderr: `a11y-sdk: unknown command "${command}"\n\n${HELP}` };
  }
}

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------

function defaultToolkitDir(): string {
  // Built as dist/cli.js → toolkit lives at <packageRoot>/toolkit.
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..", "toolkit");
}

const isMain = (() => {
  try {
    if (process.argv[1] === undefined) return false;
    // realpathSync resolves the npm .bin symlink; pathToFileURL percent-encodes
    // (spaces etc.) the same way Node built import.meta.url. Naive
    // `file://${argv[1]}` matches neither, making the CLI a silent no-op.
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
})();

if (isMain) {
  const env: CliEnv = {
    cwd: process.cwd(),
    toolkitDir: defaultToolkitDir(),
    version: VERSION,
    interactive: Boolean(process.stdout.isTTY),
  };
  runCli(process.argv.slice(2), env)
    .then((out) => {
      if (out.stdout) process.stdout.write(out.stdout + "\n");
      if (out.stderr) process.stderr.write(out.stderr + "\n");
      process.exit(out.exitCode);
    })
    .catch((err: unknown) => {
      process.stderr.write(`a11y-sdk: unexpected error — ${String(err)}\n`);
      process.exit(2);
    });
}
