import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join, relative } from "node:path";
import type { Framework } from "../detect-framework.js";
import type {
  Change,
  DetectResult,
  HookStrategy,
  Recipe,
  RecipeContext,
  RecipeResult,
  VerifyResult,
} from "./types.js";
import {
  copyIfAbsent,
  copyOverwrite,
  detectHookEnvironment,
  detectPackageManager,
  fileContains,
  installCommand,
  makeExecutable,
} from "./util.js";

// Framework → ESLint a11y plugin(s). Mirrors README's supported-frameworks table.
const FRAMEWORK_DEPS: Record<Exclude<Framework, "unknown">, string[]> = {
  react: ["eslint-plugin-jsx-a11y@^6.9.0"],
  vue: ["eslint-plugin-vuejs-accessibility@^2.5.0", "eslint-plugin-vue"],
  svelte: ["eslint-plugin-svelte@^3.0.0", "svelte"],
  angular: [
    "@angular-eslint/eslint-plugin-template@^19.0.0",
    "@angular-eslint/template-parser@^19.0.0",
  ],
};

/** The node invocation an existing hook manager should call. */
const HOOK_INVOCATION = "node .a11y/scripts/pre-commit.cjs";

function installAssets(ctx: RecipeContext): Change[] {
  const a11y = (p: string) => join(ctx.scope, ".a11y", p);
  const tk = (p: string) => join(ctx.toolkitDir, p);
  const changes: Change[] = [
    // User-editable config — never clobber an existing one.
    copyIfAbsent(ctx, tk("config/a11y.config.json"), a11y("config/a11y.config.json")),
    // Framework ESLint flat-configs — keep current (overwrite so upgrades land).
    copyOverwrite(ctx, tk("config/eslint"), a11y("config/eslint")),
    // Runtime scripts the hook depends on.
    copyOverwrite(ctx, tk("scripts/pre-commit.cjs"), a11y("scripts/pre-commit.cjs")),
    copyOverwrite(ctx, tk("scripts/detect-framework.cjs"), a11y("scripts/detect-framework.cjs")),
    copyOverwrite(ctx, tk("scripts/config-loader.cjs"), a11y("scripts/config-loader.cjs")),
    copyOverwrite(ctx, tk("hooks"), a11y("hooks")),
  ];
  makeExecutable(ctx, a11y("hooks/pre-commit"));
  return changes;
}

function installPlugin(ctx: RecipeContext): { changes: Change[]; messages: string[] } {
  if (ctx.framework === "unknown") {
    return {
      changes: [],
      messages: [
        "Framework not detected — install the ESLint a11y plugin manually, " +
          "or re-run with --framework <react|vue|svelte|angular>.",
      ],
    };
  }
  const pm = detectPackageManager(ctx.scope);
  const deps = FRAMEWORK_DEPS[ctx.framework];
  const cmd = installCommand(pm, deps);

  if (ctx.dryRun || !ctx.installDeps) {
    return {
      changes: [{ action: "exec", target: cmd, detail: `${pm} (${ctx.framework})` }],
      messages: ctx.installDeps ? [] : [`Skipped dependency install (--no-install): ${cmd}`],
    };
  }

  try {
    execSync(cmd, { cwd: ctx.scope, stdio: "inherit" });
    return {
      changes: [{ action: "exec", target: cmd, detail: `${pm} (${ctx.framework})` }],
      messages: [],
    };
  } catch {
    return {
      changes: [{ action: "exec", target: cmd, detail: "FAILED" }],
      messages: [`Dependency install failed. Run manually: ${cmd}`],
    };
  }
}

function wireHook(ctx: RecipeContext): { changes: Change[]; messages: string[] } {
  switch (ctx.hookStrategy) {
    case "hookspath":
      return wireHooksPath(ctx);
    case "integrate":
      return wireIntegrate(ctx);
    case "ci-step":
      return {
        changes: [],
        messages: [
          "hook-strategy=ci-step: no local git config changed. Add a pipeline " +
            `step with:  npx a11y-sdk@${ctx.version} emit ci --provider ${ctx.provider}`,
        ],
      };
    case "none":
      return {
        changes: [],
        messages: [
          "hook-strategy=none: ESLint config installed; wire the gate yourself " +
            `(run "${HOOK_INVOCATION}" from your commit workflow).`,
        ],
      };
  }
}

function wireHooksPath(ctx: RecipeContext): { changes: Change[]; messages: string[] } {
  const root = ctx.gitRoot ?? ctx.scope;
  const hooksDir = join(ctx.scope, ".a11y", "hooks");
  const value = relativeUnix(root, hooksDir);
  if (ctx.dryRun) {
    return {
      changes: [{ action: "config", target: `git core.hooksPath=${value}` }],
      messages: [],
    };
  }
  try {
    execSync(`git config core.hooksPath ${value}`, { cwd: root, stdio: "pipe" });
    return {
      changes: [{ action: "config", target: `git core.hooksPath=${value}` }],
      messages: [`Git hook wired: core.hooksPath = ${value}`],
    };
  } catch (err) {
    return {
      changes: [{ action: "config", target: "git core.hooksPath", detail: "FAILED" }],
      messages: [`Failed to set core.hooksPath: ${String(err)}`],
    };
  }
}

