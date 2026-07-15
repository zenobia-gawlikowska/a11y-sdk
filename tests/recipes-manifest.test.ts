import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildManifest } from "../src/cli";
import { VERSION } from "../src/index";

const REPO_ROOT = resolve(__dirname, "..");

// recipes.json is published (package.json "files") as the machine-readable
// catalog external callers introspect. Nothing regenerates it automatically,
// so this guard fails CI whenever it drifts from the in-code registry.
describe("published recipes.json stays in sync", () => {
  it("matches the live registry (re-run `npm run gen:recipes` after registry changes)", () => {
    const committed: unknown = JSON.parse(
      readFileSync(join(REPO_ROOT, "recipes.json"), "utf8"),
    );
    expect(committed).toEqual(buildManifest(VERSION));
  });

  it("VERSION constant matches package.json", () => {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
      version: string;
    };
    expect(VERSION).toBe(pkg.version);
  });
});
