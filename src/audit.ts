import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import type { Page } from "playwright";

/**
 * Load a peer tool (playwright, @axe-core/playwright) from the AUDITED
 * project's node_modules first. The CLI often runs from an ephemeral npx
 * prefix (`npx a11y-sdk@<tag> audit …` — exactly what `emit ci` generates),
 * where bare `import()` resolves relative to the npx cache and never finds
 * the project's install. Anchoring resolution at cwd fixes that; bare import
 * remains the fallback for a11y-sdk checkouts carrying their own deps.
 */
async function loadPeer<T>(specifier: string): Promise<T> {
  const projectRequire = createRequire(path.join(process.cwd(), "package.json"));
  try {
    return projectRequire(specifier) as T;
  } catch {
    try {
      // ESM-only install in the project: import its resolved entry directly.
      const resolved = projectRequire.resolve(specifier);
      return (await import(pathToFileURL(resolved).href)) as T;
    } catch {
      return (await import(specifier)) as T;
    }
  }
}

// --- Types mirroring @axe-core/playwright / axe-core result shapes ---

export interface AxeNodeResult {
  target: string[];
  html: string;
  failureSummary?: string;
}

export interface AxeViolation {
  id: string;
  impact: "critical" | "serious" | "moderate" | "minor" | null;
  description: string;
  nodes: AxeNodeResult[];
  tags: string[];
}

export interface AxeResults {
  violations: AxeViolation[];
}

// Maps axe rule id → WCAG success criterion number + title.
// Covers the most common rules; unmapped rules fall back to the axe description.
const RULE_TO_WCAG: Record<string, { criterion: string; title: string }> = {
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
  "audio-caption": { criterion: "1.2.2", title: "Captions (Prerecorded)" },
};

const IMPACT_ORDER: Record<string, number> = {
  critical: 0,
  serious: 1,
  moderate: 2,
  minor: 3,
};

/**
 * axe-core ships these landmark/region/heading-structure rules tagged only
 * "best-practice" — none carry a wcag2a/wcag2aa/wcag2aaa tag, so
 * `.withTags([...])` alone never runs them. They're exactly the "is all
 * content in a region, is there one main, is the heading hierarchy sane"
 * checks this toolkit wants, so force-enable this curated set on top of the
 * WCAG tag filter rather than pulling in the entire (much noisier)
 * best-practice tag.
 */
export const BEST_PRACTICE_RULES = [
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
  "empty-heading",
] as const;

// axe-core tags WCAG 2.1/2.2's *new* success criteria separately from the
// original WCAG 2.0 wcag2a/wcag2aa/wcag2aaa tags — "wcag2aa" alone never
// included 1.3.4 Orientation, 1.3.5 Identify Input Purpose (axe:autocomplete-valid),
// 1.4.12 Text Spacing (axe:avoid-inline-spacing), 2.5.3 Label in Name, or
// 2.5.8 Target Size. This toolkit's floor is "WCAG 2.1 AA minimum" (README),
// so the AA scan needs wcag21a/wcag21aa/wcag22aa alongside the WCAG 2.0
// tags, not just the latter.
const WCAG_AA_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

// Separately: axe-core silently drops target-size, css-orientation-lock,
// and label-content-name-mismatch from the run whenever .options({ rules })
// is used at all (as BEST_PRACTICE_RULES below requires) unless those rules
// are ALSO explicitly listed in that same object — tag membership alone
// stops being sufficient once a custom rules map is present. Verified
// empirically against axe-core 4.11; avoid-inline-spacing and
// autocomplete-valid don't need this, but listing all five here is cheap
// insurance against the same quirk resurfacing for either of them.
const WCAG_21_22_RULES = [
  "target-size",
  "css-orientation-lock",
  "label-content-name-mismatch",
  "avoid-inline-spacing",
  "autocomplete-valid",
] as const;

/** Run the axe-core scan: WCAG-tagged rules for `level`, plus the curated best-practice set above. */
export async function runAxeScan(page: Page, level: "AA" | "AAA"): Promise<AxeResults> {
  const { AxeBuilder } = await loadPeer<typeof import("@axe-core/playwright")>(
    "@axe-core/playwright",
  );
  const tags = level === "AAA" ? [...WCAG_AA_TAGS, "wcag2aaa"] : WCAG_AA_TAGS;
  const axeResults = await new AxeBuilder({ page })
    .withTags(tags)
    .options({
      rules: Object.fromEntries(
        [...BEST_PRACTICE_RULES, ...WCAG_21_22_RULES].map((id) => [id, { enabled: true }]),
      ),
    })
    .analyze();
  return { violations: axeResults.violations as AxeViolation[] };
}

/** Machine-readable projection of a violation (used by `--json` / callers). */
export interface JsonViolation {
  ruleId: string;
  impact: string;
  wcag: string | null;
  criterion: string | null;
  nodes: number;
  selectors: string[];
}

