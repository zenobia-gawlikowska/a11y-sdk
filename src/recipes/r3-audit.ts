import { existsSync } from "node:fs";
import { join } from "node:path";
import type {
  Change,
  Recipe,
  RecipeContext,
  RecipeResult,
  VerifyResult,
} from "./types.js";
import { copyOverwrite } from "./util.js";

function auditAssets(ctx: RecipeContext): Change[] {
  // Layer 3 is two runners: axe-core static scan (audit.cjs) + deterministic
  // behavioral recipes axe can't reach (behave.cjs).
  return [
    copyOverwrite(
      ctx,
      join(ctx.toolkitDir, "scripts", "audit.cjs"),
      join(ctx.scope, ".a11y", "scripts", "audit.cjs"),
    ),
    copyOverwrite(
      ctx,
      join(ctx.toolkitDir, "scripts", "behave.cjs"),
      join(ctx.scope, ".a11y", "scripts", "behave.cjs"),
    ),
  ];
}

export const r3Audit: Recipe = {
  id: "r3-audit",
  alias: "audit",
  title: "On-demand axe-core audit",
  idempotent: true,
  requiredFlags: [],

  apply(ctx: RecipeContext): RecipeResult {
    const changes = auditAssets(ctx);
    // Audit paths resolve relative to the invocation cwd, so a scoped install
    // just means running the script from <scope> (see docs/recipes.md).
    const invoke =
      ctx.scope === ctx.gitRoot
        ? "node .a11y/scripts/audit.cjs <url>"
        : `node ${join(".a11y", "scripts", "audit.cjs")} <url>  (run from ${ctx.scope})`;
    return {
      id: this.id,
      status: ctx.dryRun ? "planned" : "applied",
      changes,
      messages: [
        `Audit ready: ${invoke}`,
        "Requires Playwright in the target project: " +
          "npm i -D playwright @axe-core/playwright && npx playwright install chromium",
      ],
    };
  },

  verify(ctx: RecipeContext): VerifyResult {
    const checks = [
      {
        name: ".a11y/scripts/audit.cjs present",
        ok: existsSync(join(ctx.scope, ".a11y", "scripts", "audit.cjs")),
      },
      {
        name: ".a11y/scripts/behave.cjs present",
        ok: existsSync(join(ctx.scope, ".a11y", "scripts", "behave.cjs")),
      },
    ];
    return { ok: checks.every((c) => c.ok), checks };
  },
};
