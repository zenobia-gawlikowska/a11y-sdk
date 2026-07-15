import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  cpSync,
  chmodSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { execSync } from "node:child_process";
import type { Change, RecipeContext } from "./types.js";

// ---------------------------------------------------------------------------
// Package-manager detection (ported from toolkit/scripts/setup.sh)
// ---------------------------------------------------------------------------

export type PackageManager = "pnpm" | "yarn" | "bun" | "npm";

export function detectPackageManager(root: string): PackageManager {
  if (existsSync(join(root, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(root, "yarn.lock"))) return "yarn";
  if (existsSync(join(root, "bun.lockb"))) return "bun";
  return "npm";
}

export function installCommand(pm: PackageManager, deps: string[]): string {
  const pkgs = deps.join(" ");
  switch (pm) {
    case "pnpm":
      return `pnpm add --save-dev ${pkgs}`;
    case "yarn":
      return `yarn add --dev ${pkgs}`;
    case "bun":
      return `bun add --dev ${pkgs}`;
    default:
      return `npm install --save-dev ${pkgs}`;
  }
}

// ---------------------------------------------------------------------------
// Hook-manager detection (drives R2 auto-select / safety, see plan §1.4)
// ---------------------------------------------------------------------------

export interface HookEnvironment {
  /** Value of git core.hooksPath, or null if unset. */
  hooksPath: string | null;
  husky: boolean;
  lintStaged: boolean;
  preCommitFramework: boolean;
}

export function detectHookEnvironment(
  scope: string,
  gitRoot: string | null,
): HookEnvironment {
  const root = gitRoot ?? scope;
  let hooksPath: string | null = null;
  try {
    const out = execSync("git config --get core.hooksPath", {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    hooksPath = out.length > 0 ? out : null;
  } catch {
    hooksPath = null;
  }

  const husky = existsSync(join(root, ".husky"));
  const preCommitFramework = existsSync(join(root, ".pre-commit-config.yaml"));

  let lintStaged = false;
  const pkgPath = join(scope, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as Record<
        string,
        unknown
      >;
      lintStaged = "lint-staged" in pkg;
    } catch {
      lintStaged = false;
    }
  }
  lintStaged =
    lintStaged ||
    existsSync(join(scope, ".lintstagedrc")) ||
    existsSync(join(scope, ".lintstagedrc.json"));

  return { hooksPath, husky, lintStaged, preCommitFramework };
}

/**
 * Whether `hooksPath` is safe to (re)set to a11y's own hooks dir. Safe when
 * unset or already pointing at an `.a11y/hooks` dir; unsafe when a foreign
 * manager owns it.
 */
export function hooksPathIsSafe(env: HookEnvironment): boolean {
  if (env.husky) return false;
  if (env.hooksPath === null) return true;
  return env.hooksPath.endsWith(".a11y/hooks");
}

// ---------------------------------------------------------------------------
// Idempotent filesystem operations. Each returns a Change describing what it
// did (or would do under dryRun); disk is only touched when dryRun is false.
// ---------------------------------------------------------------------------

function rel(scope: string, target: string): string {
  const r = relative(scope, target);
  return r === "" ? "." : r;
}

/** Copy a file/dir into place only if the destination is absent. */
export function copyIfAbsent(
  ctx: RecipeContext,
  src: string,
  dest: string,
): Change {
  const target = rel(ctx.scope, dest);
  if (existsSync(dest)) {
    return { action: "skip", target, detail: "already present" };
  }
  if (!ctx.dryRun) {
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(src, dest, { recursive: true });
  }
  return { action: "create", target };
}

/** Copy a file/dir into place, overwriting any existing destination. */
export function copyOverwrite(
  ctx: RecipeContext,
  src: string,
  dest: string,
): Change {
  const target = rel(ctx.scope, dest);
  const existed = existsSync(dest);
  if (!ctx.dryRun) {
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(src, dest, { recursive: true });
  }
  return { action: existed ? "modify" : "create", target };
}

/** Make a file executable (no-op under dryRun). */
export function makeExecutable(ctx: RecipeContext, file: string): void {
  if (ctx.dryRun) return;
  if (existsSync(file)) chmodSync(file, 0o755);
}

/**
 * Ensure `content` (typically a marker line) is present in a text file.
 * - file absent  → create from `wrapperSrc` (a template file)
 * - present, has marker → skip
 * - present, lacks marker → append marker (or wrapper body)
 */
export function ensureMarker(
  ctx: RecipeContext,
  opts: {
    file: string;
    marker: string;
    /** Template used when the file is absent. */
    wrapperSrc: string;
    /** Text appended when file exists but lacks the marker. Defaults to marker. */
    appendBody?: string;
    /** If true, never touch an existing file lacking the marker (create-only). */
    createOnly?: boolean;
  },
): Change {
  const target = rel(ctx.scope, opts.file);

  if (!existsSync(opts.file)) {
    if (!ctx.dryRun) {
      mkdirSync(dirname(opts.file), { recursive: true });
      cpSync(opts.wrapperSrc, opts.file);
    }
    return { action: "create", target };
  }

  if (opts.createOnly) {
    return { action: "skip", target, detail: "exists, create-only" };
  }

  const current = ctx.dryRun ? safeRead(opts.file) : readFileSync(opts.file, "utf8");
  if (current.includes(opts.marker)) {
    return { action: "skip", target, detail: "marker already present" };
  }

  const body = opts.appendBody ?? opts.marker;
  if (!ctx.dryRun) {
    writeFileSync(opts.file, `${current}\n\n${body}\n`, "utf8");
  }
  return { action: "append", target, detail: "added a11y marker" };
}

function safeRead(file: string): string {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

/** Text-content presence check used by verify(). */
export function fileContains(file: string, needle: string): boolean {
  return existsSync(file) && safeRead(file).includes(needle);
}

/** Resolve the git toplevel for a directory, or null. */
export function gitToplevel(dir: string): string | null {
  try {
    const out = execSync("git rev-parse --show-toplevel", {
      cwd: dir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return out.length > 0 ? resolve(out) : null;
  } catch {
    return null;
  }
}
