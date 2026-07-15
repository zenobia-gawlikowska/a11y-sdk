#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/audit.ts
var audit_exports = {};
__export(audit_exports, {
  BEST_PRACTICE_RULES: () => BEST_PRACTICE_RULES,
  formatJson: () => formatJson,
  formatResults: () => formatResults,
  parseAuditArgs: () => parseAuditArgs,
  runAudit: () => runAudit,
  runAxeScan: () => runAxeScan
});
module.exports = __toCommonJS(audit_exports);
var import_node_fs = __toESM(require("fs"), 1);
var import_node_path = __toESM(require("path"), 1);
var import_node_module = require("module");
var import_node_url = require("url");
async function loadPeer(specifier) {
  const projectRequire = (0, import_node_module.createRequire)(import_node_path.default.join(process.cwd(), "package.json"));
  try {
    return projectRequire(specifier);
  } catch {
    try {
      const resolved = projectRequire.resolve(specifier);
      return await import((0, import_node_url.pathToFileURL)(resolved).href);
    } catch {
      return await import(specifier);
    }
  }
}
var RULE_TO_WCAG = {
  "image-alt": { criterion: "1.1.1", title: "Non-text Content" },
  "input-image-alt": { criterion: "1.1.1", title: "Non-text Content" },
  "object-alt": { criterion: "1.1.1", title: "Non-text Content" },
  "svg-img-alt": { criterion: "1.1.1", title: "Non-text Content" },
  "color-contrast": { criterion: "1.4.3", title: "Contrast (Minimum)" },
  "color-contrast-enhanced": { criterion: "1.4.6", title: "Contrast (Enhanced)" },
  "label": { criterion: "1.3.1", title: "Info and Relationships" },
  "label-content-name-mismatch": { criterion: "2.5.3", title: "Label in Name" },
  "form-field-multiple-labels": { criterion: "1.3.1", title: "Info and Relationships" },
  "select-name": { criterion: "1.3.1", title: "Info and Relationships" },
  "aria-required-attr": { criterion: "4.1.2", title: "Name, Role, Value" },
  "aria-required-children": { criterion: "1.3.1", title: "Info and Relationships" },
  "aria-required-parent": { criterion: "1.3.1", title: "Info and Relationships" },
  "aria-roles": { criterion: "4.1.2", title: "Name, Role, Value" },
  "aria-valid-attr": { criterion: "4.1.2", title: "Name, Role, Value" },
  "aria-valid-attr-value": { criterion: "4.1.2", title: "Name, Role, Value" },
  "aria-hidden-focus": { criterion: "1.3.1", title: "Info and Relationships" },
  "aria-hidden-body": { criterion: "4.1.2", title: "Name, Role, Value" },
  "button-name": { criterion: "4.1.2", title: "Name, Role, Value" },
  "link-name": { criterion: "2.4.4", title: "Link Purpose (In Context)" },
  "document-title": { criterion: "2.4.2", title: "Page Titled" },
  "html-lang-valid": { criterion: "3.1.2", title: "Language of Parts" },
  "html-has-lang": { criterion: "3.1.1", title: "Language of Page" },
  "frame-title": { criterion: "4.1.2", title: "Name, Role, Value" },
  "keyboard": { criterion: "2.1.1", title: "Keyboard" },
  "focus-order-semantics": { criterion: "2.4.3", title: "Focus Order" },
  "tabindex": { criterion: "2.4.3", title: "Focus Order" },
  "skip-link": { criterion: "2.4.1", title: "Bypass Blocks" },
  "bypass": { criterion: "2.4.1", title: "Bypass Blocks" },
  "heading-order": { criterion: "1.3.1", title: "Info and Relationships" },
  "page-has-heading-one": { criterion: "1.3.1", title: "Info and Relationships" },
  "empty-heading": { criterion: "1.3.1", title: "Info and Relationships" },
  "landmark-one-main": { criterion: "1.3.6", title: "Identify Purpose" },
  "landmark-unique": { criterion: "1.3.6", title: "Identify Purpose" },
  "landmark-main-is-top-level": { criterion: "1.3.6", title: "Identify Purpose" },
  "landmark-banner-is-top-level": { criterion: "1.3.6", title: "Identify Purpose" },
  "landmark-complementary-is-top-level": { criterion: "1.3.6", title: "Identify Purpose" },
  "landmark-contentinfo-is-top-level": { criterion: "1.3.6", title: "Identify Purpose" },
  "landmark-no-duplicate-banner": { criterion: "1.3.6", title: "Identify Purpose" },
  "landmark-no-duplicate-contentinfo": { criterion: "1.3.6", title: "Identify Purpose" },
  "landmark-no-duplicate-main": { criterion: "1.3.6", title: "Identify Purpose" },
  "region": { criterion: "1.3.6", title: "Identify Purpose" },
  "video-caption": { criterion: "1.2.2", title: "Captions (Prerecorded)" },
  "audio-caption": { criterion: "1.2.2", title: "Captions (Prerecorded)" }
};
var IMPACT_ORDER = {
  critical: 0,
  serious: 1,
  moderate: 2,
  minor: 3
};
var BEST_PRACTICE_RULES = [
  "region",
  "landmark-one-main",
  "landmark-unique",
  "landmark-main-is-top-level",
  "landmark-banner-is-top-level",
  "landmark-complementary-is-top-level",
  "landmark-contentinfo-is-top-level",
  "landmark-no-duplicate-banner",
  "landmark-no-duplicate-contentinfo",
  "landmark-no-duplicate-main",
  "heading-order",
  "page-has-heading-one",
  "empty-heading"
];
var WCAG_AA_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
var WCAG_21_22_RULES = [
  "target-size",
  "css-orientation-lock",
  "label-content-name-mismatch",
  "avoid-inline-spacing",
  "autocomplete-valid"
];
async function runAxeScan(page, level) {
  const { AxeBuilder } = await loadPeer(
    "@axe-core/playwright"
  );
  const tags = level === "AAA" ? [...WCAG_AA_TAGS, "wcag2aaa"] : WCAG_AA_TAGS;
  const axeResults = await new AxeBuilder({ page }).withTags(tags).options({
    rules: Object.fromEntries(
      [...BEST_PRACTICE_RULES, ...WCAG_21_22_RULES].map((id) => [id, { enabled: true }])
    )
  }).analyze();
  return { violations: axeResults.violations };
}
function formatJson(results) {
  const violations = results.violations.map((v) => {
    const wcag = RULE_TO_WCAG[v.id];
    return {
      ruleId: v.id,
      impact: v.impact ?? "minor",
      wcag: wcag ? `${wcag.criterion} ${wcag.title}` : null,
      criterion: wcag ? wcag.criterion : null,
      nodes: v.nodes.length,
      selectors: v.nodes.map((n) => n.target.join(", "))
    };
  });
  return JSON.stringify(
    { violationCount: violations.length, violations },
    null,
    2
  );
}
function formatResults(results) {
  const { violations } = results;
  if (violations.length === 0) return "No accessibility violations found.";
  const sorted = [...violations].sort((a, b) => {
    const ai = IMPACT_ORDER[a.impact ?? "minor"] ?? 3;
    const bi = IMPACT_ORDER[b.impact ?? "minor"] ?? 3;
    return ai - bi;
  });
  const lines = [];
  for (const v of sorted) {
    const wcag = RULE_TO_WCAG[v.id];
    const header = wcag ? `WCAG ${wcag.criterion} ${wcag.title} [${v.impact ?? "minor"}]` : `${v.id} [${v.impact ?? "minor"}]`;
    lines.push(header);
    for (const node of v.nodes) {
      const selector = node.target.join(", ");
      const summary = node.failureSummary ? node.failureSummary.replace(/^Fix (?:any|all) of the following:\s*/i, "").split("\n")[0] : v.description;
      lines.push(`  - ${node.html.slice(0, 80)} at ${selector}: ${summary}`);
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}
async function runAudit(urlArg, opts) {
  let chromium;
  try {
    ({ chromium } = await loadPeer("playwright"));
    await loadPeer("@axe-core/playwright");
  } catch {
    console.error(`
a11y-sdk audit requires Playwright. Install it in your project:

  npm install --save-dev playwright @axe-core/playwright
  npx playwright install chromium

Then re-run the audit.
`);
    return 3;
  }
  if (!urlArg) {
    console.error("Usage: audit <url> [--level AA|AAA] [--json]");
    return 2;
  }
  let url;
  try {
    url = new URL(urlArg);
  } catch {
    console.error(`Invalid URL: ${urlArg}`);
    return 2;
  }
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch {
    console.error(`Failed to launch Chromium. Run: npx playwright install chromium`);
    return 2;
  }
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    const response = await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 15e3 });
    if (!response || !response.ok()) {
      console.error(`Page unreachable or returned error: ${url}`);
      await browser.close();
      return 2;
    }
  } catch {
    console.error(`Could not reach ${url} \u2014 is the dev server running?`);
    await browser.close();
    return 2;
  }
  let rawResults;
  try {
    rawResults = await runAxeScan(page, opts.level);
  } catch (err) {
    console.error("Audit error:", err);
    await browser.close();
    return 2;
  }
  await browser.close();
  const resultsDir = import_node_path.default.join(process.cwd(), ".a11y");
  if (import_node_fs.default.existsSync(resultsDir)) {
    import_node_fs.default.writeFileSync(import_node_path.default.join(resultsDir, "audit-results.json"), JSON.stringify(rawResults, null, 2));
  }
  console.log(opts.json ? formatJson(rawResults) : formatResults(rawResults));
  return rawResults.violations.length > 0 ? 1 : 0;
}
function parseAuditArgs(args) {
  const positionals = [];
  let rawLevel;
  let json = false;
  let error;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--json") {
      json = true;
    } else if (a.startsWith("--level=")) {
      rawLevel = a.slice("--level=".length);
    } else if (a === "--level") {
      const next = args[i + 1];
      if (next !== void 0 && !next.startsWith("--")) {
        rawLevel = next;
        i++;
      } else {
        rawLevel = "";
      }
    } else if (a.startsWith("--")) {
      error ??= `unknown audit flag "${a}" (expected --level AA|AAA, --json)`;
    } else {
      positionals.push(a);
    }
  }
  const url = positionals[0];
  let level = "AA";
  if (rawLevel !== void 0 && rawLevel !== "") {
    const norm = rawLevel.toUpperCase();
    if (norm === "AA" || norm === "AAA") level = norm;
    else error ??= `invalid --level "${rawLevel}" (expected AA|AAA)`;
  }
  return { url, opts: { level, json }, ...error ? { error } : {} };
}
async function main() {
  const { url, opts, error } = parseAuditArgs(process.argv.slice(2));
  if (error) {
    console.error(error);
    process.exit(2);
  }
  process.exit(await runAudit(url, opts));
}
var entry = process.argv[1] ?? "";
var isMain = entry.endsWith("audit.ts") || entry.endsWith("audit.cjs");
if (isMain) {
  main().catch((err) => {
    console.error("Unexpected error:", err);
    process.exit(2);
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BEST_PRACTICE_RULES,
  formatJson,
  formatResults,
  parseAuditArgs,
  runAudit,
  runAxeScan
});
