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
<nav aria-label="Footer"><a href="#s1">Legal</a></nav>
<main id="main">
  <button id="acc" aria-expanded="false" aria-controls="panel">Details</button>
  <div id="panel" hidden>Panel content</div>
  <table>
    <caption>Quarterly sales</caption>
    <thead><tr><th scope="col" id="sort-th" aria-sort="none">Quarter</th><th scope="col">Sales</th></tr></thead>
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
  var sortTh = document.getElementById('sort-th');
  sortTh.addEventListener('click', function () {
    var cur = sortTh.getAttribute('aria-sort');
    sortTh.setAttribute('aria-sort', cur === 'ascending' ? 'descending' : 'ascending');
  });
</script>
</body>
</html>`;

// Correct trigger-opened modal + working menu: proves the dialog and
// menu-keyboard recipes PASS well-built widgets (false-positive guard).
const WIDGETS_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Widgets fixture</title>
<style>
  body { margin: 0; font-size: 1rem; }
  button { font: inherit; }
</style>
</head>
<body>
<main>
  <button id="open" aria-haspopup="dialog">Open settings</button>
  <div id="dlg" role="dialog" aria-modal="true" aria-labelledby="dlg-title" hidden>
    <h2 id="dlg-title">Settings</h2>
    <button id="ok">OK</button>
    <button id="cancel">Cancel</button>
  </div>
  <div role="menu" id="menu">
    <div role="menuitem" tabindex="0">Item A</div>
    <div role="menuitem" tabindex="-1">Item B</div>
    <div role="menuitem" tabindex="-1">Item C</div>
  </div>
</main>
<script>
  var trigger = document.getElementById('open');
  var dlg = document.getElementById('dlg');
  var lastFocus = null;
  function closeDlg() {
    dlg.hidden = true;
    (lastFocus || trigger).focus();
  }
  trigger.addEventListener('click', function () {
    lastFocus = document.activeElement;
    dlg.hidden = false;
    document.getElementById('ok').focus();
  });
  dlg.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeDlg(); return; }
    if (e.key === 'Tab') {
      var f = Array.prototype.slice.call(dlg.querySelectorAll('button'));
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  var menu = document.getElementById('menu');
  var items = Array.prototype.slice.call(menu.querySelectorAll('[role=menuitem]'));
  menu.addEventListener('keydown', function (e) {
    var i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
  });
</script>
</body>
</html>`;

// Secondary failure modes: broken trigger-opened modal (no focus move, no
// trap, no restore), skip link to a missing target, duplicate nav labels,
// stuck aria-sort, th without scope, invalid aria-expanded value,
// px-anchored text (zoom warn), static alert text (live-region warn).
const SUBTLE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Subtle fixture</title>
<style>body { margin: 0; font-size: 14px; }</style>
</head>
<body>
<a href="#nowhere">Skip to content</a>
<nav aria-label="Main"><a href="#s1">One</a></nav>
<nav aria-label="Main"><a href="#s1">Two</a></nav>
<main>
  <button id="open" aria-haspopup="dialog">Open settings</button>
  <div id="dlg" role="dialog" aria-modal="true" aria-labelledby="dlg-title" hidden>
    <h2 id="dlg-title">Settings</h2>
    <button id="ok">OK</button>
  </div>
  <button id="bad-toggle" aria-expanded="yes">Filters</button>
  <table>
    <caption>Report</caption>
    <thead><tr><th scope="col" id="stuck-sort" aria-sort="none">Name</th><th>Value</th></tr></thead>
    <tbody><tr><td>a</td><td>1</td></tr></tbody>
  </table>
  <div role="alert">Welcome to the app!</div>
  <h2 id="s1">Section</h2>
</main>
<script>
  var dlg = document.getElementById('dlg');
  document.getElementById('open').addEventListener('click', function () {
    dlg.hidden = false; // opens, but never moves focus, traps, or restores
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') dlg.hidden = true; // closes without focus restore
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
    writeFileSync(join(dir, "widgets.html"), WIDGETS_HTML);
    writeFileSync(join(dir, "subtle.html"), SUBTLE_HTML);
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

  it("passes correctly built widgets — trigger-opened modal with focus trap, arrow-key menu", async () => {
    const page = await browser.newPage();
    const url = pathToFileURL(join(dir, "widgets.html")).toString();
    const results = byRecipe(await runRecipes(page, url, null, {}));
    await page.close();

    // The false-positive guard: a correct modal and menu must PASS.
    expect(results["dialog"]?.status, results["dialog"]?.details.join("; ")).toBe("pass");
    expect(results["menu-keyboard"]?.status, results["menu-keyboard"]?.details.join("; ")).toBe("pass");
    expect(results["focus-visible"]?.status).toBe("pass");
    expect(results["zoom-200"]?.status).toBe("pass");
    // No nav on the page → skip link not required.
    expect(results["skip-link"]?.status).toBe("skipped");
  }, 120_000);

  it("catches secondary failure modes on the subtle fixture", async () => {
    const page = await browser.newPage();
    const url = pathToFileURL(join(dir, "subtle.html")).toString();
    const results = byRecipe(await runRecipes(page, url, null, {}));
    await page.close();

    // Skip link exists but points at a missing target.
    expect(results["skip-link"]?.status).toBe("fail");
    // Two navs with the SAME label (vs. bad.html's missing labels).
    expect(results["nav-labels"]?.status).toBe("fail");
    expect(results["nav-labels"]?.details.join("\n")).toContain("share the label");
    // Trigger-opened dialog with correct ARIA but broken focus management.
    expect(results["dialog"]?.status).toBe("fail");
    const dialogDetails = results["dialog"]?.details.join("\n") ?? "";
    expect(dialogDetails).toContain("Focus did not move inside");
    expect(dialogDetails).toContain("escaped");
    expect(dialogDetails).toContain("did not return");
    expect(dialogDetails).not.toContain("aria-modal"); // ARIA itself is correct
    // Sortable header whose aria-sort never changes + th without scope.
    expect(results["table"]?.status).toBe("fail");
    const tableDetails = results["table"]?.details.join("\n") ?? "";
    expect(tableDetails).toContain("aria-sort");
    expect(tableDetails).toContain("without scope");
    // Invalid aria-expanded value.
    expect(results["disclosure"]?.status).toBe("fail");
    expect(results["disclosure"]?.details.join("\n")).toContain('aria-expanded="yes"');
    // px-anchored text: no overflow, but text ignores root font-size scaling.
    expect(results["zoom-200"]?.status).toBe("warn");
    // Static alert text at load (warn branch, vs. bad.html's nested fail).
    expect(results["live-region-static"]?.status).toBe("warn");
    // Sanity: things done right here stay green.
    expect(results["reflow-320"]?.status).toBe("pass");
    expect(results["focus-visible"]?.status).toBe("pass");
  }, 120_000);

  it("honors the recipes filter", async () => {
    const page = await browser.newPage();
    const url = pathToFileURL(join(dir, "good.html")).toString();
    const results = await runRecipes(page, url, ["reflow-320", "nav-labels"], {});
    await page.close();

    expect(results.map((r) => r.recipe)).toEqual(["reflow-320", "nav-labels"]);
  }, 60_000);
});