function wireIntegrate(ctx: RecipeContext): { changes: Change[]; messages: string[] } {
  const root = ctx.gitRoot ?? ctx.scope;
  const huskyPre = join(root, ".husky", "pre-commit");
  const invocation = huskyInvocation(ctx, root);

  if (existsSync(join(root, ".husky"))) {
    const current = existsSync(huskyPre) ? readFileSync(huskyPre, "utf8") : "";
    if (current.includes(invocation)) {
      return {
        changes: [{ action: "skip", target: ".husky/pre-commit", detail: "already wired" }],
        messages: ["husky pre-commit already runs the a11y gate."],
      };
    }
    if (!ctx.dryRun) {
      mkdirSync(dirname(huskyPre), { recursive: true });
      const next = current.length > 0 ? `${current.trimEnd()}\n${invocation}\n` : `${invocation}\n`;
      writeFileSync(huskyPre, next, "utf8");
      makeExecutable(ctx, huskyPre);
    }
    return {
      changes: [{ action: current ? "append" : "create", target: ".husky/pre-commit" }],
      messages: ["Registered a11y gate in husky pre-commit (core.hooksPath untouched)."],
    };
  }

  // No supported manager to integrate with — install config, hand off wiring.
  return {
    changes: [],
    messages: [
      "hook-strategy=integrate: no husky install found. ESLint config is in place; " +
        `add "${invocation}" to your existing pre-commit runner, or use --hook-strategy ci-step.`,
    ],
  };
}

function huskyInvocation(ctx: RecipeContext, gitRoot: string): string {
  // Path to the a11y script relative to the git root husky runs from.
  const script = relativeUnix(gitRoot, join(ctx.scope, ".a11y", "scripts", "pre-commit.cjs"));
  return `node ${script}`;
}

function relativeUnix(from: string, to: string): string {
  const r = relative(from, to);
  return (r === "" ? "." : r).split("\\").join("/");
}

export const r2CommitGate: Recipe = {
  id: "r2-commit-gate",
  alias: "lint",
  title: "Commit gate (ESLint a11y + hook)",
  idempotent: true,
  // Modifies the product's commit workflow → needs explicit opt-in.
  requiredFlags: ["--only lint | --yes"],

  detect(ctx: RecipeContext): DetectResult {
    const env = detectHookEnvironment(ctx.scope, ctx.gitRoot);
    const notes: string[] = [];
    if (env.husky) notes.push("husky detected");
    if (env.hooksPath) notes.push(`core.hooksPath=${env.hooksPath}`);
    if (env.lintStaged) notes.push("lint-staged detected");
    if (env.preCommitFramework) notes.push("pre-commit framework detected");
    return {
      applicable: true,
      alreadyApplied: false, // hook wiring is strategy-dependent; always re-check
      ...(notes.length > 0 ? { notes } : {}),
    };
  },

  plan(ctx: RecipeContext): Change[] {
    const dry: RecipeContext = { ...ctx, dryRun: true };
    return [
      ...installAssets(dry),
      ...installPlugin(dry).changes,
      ...wireHook(dry).changes,
    ];
  },

  apply(ctx: RecipeContext): RecipeResult {
    const changes: Change[] = [];
    const messages: string[] = [];

    changes.push(...installAssets(ctx));

    const plugin = installPlugin(ctx);
    changes.push(...plugin.changes);
    messages.push(...plugin.messages);

    const hook = wireHook(ctx);
    changes.push(...hook.changes);
    messages.push(...hook.messages);

    return {
      id: this.id,
      status: ctx.dryRun ? "planned" : "applied",
      changes,
      messages,
    };
  },

  verify(ctx: RecipeContext): VerifyResult {
    const checks: VerifyResult["checks"] = [
      {
        name: "ESLint a11y config installed",
        ok: existsSync(join(ctx.scope, ".a11y", "config", "eslint")),
      },
    ];
    if (ctx.hookStrategy === "hookspath") {
      const env = detectHookEnvironment(ctx.scope, ctx.gitRoot);
      checks.push({
        name: "core.hooksPath points at .a11y/hooks",
        ok: (env.hooksPath ?? "").endsWith(".a11y/hooks"),
        ...(env.hooksPath ? { detail: env.hooksPath } : {}),
      });
    } else if (ctx.hookStrategy === "integrate") {
      const root = ctx.gitRoot ?? ctx.scope;
      checks.push({
        name: "husky pre-commit runs a11y gate",
        ok: fileContains(join(root, ".husky", "pre-commit"), "pre-commit.cjs"),
      });
    }
    return { ok: checks.every((c) => c.ok), checks };
  },
};

/** Exported for the CLI's auto-select + safety logic. */
export { FRAMEWORK_DEPS, type HookStrategy };
