import type { Framework } from "../detect-framework.js";

// ---------------------------------------------------------------------------
// Recipe surface — the public contract a third party (e.g. sl-aipdlc-devkit)
// invokes at a pinned tag. Each recipe is one layer of a11y enforcement.
// ---------------------------------------------------------------------------

export type RecipeId = "r1-context" | "r2-commit-gate" | "r3-audit";

/** Short alias accepted by `--only` (maps 1:1 onto a RecipeId). */
export type RecipeAlias = "context" | "lint" | "audit";

// Value arrays are the single source of truth for the unions below — CLI flag
// validation and help text derive from them, so adding a variant here is
// automatically accepted (and advertised) everywhere.

/** AI config surfaces R1 can patch. */
export const AI_TARGETS = ["claude", "copilot", "cursor", "agents"] as const;
export type AiTarget = (typeof AI_TARGETS)[number];

/**
 * How R2 wires the commit gate. `core.hooksPath` is repo-global, so it must
 * never be forced onto a product repo that already manages hooks — hence the
 * split (see plan §1.4).
 */
export const HOOK_STRATEGIES = ["hookspath", "integrate", "ci-step", "none"] as const;
export type HookStrategy = (typeof HOOK_STRATEGIES)[number];

export const CI_PROVIDERS = ["github", "bitbucket"] as const;
export type CiProvider = (typeof CI_PROVIDERS)[number];

/**
 * Resolved, immutable context handed to every recipe. The CLI builds this once
 * from flags + environment detection; recipes never re-read argv.
 */
export interface RecipeContext {
  /** Absolute install target. Equals gitRoot in standalone mode. */
  scope: string;
  /** Absolute git toplevel, or null if scope is not inside a git repo. */
  gitRoot: string | null;
  /** Absolute path to the bundled `toolkit/` asset source. */
  toolkitDir: string;
  framework: Framework;
  ai: AiTarget[];
  hookStrategy: HookStrategy;
  /** Describe changes without touching disk. */
  dryRun: boolean;
  /** Run the package-manager install for the ESLint plugin (R2). */
  installDeps: boolean;
  provider: CiProvider;
  /** Version tag this installer pins to (for emitted CI snippets). */
  version: string;
}

export type ChangeAction =
  | "create"
  | "append"
  | "modify"
  | "skip"
  | "exec"
  | "config";

export interface Change {
  action: ChangeAction;
  /** Path relative to scope where meaningful, else a short descriptor. */
  target: string;
  detail?: string;
}

export type RecipeStatus =
  | "applied"
  | "planned"
  | "skipped"
  | "needs-consent"
  | "not-applicable"
  | "error";

export interface RecipeResult {
  id: RecipeId;
  status: RecipeStatus;
  changes: Change[];
  messages: string[];
  error?: string;
}

export interface VerifyResult {
  ok: boolean;
  checks: Array<{ name: string; ok: boolean; detail?: string }>;
}

export interface Recipe {
  id: RecipeId;
  alias: RecipeAlias;
  title: string;
  /** Re-runs skip already-wired targets. */
  idempotent: boolean;
  /** Flags a caller must pass for a non-interactive apply (e.g. consent). */
  requiredFlags: string[];
  /** Idempotent install; describes (without writing) when ctx.dryRun is set. */
  apply(ctx: RecipeContext): RecipeResult;
  verify(ctx: RecipeContext): VerifyResult;
}
