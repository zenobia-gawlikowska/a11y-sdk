import { describe, it, expect, afterEach } from "vitest";
import {
  mkdirSync,
  writeFileSync,
  rmSync,
  cpSync,
  readFileSync,
} from "node:fs";
import { spawnSync, execSync } from "node:child_process";
import { join, resolve, dirname } from "node:path";
import { initGitProject } from "./helpers/make-project";

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
  const root = initGitProject("a11y-int-");
  tempDirs.push(root);

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
// R5 — source-level contract checks run at commit time
// ---------------------------------------------------------------------------

describe("R5 — contract checks catch static contract violations", () => {
  it("role=dialog without aria-modal exits 1 and reports a11y-sdk/dialog-contract", () => {
    const root = makeProject();
    stageFile(root, "src/Modal.tsx", `
export function Modal() {
  return <div role="dialog" aria-labelledby="modal-title"><h2 id="modal-title">Hi</h2></div>;
}
`);
    const result = runHook(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("a11y-sdk/dialog-contract");
    expect(result.stderr).toContain("4.1.2");
  });

  it("a complete dialog exits 0", () => {
    const root = makeProject();
    stageFile(root, "src/Modal.tsx", `
export function Modal() {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <h2 id="modal-title">Hi</h2>
    </div>
  );
}
`);
    const result = runHook(root);
    expect(result.status).toBe(0);
  });

  it("staged stylesheet with px font-size exits 1 without needing ESLint", () => {
    const root = makeProject();
    stageFile(root, "src/styles/card.css", `.card { font-size: 14px; }`);
    const result = runHook(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("a11y-sdk/no-px-font-size");
    expect(result.stderr).toContain("1.4.4");
  });

  it("personal-data input without autocomplete exits 1 with the suggested token", () => {
    const root = makeProject();
    stageFile(root, "src/Form.tsx", `
export function Form() {
  return (
    <label>
      Email
      <input type="email" name="contact-email" />
    </label>
  );
}
`);
    const result = runHook(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("a11y-sdk/autocomplete-required");
    expect(result.stderr).toContain('autocomplete="email"');
  });
});

// ---------------------------------------------------------------------------
// R2 — broken config exits 2 with a11y-sdk prefix
// ---------------------------------------------------------------------------

describe("R2 — broken config surfaces a clear error", () => {
  it("malformed a11y.config.json exits 2 with a11y-sdk prefix in stderr", () => {
    // Overwrite the copied config with invalid JSON so loadConfig() throws,
    // triggering the exit-2 path regardless of which plugins are installed.
    const root = makeProject({ frameworkPkg: "react" });
    writeFileSync(
      join(root, ".a11y", "config", "a11y.config.json"),
      "{ this is not valid json }",
      "utf8",
    );
    stageFile(root, "src/App.jsx", `<img src="logo.png">`);
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
