import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";

/**
 * Create a temp directory with a git repo initialised and ready for testing.
 * Sets a local user identity so tests work in CI environments without a global
 * git config. Caller is responsible for cleanup (e.g. rmSync in afterEach).
 */
export function initGitProject(prefix = "a11y-"): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  execSync("git init", { cwd: root, stdio: "pipe" });
  execSync('git config user.email "test@a11y-sdk.local"', { cwd: root, stdio: "pipe" });
  execSync('git config user.name "a11y-sdk test"', { cwd: root, stdio: "pipe" });
  execSync("git commit --allow-empty -m init", { cwd: root, stdio: "pipe" });
  return root;
}
