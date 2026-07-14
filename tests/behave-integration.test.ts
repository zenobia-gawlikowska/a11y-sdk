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
  .fake-heading { font-size: 26px; font-weight: 700; }
</style>
</head>
<body>
<nav><a href="/one">One</a> <a href="/two">Two</a> <a href="bad.html">Home</a></nav>
<nav><a href="/three">Three</a></nav>
<main>
  <div class="fake-heading">Section Overview</div>
  <div class="wide" tabindex="3">wide content</div>
  <div role="button" class="fake-btn">Fake button</div>
  <button id="toggle" aria-expanded="false" aria-controls="missing-id">Menu</button>
  <div role="menu" id="menu">
    <div role="menuitem" tabindex="0">Item A</div>
    <div role="menuitem" tabindex="-1">Item B</div>
  </div>
  <table><tr><td>1</td><td>2</td></tr></table>
  <form>
    <input type="email" name="email">
    <input type="radio" name="plan" value="a"> Basic
    <input type="radio" name="plan" value="b"> Pro
    <input type="text" id="bad-invalid" aria-invalid="true">
  </form>
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
<nav aria-label="Main"><a href="#s1">Section 1</a> <a href="good.html" aria-current="page">Home</a></nav>
<nav aria-label="Footer"><a href="#s1">Legal</a></nav>
<main id="main">
  <h1>Good fixture</h1>
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
    <fieldset>
      <legend>Preferred plan</legend>
      <input type="radio" name="plan" id="plan-a" value="a"><label for="plan-a">Basic</label>
      <input type="radio" name="plan" id="plan-b" value="b"><label for="plan-b">Pro</label>
    </fieldset>
    <label for="promo">Promo code</label>
    <input id="promo" type="text" aria-invalid="true" aria-describedby="promo-err">
    <span id="promo-err">This code has expired</span>
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
<style>
  body { margin: 0; font-size: 14px; }
  .card-title { font-size: 24px; font-weight: 700; }
</style>
</head>
<body>
<a href="#nowhere">Skip to content</a>
<nav aria-label="Main"><a href="#s1">One</a> <a href="subtle.html" aria-current="page">Home</a> <a href="subtle.html?ref=x" aria-current="page">Home again</a></nav>
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
  <form>
    <label for="promo">Promo code</label>
    <input id="promo" type="text" aria-invalid="true" aria-describedby="empty-err">
    <span id="empty-err"></span>
  </form>
  <div class="card"><svg aria-hidden="true"><path d="M0 0"/></svg><div class="card-title">Card With Icon</div></div>
  <h1>Report</h1>
  <h3 id="s1">Section</h3>
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
    expect(results["tab-order"]?.status).toBe("fail");
    expect(results["regions-headings"]?.status).toBe("fail");
    expect(results["form-navigation"]?.status).toBe("fail");
    expect(results["nav-current"]?.status).toBe("fail");
    expect(results["visual-headings"]?.status).toBe("warn");

    // Spot-check details carry actionable specifics
    expect(results["dialog"]?.details.join("\n")).toContain("aria-modal");
    expect(results["dialog"]?.details.join("\n")).toContain("Escape");
    expect(results["disclosure"]?.details.join("\n")).toContain("did not toggle");
    expect(results["focus-visible"]?.details.join("\n")).toContain("#toggle");
    // Keyboard-user persona: positive tabindex and an unfocusable role="button".
    const tabOrderDetails = results["tab-order"]?.details.join("\n") ?? "";
    expect(tabOrderDetails).toContain('tabindex="3"');
    expect(tabOrderDetails).toContain("not keyboard-focusable");
    // Screen-reader persona: no <h1> for heading navigation.
    expect(results["regions-headings"]?.details.join("\n")).toContain("No <h1>");
    // Screen-reader persona: unnamed control + ungrouped radios + orphaned error.
    const formNavDetails = results["form-navigation"]?.details.join("\n") ?? "";
    expect(formNavDetails).toContain("has no accessible name");
    expect(formNavDetails).toContain("is not wrapped in a labelled <fieldset><legend>");
    expect(formNavDetails).toContain("no aria-describedby");
    // Nav link to the current page missing aria-current="page".
    expect(results["nav-current"]?.details.join("\n")).toContain('missing aria-current="page"');
    // Large bold div doing a heading's job without the markup — warn only,
    // never fail, since "is this really a heading" needs judgment.
    expect(results["visual-headings"]?.details.join("\n")).toContain("Section Overview");
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
      "tab-order",
      "regions-headings",
      "form-navigation",
      "nav-current",
      "visual-headings",
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
    // Roving-tabindex menu items (tabindex="-1" siblings) must not be flagged
    // as unreachable — they're reachable via arrow keys inside the widget.
    expect(results["tab-order"]?.status, results["tab-order"]?.details.join("; ")).toBe("pass");
    // No form controls on this page.
    expect(results["form-navigation"]?.status).toBe("skipped");
    // No nav on the page.
    expect(results["nav-current"]?.status).toBe("skipped");
    // Widget labels ("Settings", "Item A"/"B"/"C") aren't styled to look
    // like headings — no false positive from a well-built widget.
    expect(results["visual-headings"]?.status, results["visual-headings"]?.details.join("; ")).toBe("pass");
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
    // Heading level skips from h1 straight to h3 (vs. bad.html's missing h1).
    expect(results["regions-headings"]?.status).toBe("fail");
    expect(results["regions-headings"]?.details.join("\n")).toContain(
      "jumps from h1 to h3",
    );
    // aria-describedby points at an id that exists but is empty (vs.
    // bad.html's completely absent aria-describedby).
    expect(results["form-navigation"]?.status).toBe("fail");
    expect(results["form-navigation"]?.details.join("\n")).toContain(
      "missing or empty",
    );
    // Two links to the current page both marked aria-current="page" (vs.
    // bad.html's link that's missing it entirely).
    expect(results["nav-current"]?.status).toBe("fail");
    expect(results["nav-current"]?.details.join("\n")).toContain(
      'carry aria-current="page"',
    );
    // Icon+text card title (vs. bad.html's plain fake-heading div) — the
    // decorative-icon-child allowance must still catch this leaf pattern.
    expect(results["visual-headings"]?.status).toBe("warn");
    expect(results["visual-headings"]?.details.join("\n")).toContain("Card With Icon");
    // Sanity: things done right here stay green.
    expect(results["reflow-320"]?.status).toBe("pass");
    expect(results["focus-visible"]?.status).toBe("pass");
    expect(results["tab-order"]?.status, results["tab-order"]?.details.join("; ")).toBe("pass");
  }, 120_000);

  it("honors the recipes filter", async () => {
    const page = await browser.newPage();
    const url = pathToFileURL(join(dir, "good.html")).toString();
    const results = await runRecipes(page, url, ["reflow-320", "nav-labels"], {});
    await page.close();

    expect(results.map((r) => r.recipe)).toEqual(["reflow-320", "nav-labels"]);
  }, 60_000);
});
