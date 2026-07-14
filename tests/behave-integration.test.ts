import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import type { Browser } from "playwright";
import { runRecipes } from "../src/behave.ts";
import type { RecipeResult } from "../src/behave.ts";

// Integration coverage runs only where a Chromium binary is present
// (CI does not install browsers — the suite self-skips there).
let chromiumAvailable = false;
try {
  chromiumAvailable = existsSync(chromium.executablePath());
} catch {
  chromiumAvailable = false;
}

const BAD_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Bad fixture</title>
<style>
  body { font-size: 14px; }
  .wide { width: 1000px; background: #eee; }
  button { outline: none; border: 1px solid #888; background: #eee; }
  #dlg { position: fixed; top: 20px; left: 20px; background: #fff; border: 1px solid #000; padding: 8px; }
</style>
</head>
<body>
<nav><a href="/one">One</a> <a href="/two">Two</a></nav>
<nav><a href="/three">Three</a></nav>
<main>
  <div class="wide">wide content</div>
  <button id="toggle" aria-expanded="false" aria-controls="missing-id">Menu</button>
  <div role="menu" id="menu">
    <div role="menuitem" tabindex="0">Item A</div>
    <div role="menuitem" tabindex="-1">Item B</div>
  </div>
  <table><tr><td>1</td><td>2</td></tr></table>
  <form><input type="email" name="email"></form>
  <div id="dlg" role="dialog">A dialog with no aria-modal and no name <button id="dlg-btn">OK</button></div>
  <div aria-live="polite"><div role="status">saved</div></div>
</main>
</body>
</html>`;

const GOOD_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Good fixture</title>
<style>
  body { max-width: 100%; margin: 0; font-size: 1rem; }
  .skip-link { position: absolute; left: -9999px; }
  .skip-link:focus { left: 8px; }
  button:focus { outline: 3px solid #005fcc; }
</style>
</head>
<body>
<a class="skip-link" href="#main">Skip to main content</a>
<nav aria-label="Main"><a href="#s1">Section 1</a></nav>
<main id="main">
  <button id="acc" aria-expanded="false" aria-controls="panel">Details</button>
  <div id="panel" hidden>Panel content</div>
  <table>
    <caption>Quarterly sales</caption>
    <thead><tr><th scope="col">Quarter</th><th scope="col">Sales</th></tr></thead>
    <tbody><tr><td>Q1</td><td>100</td></tr></tbody>
  </table>
  <form>
    <label for="em">Email</label>
    <input id="em" type="email" name="email" autocomplete="email">
  </form>
  <div role="status" id="status-region"></div>
  <h2 id="s1">Section 1</h2>
</main>
<script>
  var btn = document.getElementById('acc');
  var panel = document.getElementById('panel');
  btn.addEventListener('click', function () {
    var open = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!open));
    panel.hidden = open;
  });
</script>
</body>
</html>`;

function byRecipe(results: RecipeResult[]): Record<string, RecipeResult> {
  return Object.fromEntries(results.map((r) => [r.recipe, r]));
}

describe.skipIf(!chromiumAvailable)("behave recipes (integration)", () => {
  let browser: Browser;
  let dir: string;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    dir = mkdtempSync(join(tmpdir(), "a11y-behave-"));
    writeFileSync(join(dir, "bad.html"), BAD_HTML);
    writeFileSync(join(dir, "good.html"), GOOD_HTML);
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("fails every violated recipe on the bad fixture", async () => {
    const page = await browser.newPage();
    const url = pathToFileURL(join(dir, "bad.html")).toString();
    const results = byRecipe(await runRecipes(page, url, null, {}));
    await page.close();

    expect(results["reflow-320"]?.status).toBe("fail");
    expect(results["zoom-200"]?.status).toBe("fail");
    expect(results["skip-link"]?.status).toBe("fail");
    expect(results["focus-visible"]?.status).toBe("fail");
    expect(results["dialog"]?.status).toBe("fail");
    expect(results["disclosure"]?.status).toBe("fail");
    expect(results["menu-keyboard"]?.status).toBe("fail");
    expect(results["nav-labels"]?.status).toBe("fail");
    expect(results["table"]?.status).toBe("fail");
    expect(results["live-region-static"]?.status).toBe("fail");
    expect(results["autocomplete"]?.status).toBe("warn");

    // Spot-check details carry actionable specifics
    expect(results["dialog"]?.details.join("\n")).toContain("aria-modal");
    expect(results["dialog"]?.details.join("\n")).toContain("Escape");
    expect(results["disclosure"]?.details.join("\n")).toContain("did not toggle");
    expect(results["focus-visible"]?.details.join("\n")).toContain("#toggle");
  }, 120_000);

  it("produces no false positives on the good fixture", async () => {
    const page = await browser.newPage();
    const url = pathToFileURL(join(dir, "good.html")).toString();
    const results = byRecipe(await runRecipes(page, url, null, {}));
    await page.close();

    for (const name of [
      "reflow-320",
      "zoom-200",
      "skip-link",
      "focus-visible",
      "disclosure",
      "nav-labels",
      "table",
      "autocomplete",
      "live-region-static",
    ]) {
      expect(results[name]?.status, `${name}: ${results[name]?.details.join("; ")}`).toBe("pass");
    }
    expect(results["dialog"]?.status).toBe("skipped");
    expect(results["menu-keyboard"]?.status).toBe("skipped");
  }, 120_000);

  it("honors the recipes filter", async () => {
    const page = await browser.newPage();
    const url = pathToFileURL(join(dir, "good.html")).toString();
    const results = await runRecipes(page, url, ["reflow-320", "nav-labels"], {});
    await page.close();

    expect(results.map((r) => r.recipe)).toEqual(["reflow-320", "nav-labels"]);
  }, 60_000);
});