/** Format axe results as a stable JSON envelope for programmatic callers. */
export function formatJson(results: AxeResults): string {
  const violations: JsonViolation[] = results.violations.map((v) => {
    const wcag = RULE_TO_WCAG[v.id];
    return {
      ruleId: v.id,
      impact: v.impact ?? "minor",
      wcag: wcag ? `${wcag.criterion} ${wcag.title}` : null,
      criterion: wcag ? wcag.criterion : null,
      nodes: v.nodes.length,
      selectors: v.nodes.map((n) => n.target.join(", ")),
    };
  });
  return JSON.stringify(
    { violationCount: violations.length, violations },
    null,
    2,
  );
}

/** Format axe results into the human-readable grouped output. */
export function formatResults(results: AxeResults): string {
  const { violations } = results;
  if (violations.length === 0) return "No accessibility violations found.";

  const sorted = [...violations].sort((a, b) => {
    const ai = IMPACT_ORDER[a.impact ?? "minor"] ?? 3;
    const bi = IMPACT_ORDER[b.impact ?? "minor"] ?? 3;
    return ai - bi;
  });

  const lines: string[] = [];
  for (const v of sorted) {
    const wcag = RULE_TO_WCAG[v.id];
    const header = wcag
      ? `WCAG ${wcag.criterion} ${wcag.title} [${v.impact ?? "minor"}]`
      : `${v.id} [${v.impact ?? "minor"}]`;
    lines.push(header);
    for (const node of v.nodes) {
      const selector = node.target.join(", ");
      const summary = node.failureSummary
        ? node.failureSummary.replace(/^Fix (?:any|all) of the following:\s*/i, "").split("\n")[0]
        : v.description;
      lines.push(`  - ${node.html.slice(0, 80)} at ${selector}: ${summary}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

// --- CLI entrypoint ---

export interface AuditOptions {
  level: "AA" | "AAA";
  /** Emit the machine-readable JSON envelope instead of grouped prose. */
  json: boolean;
}

/**
 * Run the axe-core audit against a URL and print results.
 * Returns the process exit code (0 clean, 1 violations, 2 usage/runtime, 3 no Playwright).
 * Shared by the standalone toolkit script and the `a11y-sdk audit` CLI subcommand.
 */
export async function runAudit(
  urlArg: string | undefined,
  opts: AuditOptions,
): Promise<number> {
  // Availability check via loadPeer so this works as a CJS toolkit script,
  // bundled into the ESM CLI, AND from an ephemeral npx prefix.
  let chromium: typeof import("playwright").chromium;
  try {
    ({ chromium } = await loadPeer<typeof import("playwright")>("playwright"));
    await loadPeer("@axe-core/playwright"); // availability check; runAxeScan loads it
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

  let url: URL;
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

  // AxeBuilder requires a page created via an explicit context — browser.newPage()'s
  // implicit context isn't one it can attach to. See dequelabs/axe-core-npm's
  // playwright error-handling docs.
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const response = await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 15_000 });
    if (!response || !response.ok()) {
      console.error(`Page unreachable or returned error: ${url}`);
      await browser.close();
      return 2;
    }
  } catch {
    console.error(`Could not reach ${url} — is the dev server running?`);
    await browser.close();
    return 2;
  }

  let rawResults: AxeResults;
  try {
    rawResults = await runAxeScan(page, opts.level);
  } catch (err: unknown) {
    console.error("Audit error:", err);
    await browser.close();
    return 2;
  }

  await browser.close();

  // Write JSON results next to the .a11y install if one exists.
  const resultsDir = path.join(process.cwd(), ".a11y");
  if (fs.existsSync(resultsDir)) {
    fs.writeFileSync(path.join(resultsDir, "audit-results.json"), JSON.stringify(rawResults, null, 2));
  }

  console.log(opts.json ? formatJson(rawResults) : formatResults(rawResults));

  return rawResults.violations.length > 0 ? 1 : 0;
}

/** Parse audit argv (shared by the toolkit script + CLI subcommand). */
export function parseAuditArgs(args: string[]): {
  url: string | undefined;
  opts: AuditOptions;
  /** Usage error — caller should print it and exit 2 without running. */
  error?: string;
} {
  const positionals: string[] = [];
  let rawLevel: string | undefined;
  let json = false;
  let error: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "--json") {
      json = true;
    } else if (a.startsWith("--level=")) {
      rawLevel = a.slice("--level=".length);
    } else if (a === "--level") {
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
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
  let level: AuditOptions["level"] = "AA";
  if (rawLevel !== undefined && rawLevel !== "") {
    const norm = rawLevel.toUpperCase();
    if (norm === "AA" || norm === "AAA") level = norm;
    else error ??= `invalid --level "${rawLevel}" (expected AA|AAA)`;
  }

  return { url, opts: { level, json }, ...(error ? { error } : {}) };
}

async function main(): Promise<void> {
  const { url, opts, error } = parseAuditArgs(process.argv.slice(2));
  if (error) {
    console.error(error);
    process.exit(2);
  }
  process.exit(await runAudit(url, opts));
}

// Run only when invoked as the standalone toolkit script. Detection is argv-based
// (not require.main/module) so this module stays inert when bundled into the ESM CLI.
const entry = process.argv[1] ?? "";
const isMain = entry.endsWith("audit.ts") || entry.endsWith("audit.cjs");

if (isMain) {
  main().catch((err) => {
    console.error("Unexpected error:", err);
    process.exit(2);
  });
}
