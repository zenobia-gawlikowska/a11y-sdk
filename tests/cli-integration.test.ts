import { describe, it, expect, afterEach } from "vitest";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, resolve } from "node:path";
import { initGitProject } from "./helpers/make-project";
import { runCli, type CliEnv } from "../src/cli";

const REPO_ROOT = resolve(__dirname, "..");
const TOOLKIT_DIR = join(REPO_ROOT, "toolkit");

const tempDirs: string[] = [];

function project(opts: { pkg?: object } = {}): string {
  const root = initGitProject("a11y-cli-");
  tempDirs.push(root);
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify(opts.pkg ?? { name: "test" }, null, 2),
    "utf8",
  );
  return root;
}

function env(cwd: string, over: Partial<CliEnv> = {}): CliEnv {
  return {
    cwd,
    toolkitDir: TOOLKIT_DIR,
    version: "0.2.0",
    interactive: false,
    ...over,
  };
}

function hooksPath(root: string): string | null {
  try {
    const v = execSync("git config --get core.hooksPath", { cwd: root, encoding: "utf8" }).trim();
    return v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("recipes manifest", () => {
  it("lists all three recipes with aliases", async () => {
    const out = await runCli(["recipes", "--json"], env(process.cwd()));
    expect(out.exitCode).toBe(0);
    const manifest = out.json as { recipes: Array<{ id: string; alias: string }> };
    expect(manifest.recipes.map((r) => r.id)).toEqual([
      "r1-context",
      "r2-commit-gate",
      "r3-audit",
    ]);
    expect(manifest.recipes.map((r) => r.alias)).toEqual(["context", "lint", "audit"]);
  });
});

describe("init — dry-run", () => {
  it("writes nothing and gates R2 behind consent when non-interactive", async () => {
    const root = project({ pkg: { name: "d", dependencies: { react: "^18" } } });
    const out = await runCli(["init", "--dry-run"], env(root));
    expect(out.exitCode).toBe(0);
    expect(existsSync(join(root, ".a11y"))).toBe(false);
    expect(existsSync(join(root, "CLAUDE.md"))).toBe(false);
    expect(out.stdout).toContain("needs-consent");
  });
});

describe("init — apply", () => {
  it("installs R1 + R3 assets and patches the chosen AI file", async () => {
    const root = project();
    const out = await runCli(
      ["init", "--only", "context,audit", "--ai", "claude"],
      env(root),
    );
    expect(out.exitCode).toBe(0);
    expect(existsSync(join(root, ".a11y", "context.md"))).toBe(true);
    expect(existsSync(join(root, ".a11y", "rules", "focus-trap.md"))).toBe(true);
    expect(existsSync(join(root, ".a11y", "scripts", "audit.cjs"))).toBe(true);
    expect(readFileSync(join(root, "CLAUDE.md"), "utf8")).toContain("@.a11y/context.md");
    // R2 assets were not touched by --only context,audit
    expect(existsSync(join(root, ".a11y", "config", "eslint"))).toBe(false);
  });

  it("is idempotent: a second run only skips", async () => {
    const root = project();
    await runCli(["init", "--only", "context", "--ai", "claude"], env(root));
    const out = await runCli(["init", "--only", "context", "--ai", "claude", "--json"], env(root));
    const res = (out.json as { recipes: Array<{ changes: Array<{ action: string }> }> }).recipes[0]!;
    expect(res.changes.every((c) => c.action === "skip")).toBe(true);
    // marker not duplicated
    const claude = readFileSync(join(root, "CLAUDE.md"), "utf8");
    expect(claude.split("@.a11y/context.md").length - 1).toBe(1);
  });

  it(".cursorrules is create-only (never overwritten)", async () => {
    const root = project();
    writeFileSync(join(root, ".cursorrules"), "# my rules\n", "utf8");
    await runCli(["init", "--only", "context", "--ai", "cursor"], env(root));
    expect(readFileSync(join(root, ".cursorrules"), "utf8")).toBe("# my rules\n");
  });

  it("pre-existing create-only file passes verify (not a failure)", async () => {
    const root = project();
    writeFileSync(join(root, ".cursorrules"), "# my rules\n", "utf8");
    const out = await runCli(
      ["init", "--only", "context", "--ai", "cursor", "--json"],
      env(root),
    );
    const verify = (out.json as { verify: Array<{ id: string; ok: boolean }> }).verify;
    expect(verify.find((v) => v.id === "r1-context")?.ok).toBe(true);
    expect(out.stdout).not.toContain("FAILED");
  });
});

describe("R2 hook-strategy split (plan §1.4)", () => {
  it("standalone + --yes → hookspath sets core.hooksPath", async () => {
    const root = project({ pkg: { name: "s", dependencies: { react: "^18" } } });
    const out = await runCli(
      ["init", "--only", "lint", "--yes", "--no-install"],
      env(root),
    );
    expect(out.exitCode).toBe(0);
    expect(hooksPath(root)).toBe(".a11y/hooks");
    expect(existsSync(join(root, ".a11y", "config", "eslint", "react.cjs"))).toBe(true);
  });

  it("non-interactive default init → R2 skipped, hooks untouched", async () => {
    const root = project({ pkg: { name: "s", dependencies: { react: "^18" } } });
    const out = await runCli(["init", "--no-install"], env(root));
    expect(out.stdout).toContain("needs-consent");
    expect(hooksPath(root)).toBeNull();
  });

  it("husky present + explicit hookspath → refused with exit 2", async () => {
    const root = project({ pkg: { name: "h", dependencies: { react: "^18" } } });
    mkdirSync(join(root, ".husky"));
    const out = await runCli(
      ["init", "--only", "lint", "--yes", "--hook-strategy", "hookspath"],
      env(root),
    );
    expect(out.exitCode).toBe(2);
    expect(out.stderr).toContain("refusing hookspath");
    expect(hooksPath(root)).toBeNull();
  });

  it("--only including lint among other recipes is NOT consent", async () => {
    const root = project({ pkg: { name: "s", dependencies: { react: "^18" } } });
    const out = await runCli(
      ["init", "--only", "context,lint,audit", "--no-install"],
      env(root),
    );
    expect(out.stdout).toContain("needs-consent");
    expect(hooksPath(root)).toBeNull();
  });

  it("explicit hookspath with an embedded --scope is refused (repo-global setting)", async () => {
    const root = project({ pkg: { name: "m" } });
    mkdirSync(join(root, "packages", "app"), { recursive: true });
    writeFileSync(
      join(root, "packages", "app", "package.json"),
      JSON.stringify({ name: "app", dependencies: { react: "^18" } }),
      "utf8",
    );
    const out = await runCli(
      ["init", "--scope", "packages/app", "--only", "lint", "--yes", "--no-install", "--hook-strategy", "hookspath"],
      env(root),
    );
    expect(out.exitCode).toBe(2);
    expect(out.stderr).toContain("refusing hookspath");
    expect(hooksPath(root)).toBeNull();
  });

  it("husky present + auto → integrate wires .husky/pre-commit, hooksPath untouched", async () => {
    const root = project({ pkg: { name: "h", dependencies: { react: "^18" } } });
    mkdirSync(join(root, ".husky"));
    const out = await runCli(["init", "--only", "lint", "--yes", "--no-install"], env(root));
    expect(out.exitCode).toBe(0);
    expect(readFileSync(join(root, ".husky", "pre-commit"), "utf8")).toContain(
      "pre-commit.cjs",
    );
    expect(hooksPath(root)).toBeNull();
  });
});

describe("embedded scope (plan §1.3)", () => {
  it("--scope installs into the subdir and never hijacks the product repo hooks", async () => {
    const root = project({ pkg: { name: "root" } });
    mkdirSync(join(root, "context"));
    const out = await runCli(
      ["init", "--scope", "context", "--only", "lint", "--yes", "--no-install"],
      env(root),
    );
    expect(out.exitCode).toBe(0);
    expect(existsSync(join(root, "context", ".a11y", "config", "eslint"))).toBe(true);
    expect(existsSync(join(root, ".a11y"))).toBe(false);
    // embedded → auto ci-step → no local git config change
    expect(hooksPath(root)).toBeNull();
    expect(out.stdout).toContain("ci-step");
  });
});

describe("emit ci (plan §1.5)", () => {
  it("github snippet pins the tag and runs the lint gate", async () => {
    const out = await runCli(["emit", "ci", "--provider", "github"], env(process.cwd()));
    expect(out.exitCode).toBe(0);
    expect(out.stdout).toContain("a11y-sdk@v0.2.0 init --only lint");
    expect(out.stdout).toContain("actions/checkout");
  });

  it("bitbucket snippet targets the scope", async () => {
    const out = await runCli(
      ["emit", "ci", "--provider", "bitbucket", "--scope", "context"],
      env(process.cwd()),
    );
    expect(out.stdout).toContain("bitbucket-pipelines.yml");
    expect(out.stdout).toContain("--scope context");
  });

  it("lint step runs the framework-correct ESLint config", async () => {
    const root = project({ pkg: { name: "v", dependencies: { vue: "^3" } } });
    const out = await runCli(["emit", "ci"], env(root));
    expect(out.stdout).toContain(".a11y/config/eslint/vue.cjs");
    expect(out.stdout).not.toContain("react.cjs");
  });

  it("undetected framework falls back to react with an adjust hint", async () => {
    const root = project({ pkg: { name: "u" } });
    const out = await runCli(["emit", "ci", "--provider", "bitbucket"], env(root));
    expect(out.stdout).toContain(".a11y/config/eslint/react.cjs");
    expect(out.stdout).toContain("Framework not detected");
  });

  it("--framework overrides detection", async () => {
    const root = project({ pkg: { name: "v", dependencies: { vue: "^3" } } });
    const out = await runCli(["emit", "ci", "--framework", "svelte"], env(root));
    expect(out.stdout).toContain(".a11y/config/eslint/svelte.cjs");
  });
});

describe("argument validation", () => {
  it("rejects unknown --ai", async () => {
    const root = project();
    const out = await runCli(["init", "--ai", "bogus"], env(root));
    expect(out.exitCode).toBe(2);
    expect(out.stderr).toContain("unknown --ai");
  });

  it("rejects unknown --only recipe", async () => {
    const root = project();
    const out = await runCli(["init", "--only", "nope"], env(root));
    expect(out.exitCode).toBe(2);
    expect(out.stderr).toContain("unknown --only");
  });

  it("rejects unknown command", async () => {
    const out = await runCli(["frobnicate"], env(process.cwd()));
    expect(out.exitCode).toBe(2);
    expect(out.stderr).toContain("unknown command");
  });

  it("rejects unknown --provider on init (same rule as emit ci)", async () => {
    const root = project();
    const out = await runCli(["init", "--provider", "gitlab"], env(root));
    expect(out.exitCode).toBe(2);
    expect(out.stderr).toContain("unknown --provider");
  });

  it("audit rejects unknown flags instead of losing the URL", async () => {
    const out = await runCli(
      ["audit", "--somethingunknown", "http://localhost:3000"],
      env(process.cwd()),
    );
    expect(out.exitCode).toBe(2);
    expect(out.stderr).toContain("unknown audit flag");
  });
});
