import { describe, it, expect } from "vitest";
import {
  isContractCheckable,
  runContractChecks,
  type ContractViolation,
} from "../src/contract-checks.js";
import { defaultConfig } from "../src/config-loader.js";
import type { A11yConfig } from "../src/config-loader.js";

function configWith(overrides: Partial<A11yConfig["rules"]>): A11yConfig {
  return {
    wcagLevel: "AA",
    rules: { ...defaultConfig.rules, ...overrides },
  };
}

function check(
  path: string,
  content: string,
  config: A11yConfig = defaultConfig,
): ContractViolation[] {
  return runContractChecks([{ path, content }], config);
}

// ---------------------------------------------------------------------------
// dialog-contract
// ---------------------------------------------------------------------------

describe("a11y-sdk/dialog-contract", () => {
  it("flags role=dialog missing both aria-modal and an accessible name", () => {
    const out = check(
      "src/Modal.tsx",
      `export const Modal = () => (\n  <div role="dialog" className="modal">hi</div>\n);\n`,
    );
    const dialog = out.filter((v) => v.ruleId === "a11y-sdk/dialog-contract");
    expect(dialog).toHaveLength(2);
    expect(dialog[0]!.wcag).toBe("4.1.2 Name, Role, Value");
    expect(dialog[0]!.line).toBe(2);
    expect(dialog.map((v) => v.message).join(" ")).toContain("aria-modal");
    expect(dialog.map((v) => v.message).join(" ")).toContain("accessible name");
  });

  it("passes a complete dialog (aria-modal + aria-labelledby)", () => {
    const out = check(
      "src/Modal.tsx",
      `<div role="dialog" aria-modal="true" aria-labelledby="title">x</div>`,
    );
    expect(out).toHaveLength(0);
  });

  it("accepts aria-label as the accessible name", () => {
    const out = check(
      "src/Modal.tsx",
      `<div role="dialog" aria-modal="true" aria-label="Settings">x</div>`,
    );
    expect(out).toHaveLength(0);
  });

  it("handles multi-line tags with JSX handlers containing arrows", () => {
    const out = check(
      "src/Modal.tsx",
      `<div\n  role="dialog"\n  onKeyDown={(e) => e.key === "Escape" && close()}\n  aria-modal="true"\n  aria-labelledby="t"\n>x</div>`,
    );
    expect(out).toHaveLength(0);
  });

  it("does not flag the native <dialog> element", () => {
    const out = check("src/Modal.tsx", `<dialog open>hello</dialog>`);
    expect(out).toHaveLength(0);
  });

  it('does not flag role="dialog" appearing in plain code strings outside a tag', () => {
    const out = check(
      "src/Modal.tsx",
      `const sel = 'role="dialog"';\nexport const x = 1 > 0;\n`,
    );
    expect(out).toHaveLength(0);
  });

  it("is suppressed when aria-roles category is disabled", () => {
    const out = check(
      "src/Modal.tsx",
      `<div role="dialog">x</div>`,
      configWith({ "aria-roles": false }),
    );
    expect(out).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// expanded-controls
// ---------------------------------------------------------------------------

describe("a11y-sdk/expanded-controls", () => {
  it("flags aria-expanded without aria-controls (JSX binding)", () => {
    const out = check(
      "src/Menu.tsx",
      `<button aria-expanded={open} onClick={() => setOpen(!open)}>Menu</button>`,
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.ruleId).toBe("a11y-sdk/expanded-controls");
    expect(out[0]!.wcag).toBe("4.1.2 Name, Role, Value");
  });

  it("passes when aria-controls is present", () => {
    const out = check(
      "src/Menu.vue",
      `<template><button :aria-expanded="open" aria-controls="menu-list">Menu</button></template>`,
    );
    expect(out).toHaveLength(0);
  });

  it("reports one violation per tag even with multiple mentions", () => {
    const out = check(
      "src/Menu.svelte",
      `<button aria-expanded="false" data-x="aria-expanded">Menu</button>`,
    );
    expect(out).toHaveLength(1);
  });

  it("ignores aria-expanded in plain .ts code files", () => {
    const out = check(
      "src/menu.ts",
      `el.setAttribute("aria-expanded", "true");`,
    );
    expect(out).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// no-px-font-size
// ---------------------------------------------------------------------------

describe("a11y-sdk/no-px-font-size", () => {
  it("flags px font-size in a stylesheet", () => {
    const out = check("src/app.css", `.card {\n  font-size: 14px;\n}\n`);
    expect(out).toHaveLength(1);
    expect(out[0]!.ruleId).toBe("a11y-sdk/no-px-font-size");
    expect(out[0]!.wcag).toBe("1.4.4 Resize Text");
    expect(out[0]!.line).toBe(2);
  });

  it("flags fontSize px values in JS style objects", () => {
    const out = check(
      "src/Card.tsx",
      `const style = { fontSize: "13px", color: "red" };`,
    );
    expect(out).toHaveLength(1);
  });

  it("passes rem/em sizes and non-font px values", () => {
    const out = check(
      "src/app.scss",
      `.card { font-size: 1.25rem; margin: 16px; border-width: 1px; }`,
    );
    expect(out).toHaveLength(0);
  });

  it("ignores font-size: 0 (visually-hidden technique)", () => {
    const out = check("src/app.css", `.sr { font-size: 0px; }`);
    expect(out).toHaveLength(0);
  });

  it("catches px font-size inside a Vue style block", () => {
    const out = check(
      "src/Card.vue",
      `<template><p>hi</p></template>\n<style>\np { font-size: 12px; }\n</style>\n`,
    );
    expect(out).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// autocomplete-required
// ---------------------------------------------------------------------------

describe("a11y-sdk/autocomplete-required", () => {
  it("flags type=email input without autocomplete and suggests the token", () => {
    const out = check("src/Form.tsx", `<input type="email" name="contact" />`);
    expect(out).toHaveLength(1);
    expect(out[0]!.ruleId).toBe("a11y-sdk/autocomplete-required");
    expect(out[0]!.wcag).toBe("1.3.5 Identify Input Purpose");
    expect(out[0]!.message).toContain('autocomplete="email"');
  });

  it("detects purpose from the name attribute", () => {
    const out = check(
      "src/Form.html",
      `<input type="text" name="first_name">`,
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.message).toContain('autocomplete="given-name"');
  });

  it("passes when autocomplete is present", () => {
    const out = check(
      "src/Form.tsx",
      `<input type="email" name="contact" autocomplete="email" />`,
    );
    expect(out).toHaveLength(0);
  });

  it("skips non-personal inputs and non-text types", () => {
    const out = check(
      "src/Form.tsx",
      `<>
        <input type="text" name="search-query" />
        <input type="checkbox" name="email-optin" />
        <input type="hidden" name="csrf" />
      </>`,
    );
    expect(out).toHaveLength(0);
  });

  it('does not treat "hotel" as a tel field', () => {
    const out = check("src/Form.tsx", `<input type="text" name="hotel" />`);
    expect(out).toHaveLength(0);
  });

  it("is suppressed when form-labeling category is disabled", () => {
    const out = check(
      "src/Form.tsx",
      `<input type="email" name="contact" />`,
      configWith({ "form-labeling": false }),
    );
    expect(out).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// file routing
// ---------------------------------------------------------------------------

describe("isContractCheckable / routing", () => {
  it("accepts markup and style extensions, rejects others", () => {
    expect(isContractCheckable("src/App.tsx")).toBe(true);
    expect(isContractCheckable("src/App.vue")).toBe(true);
    expect(isContractCheckable("styles/main.scss")).toBe(true);
    expect(isContractCheckable("src/util.ts")).toBe(false);
    expect(isContractCheckable("README.md")).toBe(false);
  });

  it("runs only the font-size check on stylesheets", () => {
    // aria markup inside a CSS comment must not trigger markup checks
    const out = check(
      "src/app.css",
      `/* <div role="dialog"> */ .x { font-size: 11px; }`,
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.ruleId).toBe("a11y-sdk/no-px-font-size");
  });
});
