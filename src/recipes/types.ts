import type { Framework } from "../detect-framework.js";

// ---------------------------------------------------------------------------
// Recipe surface — the public contract a third party (e.g. sl-aipdlc-devkit)
// invokes at a pinned tag. Each recipe is one layer of a11y enforcement.
// ---------------------------------------------------------------------------

export type RecipeId = "r1-context" | "r2-commit-gate" | "r3-audit";

/** Short alias accepted by `--only` (maps 1:1 onto a RecipeId). */
export type RecipeAlias = "context" | "lint" | "audit";

/** AI config surfaces R1 can patch. */
export type AiTarget = "claude" | "copilot" | "cursor" | "agents";

/**
 * How R2 wires the commit gate. `core.hooksPath` is repo-global, so it must
 * never be forced onto a product repo that already manages hooks — hence the
 * split (see plan §1.4).
 */
export type HookStrategy = "hookspath" | "integrate" | "ci-step" | "none";

export type CiProvider = "github" | "bitbucket";

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
  /** Explicit consent for workflow-modifying recipes (R2). */
  consent: boolean;
  /** Whether the invocation is attached to a TTY. */
  interactive: boolean;
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

export interface DetectResult {
  /** Whether this recipe applies to the current context. */
  applicable: boolean;
  /** Whether the recipe's effect is already fully present (idempotency). */
  alreadyApplied: boolean;
  notes?: string[];
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
  detect(ctx: RecipeContext): DetectResult;
  plan(ctx: RecipeContext): Change[];
  apply(ctx: RecipeContext): RecipeResult;
  verify(ctx: RecipeContext): VerifyResult;
}
