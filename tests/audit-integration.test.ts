import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import type { Browser } from "playwright";
import { runAxeScan, BEST_PRACTICE_RULES } from "../src/audit.ts";

// Integration coverage runs only where a Chromium binary is present
// (CI does not install browsers — the suite self-skips there).
let chromiumAvailable = false;
try {
  chromiumAvailable = existsSync(chromium.executablePath());
} catch {
  chromiumAvailable = false;
}

// axe-core tags region/landmark-*/heading-order/page-has-heading-one/
// empty-heading as "best-practice" only — no wcag2a/wcag2aa/wcag2aaa tag —
// so .withTags() alone never runs them. This fixture trips several at once:
// a paragraph outside any landmark (region), no <h1> (page-has-heading-one),
// and a heading level skip (heading-order).
const BAD_HTML = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Bad audit fixture</title></head>
<body>
<p>Orphaned paragraph outside any landmark.</p>
<main><h2>Starts at h2, skips h1</h2><h4>Jumps from h2 to h4</h4></main>
</body>
</html>`;

const GOOD_HTML = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Good audit fixture</title></head>
<body>
<main>
  <h1>Good fixture</h1>
  <h2>Section</h2>
</main>
</body>
</html>`;

// axe-core tags WCAG 2.1/2.2's *new* success criteria (target-size,
// avoid-inline-spacing, autocomplete-valid, css-orientation-lock,
// label-content-name-mismatch) under wcag21a/wcag21aa/wcag22aa — separate
// from the original wcag2a/wcag2aa tags used for WCAG 2.0. Without those
// extra tags in runAxeScan()'s .withTags() call, these rules silently never
// ran despite the toolkit's stated "WCAG 2.1 AA minimum" floor.
// axe's target-size rule implements the WCAG 2.5.8 spacing exception itself
// — a single small, isolated target legitimately PASSES (nothing crowds its
// 24px zone), so the fixture needs two touching small targets to force a
// genuine violation.
const WCAG21_BAD_HTML = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>WCAG 2.1/2.2 bad fixture</title></head>
<body>
<main>
  <h1>Fixture</h1>
  <div style="position: relative;">
    <button style="position: absolute; left: 0; top: 0; width: 10px; height: 10px; padding: 0;">A</button>
    <button style="position: absolute; left: 10px; top: 0; width: 10px; height: 10px; padding: 0;">B</button>
  </div>
</main>
</body>
</html>`;

const WCAG21_GOOD_HTML = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>WCAG 2.1/2.2 good fixture</title></head>
<body>
<main>
  <h1>Fixture</h1>
  <button style="width: 44px; height: 44px;">X</button>
</main>
</body>
</html>`;

describe.skipIf(!chromiumAvailable)("axe best-practice rule scan (integration)", () => {
  let browser: Browser;
  let dir: string;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    dir = mkdtempSync(join(tmpdir(), "a11y-audit-"));
    writeFileSync(join(dir, "bad.html"), BAD_HTML);
    writeFileSync(join(dir, "good.html"), GOOD_HTML);
    writeFileSync(join(dir, "wcag21-bad.html"), WCAG21_BAD_HTML);
    writeFileSync(join(dir, "wcag21-good.html"), WCAG21_GOOD_HTML);
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("fires the curated best-practice rules on the bad fixture", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(pathToFileURL(join(dir, "bad.html")).toString());
    const results = await runAxeScan(page, "AA");
    await context.close();

    const ids = results.violations.map((v) => v.id);
    expect(ids).toContain("region");
    expect(ids).toContain("page-has-heading-one");
    expect(ids).toContain("heading-order");
  }, 30_000);

  it("produces no best-practice violations on the good fixture", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(pathToFileURL(join(dir, "good.html")).toString());
    const results = await runAxeScan(page, "AA");
    await context.close();

    const bestPracticeIds = new Set<string>(BEST_PRACTICE_RULES);
    const offenders = results.violations.filter((v) => bestPracticeIds.has(v.id));
    expect(offenders.map((v) => v.id)).toEqual([]);
  }, 30_000);

  it("fires WCAG 2.1/2.2-tagged rules (target-size) that wcag2a/wcag2aa alone would miss", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(pathToFileURL(join(dir, "wcag21-bad.html")).toString());
    const results = await runAxeScan(page, "AA");
    await context.close();

    expect(results.violations.map((v) => v.id)).toContain("target-size");
  }, 30_000);

  it("produces no WCAG 2.1/2.2 violations on a compliant fixture", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(pathToFileURL(join(dir, "wcag21-good.html")).toString());
    const results = await runAxeScan(page, "AA");
    await context.close();

    expect(results.violations.map((v) => v.id)).not.toContain("target-size");
  }, 30_000);

  it("throws a clear error rather than silently no-op-ing on browser.newPage() (regression guard)", async () => {
    // AxeBuilder requires a page created via an explicit context. This guards
    // the exact bug the newContext() fix in audit.ts's main() addresses.
    const page = await browser.newPage();
    await page.goto(pathToFileURL(join(dir, "good.html")).toString());
    await expect(runAxeScan(page, "AA")).rejects.toThrow(/newContext/);
    await page.close();
  }, 30_000);
});
