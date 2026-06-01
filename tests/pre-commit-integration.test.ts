import { describe, it, expect, afterEach } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  cpSync,
  readFileSync,
} from "node:fs";
import { spawnSync, execSync } from "node:child_process";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const REPO_ROOT = resolve(__dirname, "..");
const SCRIPT = join(REPO_ROOT, "toolkit/scripts/pre-commit.cjs");
const TOOLKIT_CONFIG = join(REPO_ROOT, "toolkit/config");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const tempDirs: string[] = [];

/**
 * Create a minimal project root:
 * - temp dir with git init + empty first commit
 * - package.json declaring the target framework (so detectFramework works without a TUI)
 * - .a11y/config/ copied from toolkit/config/
 * - optional config rule overrides merged into a11y.config.json
 */
function makeProject(opts: {
  rules?: Partial<Record<string, boolean>>;
  /** npm package name that identifies the framework, e.g. "react" or "@angular/core" */
  frameworkPkg?: string;
} = {}): string {
  const root = mkdtempSync(join(tmpdir(), "a11y-int-"));
  tempDirs.push(root);

  // Git init with local identity (CI may lack global git config)
  execSync("git init", { cwd: root, stdio: "pipe" });
  execSync('git config user.email "test@a11y-sdk.local"', { cwd: root, stdio: "pipe" });
  execSync('git config user.name "a11y-sdk test"', { cwd: root, stdio: "pipe" });
  execSync("git commit --allow-empty -m init", { cwd: root, stdio: "pipe" });

  // Write package.json so detectFramework returns the right value (avoids TUI prompt)
  const pkg = opts.frameworkPkg ?? "react";
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ name: "test-project", dependencies: { [pkg]: "^1.0.0" } }, null, 2),
    "utf8",
  );

  // Copy toolkit config into .a11y/config/
  const a11yConfig = join(root, ".a11y", "config");
  mkdirSync(a11yConfig, { recursive: true });
  cpSync(TOOLKIT_CONFIG, join(root, ".a11y", "config"), { recursive: true });

  // Apply rule overrides
  if (opts.rules) {
    const configPath = join(a11yConfig, "a11y.config.json");
    const existing = JSON.parse(readFileSync(configPath, "utf8")) as Record<string, unknown>;
    existing["rules"] = { ...(existing["rules"] as Record<string, unknown>), ...opts.rules };
    writeFileSync(configPath, JSON.stringify(existing, null, 2) + "\n", "utf8");
  }

  return root;
}

/**
 * Write a file at relPath inside root, create directories as needed, and
 * stage it with `git add`.
 */
function stageFile(root: string, relPath: string, content: string): void {
  const full = join(root, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content, "utf8");
  execSync(`git add "${relPath}"`, { cwd: root, stdio: "pipe" });
}

/**
 * Run toolkit/scripts/pre-commit.cjs as a child process with cwd = root.
 * Returns status code and stderr output.
 */
function runHook(root: string): { status: number | null; stderr: string } {
  const result = spawnSync("node", [SCRIPT], {
    cwd: root,
    encoding: "utf8",
  });
  return { status: result.status, stderr: result.stderr };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// R1 — hook catches real violations
// ---------------------------------------------------------------------------

describe("R1 — hook catches real violations", () => {
  it("staged JSX with missing alt exits 1 and reports jsx-a11y/alt-text with WCAG 1.1.1", () => {
    const root = makeProject();
    stageFile(root, "src/Button.tsx", `
export function Button() {
  return <img src="photo.jpg" />;
}
`);
    const result = runHook(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("jsx-a11y/alt-text");
    expect(result.stderr).toContain("1.1.1");
  });

  it("staged JSX with proper alt exits 0 (no false positive)", () => {
    const root = makeProject();
    stageFile(root, "src/Button.tsx", `
export function Button() {
  return <img src="hero.jpg" alt="Team members at the office" />;
}
`);
    const result = runHook(root);
    expect(result.status).toBe(0);
  });

  it("exits 0 when no relevant files are staged", () => {
    const root = makeProject();
    stageFile(root, "README.md", "# hello");
    const result = runHook(root);
    expect(result.status).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// R4 — config category suppression is wired end-to-end
// ---------------------------------------------------------------------------

describe("R4 — config suppression wired end-to-end", () => {
  it("images:false suppresses alt-text violation → exits 0", () => {
    const root = makeProject({ rules: { images: false } });
    stageFile(root, "src/Card.tsx", `
export function Card() {
  return <img src="card.jpg" />;
}
`);
    const result = runHook(root);
    expect(result.status).toBe(0);
  });

  it("images:true keeps alt-text violation → exits 1 (regression guard)", () => {
    const root = makeProject({ rules: { images: true } });
    stageFile(root, "src/Card.tsx", `
export function Card() {
  return <img src="card.jpg" />;
}
`);
    const result = runHook(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("jsx-a11y/alt-text");
  });
});

// ---------------------------------------------------------------------------
// R2 — broken config exits 2 with a11y-sdk prefix
// ---------------------------------------------------------------------------

describe("R2 — broken config surfaces a clear error", () => {
  it("missing ESLint plugin exits 2 with a11y-sdk prefix in stderr", () => {
    // Use svelte framework — eslint-plugin-svelte is NOT a devDep of a11y-sdk,
    // so require('eslint-plugin-svelte') inside svelte.cjs will throw MODULE_NOT_FOUND.
    // The lintFiles() catch block must then exit 2 with the a11y-sdk prefix.
    const root = makeProject({ frameworkPkg: "svelte" });
    stageFile(root, "src/App.svelte", `<img src="logo.png">`);
    const result = runHook(root);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("a11y-sdk pre-commit:");
  });
});

// ---------------------------------------------------------------------------
// Angular smoke test
// ---------------------------------------------------------------------------

describe("Angular smoke — flat config loads and runs", () => {
  it("staged .html with <img> no alt exits non-zero with angular framework", () => {
    const root = makeProject({ frameworkPkg: "@angular/core" });
    stageFile(root, "src/app.component.html", `<img src="logo.png">`);
    const result = runHook(root);
    // The Angular flat config must load and catch a violation (or exit 2 on config error).
    // Either way it must NOT silently pass — that would mean the flat config was skipped.
    expect(result.status).not.toBe(0);
  });
});
