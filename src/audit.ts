import fs from "node:fs";
import path from "node:path";

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
  "landmark-one-main": { criterion: "1.3.6", title: "Identify Purpose" },
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

async function main(): Promise<void> {
  // Playwright availability check — runs only when CLI is invoked, not when imported
  try {
    require.resolve("playwright");
    require.resolve("@axe-core/playwright");
  } catch {
    console.error(`
a11y-sdk audit requires Playwright. Install it in your project:

  npm install --save-dev playwright @axe-core/playwright
  npx playwright install chromium

Then re-run the audit.
`);
    process.exit(3);
  }

  const args = process.argv.slice(2);
  const urlArg = args.find((a) => !a.startsWith("--"));
  const level = (args.find((a) => a.startsWith("--level="))?.split("=")[1] ??
    args[args.indexOf("--level") + 1] ??
    "AA") as "AA" | "AAA";

  if (!urlArg) {
    console.error("Usage: node audit.cjs <url> [--level AA|AAA]");
    process.exit(2);
  }

  let url: URL;
  try {
    url = new URL(urlArg);
  } catch {
    console.error(`Invalid URL: ${urlArg}`);
    process.exit(2);
  }

  // Dynamic imports — only reached if require.resolve checks above passed
  const { chromium } = await import("playwright");
  const { AxeBuilder } = await import("@axe-core/playwright");

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch {
    console.error(`Failed to launch Chromium. Run: npx playwright install chromium`);
    process.exit(2);
  }

  const page = await browser.newPage();

  try {
    const response = await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 15_000 });
    if (!response || !response.ok()) {
      console.error(`Page unreachable or returned error: ${url}`);
      await browser.close();
      process.exit(2);
    }
  } catch {
    console.error(`Could not reach ${url} — is the dev server running?`);
    await browser.close();
    process.exit(2);
  }

  const tags = level === "AAA"
    ? ["wcag2a", "wcag2aa", "wcag2aaa"]
    : ["wcag2a", "wcag2aa"];

  let rawResults: AxeResults;
  try {
    const axeResults = await new AxeBuilder({ page })
      .withTags(tags)
      .analyze();
    rawResults = { violations: axeResults.violations as AxeViolation[] };
  } catch (err: unknown) {
    console.error("Audit error:", err);
    await browser.close();
    process.exit(2);
  }

  await browser.close();

  // Write JSON results
  const resultsDir = path.join(process.cwd(), ".a11y");
  if (fs.existsSync(resultsDir)) {
    fs.writeFileSync(path.join(resultsDir, "audit-results.json"), JSON.stringify(rawResults, null, 2));
  }

  const output = formatResults(rawResults);
  console.log(output);

  process.exit(rawResults.violations.length > 0 ? 1 : 0);
}

// Only run when executed directly (not when imported by tests)
// Works for both ESM (import.meta.url) and CJS (require.main)
const isMain =
  typeof require !== "undefined"
    ? require.main === module
    : process.argv[1]?.endsWith("audit.ts") || process.argv[1]?.endsWith("audit.cjs");

if (isMain) {
  main().catch((err) => {
    console.error("Unexpected error:", err);
    process.exit(2);
  });
}
