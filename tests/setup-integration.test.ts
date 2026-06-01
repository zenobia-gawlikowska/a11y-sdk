import { describe, it, expect, afterEach, beforeAll } from "vitest";
import { writeFileSync, rmSync, cpSync, readFileSync, existsSync } from "node:fs";
import { spawnSync, execSync } from "node:child_process";
import { join, resolve } from "node:path";
import { initGitProject } from "./helpers/make-project";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const REPO_ROOT = resolve(__dirname, "..");
const TOOLKIT_DIR = join(REPO_ROOT, "toolkit");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const tempDirs: string[] = [];

const REQUIRED_WRAPPERS = ["wrappers/CLAUDE.md", "wrappers/.cursorrules", "wrappers/AGENTS.md"];

beforeAll(() => {
  for (const wrapper of REQUIRED_WRAPPERS) {
    const full = join(TOOLKIT_DIR, wrapper);
    if (!existsSync(full)) {
      throw new Error(`Fixture file missing: ${full}. The test suite cannot run without it.`);
    }
  }
});

function makeSetupProject(opts: { claudeMd?: string | false } = {}): string {
  const root = initGitProject("a11y-setup-");
  tempDirs.push(root);

  // Copy the entire toolkit/ dir into .a11y/ — setup.sh needs hooks/, scripts/, wrappers/
  cpSync(TOOLKIT_DIR, join(root, ".a11y"), { recursive: true });

  // No framework dep → detect-framework returns "unknown" → package install skipped
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ name: "test-project" }, null, 2),
    "utf8",
  );

  if (typeof opts.claudeMd === "string") {
    writeFileSync(join(root, "CLAUDE.md"), opts.claudeMd, "utf8");
  }

  return root;
}

function runSetup(root: string): { status: number | null; stdout: string; stderr: string } {
  // Run via the copy inside .a11y/ so BASH_SOURCE[0] resolves paths relative to the temp project
  const result = spawnSync("bash", [".a11y/scripts/setup.sh"], { cwd: root, encoding: "utf8" });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("setup.sh integration", () => {
  it("exits 0 on a fresh project", () => {
    const root = makeSetupProject();
    const { status } = runSetup(root);
    expect(status).toBe(0);
  });

  it("wires git hook: core.hooksPath set to .a11y/hooks", () => {
    const root = makeSetupProject();
    runSetup(root);
    const hooksPath = execSync("git config core.hooksPath", { cwd: root, encoding: "utf8" }).trim();
    expect(hooksPath).toBe(".a11y/hooks");
  });

  it("CLAUDE.md absent → creates from wrapper", () => {
    const root = makeSetupProject();
    const { stdout } = runSetup(root);
    const claudeMd = join(root, "CLAUDE.md");
    expect(existsSync(claudeMd)).toBe(true);
    expect(readFileSync(claudeMd, "utf8")).toContain("@.a11y/context.md");
    expect(stdout).not.toContain("already contains a11y context reference");
  });

  it("CLAUDE.md exists without marker → appends marker", () => {
    const root = makeSetupProject({ claudeMd: "# My Project\n" });
    runSetup(root);
    expect(readFileSync(join(root, "CLAUDE.md"), "utf8")).toContain("@.a11y/context.md");
  });

  it("CLAUDE.md exists with marker → guard fires, no duplicate (idempotency regression guard)", () => {
    const root = makeSetupProject({ claudeMd: "# My Project\n\n@.a11y/context.md\n" });
    const { stdout } = runSetup(root);
    const content = readFileSync(join(root, "CLAUDE.md"), "utf8");
    expect(content.split("@.a11y/context.md").length - 1).toBe(1);
    expect(stdout).toContain("already contains a11y context reference");
  });

  it("second full run is idempotent: exit 0, one CLAUDE.md marker, .cursorrules unchanged", () => {
    const root = makeSetupProject();
    runSetup(root);
    expect(existsSync(join(root, ".cursorrules"))).toBe(true);
    const cursorrulesBefore = readFileSync(join(root, ".cursorrules"), "utf8");
    const { status } = runSetup(root);
    expect(status).toBe(0);
    const content = readFileSync(join(root, "CLAUDE.md"), "utf8");
    expect(content.split("@.a11y/context.md").length - 1).toBe(1);
    expect(readFileSync(join(root, ".cursorrules"), "utf8")).toBe(cursorrulesBefore);
  });

  it("partial-state re-entry: hook pre-wired, CLAUDE.md not yet patched → setup completes correctly", () => {
    const root = makeSetupProject();
    execSync("git config core.hooksPath .a11y/hooks", { cwd: root, stdio: "pipe" });
    execSync("chmod +x .a11y/hooks/pre-commit", { cwd: root, stdio: "pipe" });
    const { status } = runSetup(root);
    expect(status).toBe(0);
    const content = readFileSync(join(root, "CLAUDE.md"), "utf8");
    expect(content.split("@.a11y/context.md").length - 1).toBe(1);
  });
});
