import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectFramework } from "../src/detect-framework.js";

function makeRoot(deps: Record<string, string> = {}): string {
  const root = mkdtempSync(join(tmpdir(), "a11y-sdk-fw-"));
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ name: "test-project", dependencies: deps }),
    "utf8",
  );
  return root;
}

describe("detectFramework", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const r of roots.splice(0)) {
      rmSync(r, { recursive: true, force: true });
    }
  });

  function root(deps: Record<string, string>): string {
    const r = makeRoot(deps);
    roots.push(r);
    return r;
  }

  it("returns 'react' when react is in dependencies", () => {
    expect(detectFramework(root({ react: "^18.0.0" }))).toBe("react");
  });

  it("returns 'vue' when vue is in dependencies", () => {
    expect(detectFramework(root({ vue: "^3.0.0" }))).toBe("vue");
  });

  it("returns 'svelte' when svelte is in dependencies", () => {
    expect(detectFramework(root({ svelte: "^4.0.0" }))).toBe("svelte");
  });

  it("returns 'angular' when @angular/core is in dependencies", () => {
    expect(detectFramework(root({ "@angular/core": "^17.0.0" }))).toBe(
      "angular",
    );
  });

  it("returns 'angular' when both react and @angular/core are present (angular wins)", () => {
    expect(
      detectFramework(root({ react: "^18.0.0", "@angular/core": "^17.0.0" })),
    ).toBe("angular");
  });

  it("reads devDependencies as well as dependencies", () => {
    const r = mkdtempSync(join(tmpdir(), "a11y-sdk-fw-"));
    roots.push(r);
    writeFileSync(
      join(r, "package.json"),
      JSON.stringify({
        name: "test",
        dependencies: {},
        devDependencies: { react: "^18.0.0" },
      }),
      "utf8",
    );
    expect(detectFramework(r)).toBe("react");
  });

  it("returns 'unknown' when no recognised framework is present", () => {
    expect(detectFramework(root({ lodash: "^4.0.0" }))).toBe("unknown");
  });

  it("returns 'unknown' when package.json is absent", () => {
    const r = mkdtempSync(join(tmpdir(), "a11y-sdk-fw-"));
    roots.push(r);
    // No package.json created
    expect(detectFramework(r)).toBe("unknown");
  });
});
