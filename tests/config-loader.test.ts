import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig, defaultConfig } from "../src/config-loader.js";

function makeProjectRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "a11y-sdk-test-"));
  mkdirSync(join(root, ".a11y", "config"), { recursive: true });
  return root;
}

function writeConfig(root: string, content: string): void {
  writeFileSync(join(root, ".a11y", "config", "a11y.config.json"), content, "utf8");
}

describe("loadConfig", () => {
  let root: string;

  beforeEach(() => {
    root = makeProjectRoot();
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("parses a valid config file and returns the typed object", () => {
    writeConfig(
      root,
      JSON.stringify({
        wcagLevel: "AA",
        rules: {
          "focus-management": true,
          "aria-roles": false,
          "keyboard-navigation": true,
          "color-contrast": false,
          "form-labeling": true,
          "landmark-structure": true,
          "live-regions": true,
          images: false,
        },
      }),
    );

    const config = loadConfig(root);

    expect(config.wcagLevel).toBe("AA");
    expect(config.rules["aria-roles"]).toBe(false);
    expect(config.rules["color-contrast"]).toBe(false);
    expect(config.rules.images).toBe(false);
    expect(config.rules["focus-management"]).toBe(true);
  });

  it("accepts wcagLevel: AAA", () => {
    writeConfig(
      root,
      JSON.stringify({
        wcagLevel: "AAA",
        rules: {
          "focus-management": true,
          "aria-roles": true,
          "keyboard-navigation": true,
          "color-contrast": true,
          "form-labeling": true,
          "landmark-structure": true,
          "live-regions": true,
          images: true,
        },
      }),
    );

    const config = loadConfig(root);
    expect(config.wcagLevel).toBe("AAA");
  });

  it("returns defaults when the config file is absent", () => {
    // Remove the directory so ENOENT is triggered
    rmSync(join(root, ".a11y"), { recursive: true, force: true });

    const config = loadConfig(root);

    expect(config).toEqual(defaultConfig);
    // Returned object is a copy, not the shared reference
    config.rules.images = false;
    expect(defaultConfig.rules.images).toBe(true);
  });

  it("throws a descriptive error on malformed JSON", () => {
    writeConfig(root, "{ this is: not json }");

    expect(() => loadConfig(root)).toThrowError(
      /malformed JSON/i,
    );
  });

  it("throws when wcagLevel is an unexpected value", () => {
    writeConfig(
      root,
      JSON.stringify({
        wcagLevel: "A",
        rules: {
          "focus-management": true,
          "aria-roles": true,
          "keyboard-navigation": true,
          "color-contrast": true,
          "form-labeling": true,
          "landmark-structure": true,
          "live-regions": true,
          images: true,
        },
      }),
    );

    expect(() => loadConfig(root)).toThrowError(
      /invalid config shape/i,
    );
  });

  it("throws when a rule flag is missing", () => {
    writeConfig(
      root,
      JSON.stringify({
        wcagLevel: "AA",
        rules: {
          "focus-management": true,
          // "aria-roles" is intentionally omitted
          "keyboard-navigation": true,
          "color-contrast": true,
          "form-labeling": true,
          "landmark-structure": true,
          "live-regions": true,
          images: true,
        },
      }),
    );

    expect(() => loadConfig(root)).toThrowError(
      /invalid config shape/i,
    );
  });
});
