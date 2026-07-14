import { describe, it, expect } from "vitest";
import {
  formatBehaveResults,
  exitCodeFor,
  ALL_RECIPES,
} from "../src/behave.ts";
import type { RecipeResult } from "../src/behave.ts";

const results: RecipeResult[] = [
  { recipe: "reflow-320", wcag: "1.4.10 Reflow", status: "pass", details: [] },
  {
    recipe: "dialog",
    wcag: "2.1.2 No Keyboard Trap / 4.1.2 Name, Role, Value",
    status: "fail",
    details: ['Dialog is missing aria-modal="true".'],
  },
  {
    recipe: "autocomplete",
    wcag: "1.3.5 Identify Input Purpose",
    status: "warn",
    details: ["<input type=\"email\"> has no autocomplete attribute."],
  },
  {
    recipe: "menu-keyboard",
    wcag: '2.1.1 Keyboard (role="menu" contract)',
    status: "skipped",
    details: ['No role="menu" or role="menubar" on the page.'],
  },
];

describe("formatBehaveResults", () => {
  it("handles an empty result set", () => {
    expect(formatBehaveResults([])).toBe("No behavioral checks were run.");
  });

  it("orders results fail → warn → pass → skipped", () => {
    const output = formatBehaveResults(results);
    const failPos = output.indexOf("✖ dialog");
    const warnPos = output.indexOf("⚠ autocomplete");
    const passPos = output.indexOf("✔ reflow-320");
    const skipPos = output.indexOf("– menu-keyboard");
    expect(failPos).toBeGreaterThanOrEqual(0);
    expect(failPos).toBeLessThan(warnPos);
    expect(warnPos).toBeLessThan(passPos);
    expect(passPos).toBeLessThan(skipPos);
  });

  it("includes detail lines and a summary count line", () => {
    const output = formatBehaveResults(results);
    expect(output).toContain('Dialog is missing aria-modal="true".');
    expect(output).toContain("1 failed, 1 warning(s), 1 passed, 1 not applicable.");
  });

  it("caps very long detail lists", () => {
    const many: RecipeResult = {
      recipe: "focus-visible",
      wcag: "2.4.7 Focus Visible",
      status: "fail",
      details: Array.from({ length: 20 }, (_, i) => `offender ${i}`),
    };
    const output = formatBehaveResults([many]);
    expect(output).toContain("offender 11");
    expect(output).not.toContain("offender 12");
    expect(output).toContain("…and 8 more");
  });
});

describe("exitCodeFor", () => {
  it("returns 1 when any recipe failed", () => {
    expect(exitCodeFor(results)).toBe(1);
  });

  it("returns 0 for warns/passes/skips only", () => {
    expect(exitCodeFor(results.filter((r) => r.status !== "fail"))).toBe(0);
  });

  it("returns 0 for an empty run", () => {
    expect(exitCodeFor([])).toBe(0);
  });
});

describe("recipe registry", () => {
  it("has unique recipe names", () => {
    const names = ALL_RECIPES.map((r) => r.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
