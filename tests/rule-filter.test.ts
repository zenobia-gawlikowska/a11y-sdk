import { describe, it, expect } from "vitest";
import { isRuleEnabled, CATEGORY_RULE_PREFIXES } from "../src/rule-filter.js";
import { defaultConfig } from "../src/config-loader.js";
import type { A11yConfig } from "../src/config-loader.js";

function configWith(overrides: Partial<A11yConfig["rules"]>): A11yConfig {
  return {
    wcagLevel: "AA",
    rules: { ...defaultConfig.rules, ...overrides },
  };
}

describe("isRuleEnabled", () => {
  // --- R4 core: images category ---

  it("returns false for jsx-a11y/alt-text when images is false", () => {
    const config = configWith({ images: false });
    expect(isRuleEnabled("jsx-a11y/alt-text", config)).toBe(false);
  });

  it("returns true for jsx-a11y/alt-text when images is true (R4 regression guard)", () => {
    const config = configWith({ images: true });
    expect(isRuleEnabled("jsx-a11y/alt-text", config)).toBe(true);
  });

  it("returns false for jsx-a11y/img-redundant-alt when images is false", () => {
    const config = configWith({ images: false });
    expect(isRuleEnabled("jsx-a11y/img-redundant-alt", config)).toBe(false);
  });

  // --- Different category: aria-roles ---

  it("returns false for jsx-a11y/aria-role when aria-roles is false", () => {
    const config = configWith({ "aria-roles": false });
    expect(isRuleEnabled("jsx-a11y/aria-role", config)).toBe(false);
  });

  it("returns true for jsx-a11y/aria-role when aria-roles is true", () => {
    const config = configWith({ "aria-roles": true });
    expect(isRuleEnabled("jsx-a11y/aria-role", config)).toBe(true);
  });

  // --- Default config baseline ---

  it("returns true for all known rules when all categories are enabled (default config)", () => {
    const knownRules = [
      "jsx-a11y/alt-text",
      "jsx-a11y/aria-role",
      "jsx-a11y/label-has-associated-control",
      "jsx-a11y/click-events-have-key-events",
      "jsx-a11y/html-has-lang",
    ];
    for (const rule of knownRules) {
      expect(isRuleEnabled(rule, defaultConfig), `rule: ${rule}`).toBe(true);
    }
  });

  // --- Unknown rule passthrough ---

  it("returns true for a rule with no matching prefix regardless of disabled categories", () => {
    const config = configWith({
      images: false,
      "aria-roles": false,
      "form-labeling": false,
    });
    expect(isRuleEnabled("jsx-a11y/some-unknown-rule", config)).toBe(true);
    expect(isRuleEnabled("completely-unknown", config)).toBe(true);
  });

  // --- Category isolation ---

  it("disabling images does not suppress aria-role violations", () => {
    const config = configWith({ images: false });
    expect(isRuleEnabled("jsx-a11y/aria-role", config)).toBe(true);
  });

  it("disabling aria-roles does not suppress alt-text violations", () => {
    const config = configWith({ "aria-roles": false });
    expect(isRuleEnabled("jsx-a11y/alt-text", config)).toBe(true);
  });

  // --- Rule IDs without plugin namespace ---

  it("handles short rule IDs (no namespace) correctly", () => {
    const config = configWith({ images: false });
    // Short form — as if the rule ID comes in without "jsx-a11y/" prefix
    expect(isRuleEnabled("alt-text", config)).toBe(false);
    expect(isRuleEnabled("aria-role", config)).toBe(true); // images disabled, not aria-roles
  });

  // --- CATEGORY_RULE_PREFIXES sanity check ---

  it("CATEGORY_RULE_PREFIXES contains the images category with expected prefixes", () => {
    expect(CATEGORY_RULE_PREFIXES["images"]).toContain("alt-text");
    expect(CATEGORY_RULE_PREFIXES["images"]).toContain("img-redundant-alt");
  });
});
