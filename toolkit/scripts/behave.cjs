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

// src/behave.ts
var behave_exports = {};
__export(behave_exports, {
  ALL_RECIPES: () => ALL_RECIPES,
  exitCodeFor: () => exitCodeFor,
  formatBehaveResults: () => formatBehaveResults,
  recipeAutocomplete: () => recipeAutocomplete,
  recipeDialog: () => recipeDialog,
  recipeDisclosure: () => recipeDisclosure,
  recipeFocusVisible: () => recipeFocusVisible,
  recipeFormNavigation: () => recipeFormNavigation,
  recipeLiveRegionStatic: () => recipeLiveRegionStatic,
  recipeMenuKeyboard: () => recipeMenuKeyboard,
  recipeNavCurrent: () => recipeNavCurrent,
  recipeNavLabels: () => recipeNavLabels,
  recipeReflow320: () => recipeReflow320,
  recipeRegionsHeadings: () => recipeRegionsHeadings,
  recipeSkipLink: () => recipeSkipLink,
  recipeTabOrder: () => recipeTabOrder,
  recipeTable: () => recipeTable,
  recipeVisualHeadings: () => recipeVisualHeadings,
  recipeZoom200: () => recipeZoom200,
  runRecipes: () => runRecipes
});
module.exports = __toCommonJS(behave_exports);
var import_node_fs = __toESM(require("fs"), 1);
var import_node_path = __toESM(require("path"), 1);
var STATUS_ORDER = {
  fail: 0,
  warn: 1,
  pass: 2,
  skipped: 3
};
var STATUS_MARK = {
  fail: "\u2716",
  warn: "\u26A0",
  pass: "\u2714",
  skipped: "\u2013"
};
var MAX_DETAILS = 12;
function capDetails(details) {
  if (details.length <= MAX_DETAILS) return details;
  const extra = details.length - MAX_DETAILS;
  return [...details.slice(0, MAX_DETAILS), `\u2026and ${extra} more`];
}
function formatBehaveResults(results) {
  if (results.length === 0) return "No behavioral checks were run.";
  const sorted = [...results].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.recipe.localeCompare(b.recipe)
  );
  const lines = [];
  for (const r of sorted) {
    const wcag = r.wcag ? ` \u2014 WCAG ${r.wcag}` : "";
    lines.push(`${STATUS_MARK[r.status]} ${r.recipe}${wcag} [${r.status}]`);
    for (const d of capDetails(r.details)) lines.push(`    ${d}`);
  }
  const count = (s) => results.filter((r) => r.status === s).length;
  lines.push("");
  lines.push(
    `${count("fail")} failed, ${count("warn")} warning(s), ${count("pass")} passed, ${count("skipped")} not applicable.`
  );
  return lines.join("\n");
}
function exitCodeFor(results) {
  return results.some((r) => r.status === "fail") ? 1 : 0;
}
async function measureOverflow(page) {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
}
async function recipeReflow320(page) {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.waitForTimeout(200);
  const { scrollWidth, clientWidth } = await measureOverflow(page);
  const overflow = scrollWidth - clientWidth;
  const fails = overflow > 1;
  return {
    recipe: "reflow-320",
    wcag: "1.4.10 Reflow",
    status: fails ? "fail" : "pass",
    details: fails ? [
      `Horizontal overflow of ${overflow}px at 320px viewport (scrollWidth ${scrollWidth} > clientWidth ${clientWidth}). Content must reflow to a single column.`
    ] : []
  };
}
async function recipeZoom200(page) {
  await page.setViewportSize({ width: 640, height: 800 });
  await page.waitForTimeout(200);
  const { scrollWidth, clientWidth } = await measureOverflow(page);
  const overflow = scrollWidth - clientWidth;
  if (overflow > 1) {
    return {
      recipe: "zoom-200",
      wcag: "1.4.4 Resize Text",
      status: "fail",
      details: [
        `Horizontal overflow of ${overflow}px at 200%-zoom-equivalent width (640px). UI must remain usable at 200% zoom without horizontal scrolling.`
      ]
    };
  }
  const textResponds = await page.evaluate(() => {
    const candidates = Array.from(
      document.querySelectorAll(
        "p, span, a, li, button, label, h1, h2, h3, h4, h5, h6, td, th, input"
      )
    ).filter(
      (el) => el.getClientRects().length > 0 && (el.textContent ?? "").trim().length > 0
    ).slice(0, 30);
    if (candidates.length === 0) return true;
    const before = candidates.map((el) => getComputedStyle(el).fontSize);
    document.documentElement.style.fontSize = "200%";
    const changed = candidates.some(
      (el, i) => getComputedStyle(el).fontSize !== before[i]
    );
    document.documentElement.style.fontSize = "";
    return changed;
  });
  return {
    recipe: "zoom-200",
    wcag: "1.4.4 Resize Text",
    status: textResponds ? "pass" : "warn",
    details: textResponds ? [] : [
      "No sampled text responds to root font-size scaling \u2014 font sizes appear hard-anchored in px. Prefer rem/em so user font-size settings take effect."
    ]
  };
}
async function recipeSkipLink(page) {
  const wcag = "2.4.1 Bypass Blocks";
  const navCount = await page.locator("nav, [role=navigation]").count();
  if (navCount === 0) {
    return {
      recipe: "skip-link",
      wcag,
      status: "skipped",
      details: ["No navigation landmark on the page \u2014 a skip link is not required."]
    };
  }
  await page.keyboard.press("Tab");
  const first = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body || el === document.documentElement) return null;
    const href = el.getAttribute("href") ?? "";
    let targetExists = false;
    if (href.startsWith("#") && href.length > 1) {
      targetExists = !!document.getElementById(decodeURIComponent(href.slice(1)));
    }
    return {
      tag: el.tagName.toLowerCase(),
      href,
      targetExists,
      text: (el.textContent ?? "").trim().slice(0, 60)
    };
  });
  if (!first) {
    return {
      recipe: "skip-link",
      wcag,
      status: "fail",
      details: ["Nothing receives focus on the first Tab press \u2014 the page has no reachable skip link."]
    };
  }
  const ok = first.tag === "a" && first.href.startsWith("#") && first.targetExists;
  return {
    recipe: "skip-link",
    wcag,
    status: ok ? "pass" : "fail",
    details: ok ? [] : [
      `First focusable element is <${first.tag}> "${first.text}" (href="${first.href}") \u2014 expected a skip link (an <a href="#\u2026"> whose target exists) as the first Tab stop.`
    ]
  };
}
async function recipeFocusVisible(page) {
  const wcag = "2.4.7 Focus Visible";
  const MAX_STOPS = 40;
  const stops = [];
  for (let i = 0; i < MAX_STOPS; i++) {
    await page.keyboard.press("Tab");
    const snap = await page.evaluate(
      (idx) => {
        const el = document.activeElement;
        if (!el || el === document.body || el === document.documentElement) return null;
        if (el.hasAttribute("data-a11y-behave-stop")) return { cycled: true };
        el.setAttribute("data-a11y-behave-stop", String(idx));
        const cs = getComputedStyle(el);
        const style = [
          cs.outlineStyle,
          cs.outlineWidth,
          cs.outlineColor,
          cs.boxShadow,
          cs.borderColor,
          cs.backgroundColor,
          cs.textDecorationLine
        ].join("|");
        const id = el.id ? `#${el.id}` : "";
        const text = (el.textContent ?? el.getAttribute("aria-label") ?? "").trim().slice(0, 40);
        return { cycled: false, style, desc: `<${el.tagName.toLowerCase()}${id}> "${text}"` };
      },
      i
    );
    if (!snap) break;
    if (snap.cycled) break;
    stops.push({ idx: i, desc: snap.desc, style: snap.style });
  }
  if (stops.length === 0) {
    return {
      recipe: "focus-visible",
      wcag,
      status: "skipped",
      details: ["No keyboard-focusable elements found on the page."]
    };
  }
  const unfocused = await page.evaluate(() => {
    document.activeElement?.blur?.();
    const out = {};
    for (const el of Array.from(
      document.querySelectorAll("[data-a11y-behave-stop]")
    )) {
      const cs = getComputedStyle(el);
      out[el.getAttribute("data-a11y-behave-stop") ?? ""] = [
        cs.outlineStyle,
        cs.outlineWidth,
        cs.outlineColor,
        cs.boxShadow,
        cs.borderColor,
        cs.backgroundColor,
        cs.textDecorationLine
      ].join("|");
      el.removeAttribute("data-a11y-behave-stop");
    }
    return out;
  });
  const offenders = stops.filter((s) => unfocused[String(s.idx)] === s.style);
  return {
    recipe: "focus-visible",
    wcag,
    status: offenders.length > 0 ? "fail" : "pass",
    details: offenders.map(
      (o) => `${o.desc}: no computed style change between focused and unfocused states \u2014 the focus indicator is missing (outline removed without replacement?).`
    )
  };
}
var INTERACTIVE_ROLE_SELECTOR = "[role=button],[role=link],[role=checkbox],[role=radio],[role=switch],[role=menuitem],[role=menuitemcheckbox],[role=menuitemradio],[role=tab],[role=option]";
var COMPOSITE_CONTAINER_SELECTOR = "[role=menu],[role=menubar],[role=tablist],[role=listbox],[role=radiogroup],[role=tree],[role=treegrid],[role=grid]";
async function recipeTabOrder(page) {
  const wcag = "2.1.1 Keyboard / 2.4.3 Focus Order";
  const details = [];
  const statics = await page.evaluate(
    ({ roleSel, compositeSel }) => {
      const isVisible = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
      const describe = (el) => {
        const id = el.id ? `#${el.id}` : "";
        const text = (el.textContent ?? el.getAttribute("aria-label") ?? "").trim().slice(0, 40);
        return `<${el.tagName.toLowerCase()}${id} role="${el.getAttribute("role")}"> "${text}"`;
      };
      const positiveTabindex = Array.from(
        document.querySelectorAll("[tabindex]")
      ).filter((el) => isVisible(el) && Number(el.getAttribute("tabindex")) > 0).map(
        (el) => `<${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}> tabindex="${el.getAttribute("tabindex")}" \u2014 positive tabindex creates a separate tab order; reorder the DOM instead.`
      );
      const unreachable = Array.from(
        document.querySelectorAll(roleSel)
      ).filter(
        (el) => isVisible(el) && !el.closest(compositeSel) && el.tabIndex < 0
      ).map(
        (el) => `${describe(el)} is not keyboard-focusable (add tabindex="0" or use a native interactive element).`
      );
      return { positiveTabindex, unreachable };
    },
    { roleSel: INTERACTIVE_ROLE_SELECTOR, compositeSel: COMPOSITE_CONTAINER_SELECTOR }
  );
  details.push(...statics.positiveTabindex, ...statics.unreachable);
  const MAX_STOPS = 40;
  let stopCount = 0;
  for (let i = 0; i < MAX_STOPS; i++) {
    await page.keyboard.press("Tab");
    const tagged = await page.evaluate((idx) => {
      const el = document.activeElement;
      if (!el || el === document.body || el === document.documentElement) return false;
      if (el.hasAttribute("data-a11y-behave-taborder")) return false;
      el.setAttribute("data-a11y-behave-taborder", String(idx));
      return true;
    }, i);
    if (!tagged) break;
    stopCount = i + 1;
  }
  if (stopCount === 0) {
    return {
      recipe: "tab-order",
      wcag,
      status: details.length > 0 ? "fail" : "skipped",
      details: details.length > 0 ? details : ["No keyboard-focusable elements found on the page."]
    };
  }
  if (stopCount > 1) {
    await page.evaluate((last) => {
      document.querySelector(`[data-a11y-behave-taborder="${last}"]`)?.focus();
    }, stopCount - 1);
    for (let i = stopCount - 2; i >= 0; i--) {
      await page.keyboard.press("Shift+Tab");
      const at = await page.evaluate(() => {
        const el = document.activeElement;
        const v = el?.getAttribute("data-a11y-behave-taborder");
        return v === null || v === void 0 ? null : Number(v);
      });
      if (at !== i) {
        details.push(
          `Shift+Tab landed on stop ${at ?? "an untracked element"} instead of stop ${i} \u2014 Tab and Shift+Tab must retrace the same sequence in reverse.`
        );
        break;
      }
    }
  }
  await page.evaluate(() => {
    for (const el of Array.from(
      document.querySelectorAll("[data-a11y-behave-taborder]")
    )) {
      el.removeAttribute("data-a11y-behave-taborder");
    }
  });
  return {
    recipe: "tab-order",
    wcag,
    status: details.length > 0 ? "fail" : "pass",
    details
  };
}
async function recipeDialog(page, opts) {
  const wcag = "2.1.2 No Keyboard Trap / 4.1.2 Name, Role, Value";
  const details = [];
  const state = await page.evaluate(() => {
    const isVisible = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
    const dialogs = Array.from(document.querySelectorAll("[role=dialog], dialog"));
    return {
      present: dialogs.length > 0,
      open: dialogs.some(isVisible)
    };
  });
  let trigger = null;
  if (!state.open) {
    const triggerSel = opts.dialogTrigger ?? '[aria-haspopup="dialog"]';
    const count = await page.locator(triggerSel).count();
    if (count === 0) {
      if (state.present) {
        return {
          recipe: "dialog",
          wcag,
          status: "warn",
          details: [
            'A dialog exists in the DOM but no trigger was found to open it. Re-run with --dialog-trigger "<selector>" to test its behavior.'
          ]
        };
      }
      return {
        recipe: "dialog",
        wcag,
        status: "skipped",
        details: ["No dialog or dialog trigger found on the page."]
      };
    }
    trigger = triggerSel;
    await page.locator(triggerSel).first().click();
    await page.waitForTimeout(300);
  }
  const contract = await page.evaluate(() => {
    const isVisible = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
    const dlg = Array.from(
      document.querySelectorAll("[role=dialog], dialog")
    ).find(isVisible);
    if (!dlg) return null;
    dlg.setAttribute("data-a11y-behave-dialog", "1");
    const native = dlg.tagName === "DIALOG";
    const ariaModal = dlg.getAttribute("aria-modal") === "true";
    const label = dlg.getAttribute("aria-label");
    const labelledby = dlg.getAttribute("aria-labelledby");
    let hasName = !!(label && label.trim());
    if (!hasName && labelledby) {
      hasName = labelledby.split(/\s+/).some((id) => {
        const t = document.getElementById(id);
        return !!t && !!(t.textContent ?? "").trim();
      });
    }
    const focusInside = dlg.contains(document.activeElement);
    return { native, ariaModal, hasName, focusInside };
  });
  if (!contract) {
    return {
      recipe: "dialog",
      wcag,
      status: "warn",
      details: [
        `Clicked the trigger (${trigger}) but no visible dialog appeared. Pass --dialog-trigger "<selector>" if a different control opens it.`
      ]
    };
  }
  if (!contract.native && !contract.ariaModal) {
    details.push('Dialog is missing aria-modal="true".');
  }
  if (!contract.hasName) {
    details.push(
      "Dialog has no accessible name \u2014 add aria-labelledby pointing to the title, or aria-label."
    );
  }
  if (trigger && !contract.focusInside) {
    details.push("Focus did not move inside the dialog when it opened.");
  }
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press("Tab");
    const inside = await page.evaluate(() => {
      const dlg = document.querySelector("[data-a11y-behave-dialog]");
      return !!dlg && dlg.contains(document.activeElement);
    });
    if (!inside) {
      details.push(
        "Focus escaped the open dialog while Tabbing \u2014 modal dialogs must trap focus (Tab and Shift+Tab cycle only within the dialog)."
      );
      break;
    }
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  const stillVisible = await page.evaluate(() => {
    const dlg = document.querySelector("[data-a11y-behave-dialog]");
    return !!dlg && dlg.getClientRects().length > 0 && getComputedStyle(dlg).visibility !== "hidden";
  });
  if (stillVisible) {
    details.push("Escape did not close the dialog.");
  } else if (trigger) {
    const restored = await page.evaluate(
      (sel) => document.querySelector(sel) === document.activeElement,
      trigger
    );
    if (!restored) {
      details.push(
        "After closing, focus did not return to the element that opened the dialog."
      );
    }
  }
  await page.evaluate(
    () => document.querySelector("[data-a11y-behave-dialog]")?.removeAttribute("data-a11y-behave-dialog")
  );
  return {
    recipe: "dialog",
    wcag,
    status: details.length > 0 ? "fail" : "pass",
    details
  };
}
async function recipeDisclosure(page) {
  const wcag = "4.1.2 Name, Role, Value";
  const candidates = await page.evaluate(() => {
    const isVisible = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
    return Array.from(document.querySelectorAll("[aria-expanded]")).filter(isVisible).slice(0, 10).map((el, i) => {
      el.setAttribute("data-a11y-behave-disclosure", String(i));
      const controls = el.getAttribute("aria-controls");
      return {
        i,
        desc: `<${el.tagName.toLowerCase()}> "${(el.textContent ?? el.getAttribute("aria-label") ?? "").trim().slice(0, 40)}"`,
        expanded: el.getAttribute("aria-expanded"),
        controlsTargetExists: !controls || controls.split(/\s+/).every((id) => !!document.getElementById(id)),
        safeToClick: el.tagName === "BUTTON" || el.tagName === "SUMMARY" || el.getAttribute("role") === "button"
      };
    });
  });
  if (candidates.length === 0) {
    return {
      recipe: "disclosure",
      wcag,
      status: "skipped",
      details: ["No elements with aria-expanded found."]
    };
  }
  const details = [];
  for (const c of candidates) {
    if (c.expanded !== "true" && c.expanded !== "false") {
      details.push(`${c.desc}: aria-expanded="${c.expanded}" \u2014 must be "true" or "false".`);
    }
    if (!c.controlsTargetExists) {
      details.push(`${c.desc}: aria-controls points to an id that does not exist.`);
    }
    if (!c.safeToClick) continue;
    const sel = `[data-a11y-behave-disclosure="${c.i}"]`;
    await page.evaluate((s) => document.querySelector(s)?.click(), sel);
    await page.waitForTimeout(150);
    const after = await page.evaluate(
      (s) => document.querySelector(s)?.getAttribute("aria-expanded") ?? null,
      sel
    );
    if (after === c.expanded) {
      details.push(
        `${c.desc}: activating the control did not toggle aria-expanded (stuck at "${c.expanded}").`
      );
    } else {
      await page.evaluate((s) => document.querySelector(s)?.click(), sel);
      await page.waitForTimeout(100);
    }
  }
  await page.evaluate(() => {
    for (const el of Array.from(
      document.querySelectorAll("[data-a11y-behave-disclosure]")
    )) {
      el.removeAttribute("data-a11y-behave-disclosure");
    }
  });
  return {
    recipe: "disclosure",
    wcag,
    status: details.length > 0 ? "fail" : "pass",
    details
  };
}
async function recipeMenuKeyboard(page) {
  const wcag = '2.1.1 Keyboard (role="menu" contract)';
  const state = await page.evaluate(() => {
    const isVisible = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
    const all = Array.from(
      document.querySelectorAll("[role=menu], [role=menubar]")
    );
    return { present: all.length > 0, open: all.some(isVisible) };
  });
  if (!state.present) {
    return {
      recipe: "menu-keyboard",
      wcag,
      status: "skipped",
      details: ['No role="menu" or role="menubar" on the page.']
    };
  }
  if (!state.open) {
    const trig = page.locator('[aria-haspopup="menu"], [aria-haspopup="true"]');
    if (await trig.count() === 0) {
      return {
        recipe: "menu-keyboard",
        wcag,
        status: "warn",
        details: [
          'role="menu" exists but is not visible and no aria-haspopup trigger was found to open it.'
        ]
      };
    }
    await trig.first().click();
    await page.waitForTimeout(200);
  }
  const focused = await page.evaluate(() => {
    const isVisible = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
    const menu = Array.from(
      document.querySelectorAll("[role=menu], [role=menubar]")
    ).find(isVisible);
    if (!menu) return null;
    const items = Array.from(
      menu.querySelectorAll(
        "[role=menuitem], [role=menuitemcheckbox], [role=menuitemradio]"
      )
    );
    if (items.length === 0) return { items: 0 };
    items[0]?.focus();
    return { items: items.length };
  });
  if (!focused) {
    return {
      recipe: "menu-keyboard",
      wcag,
      status: "warn",
      details: ["Could not open the menu to test its keyboard contract."]
    };
  }
  if (focused.items === 0) {
    return {
      recipe: "menu-keyboard",
      wcag,
      status: "fail",
      details: ['role="menu" contains no role="menuitem" children.']
    };
  }
  await page.keyboard.press("ArrowDown");
  const moved = await page.evaluate(() => {
    const menu = Array.from(
      document.querySelectorAll("[role=menu], [role=menubar]")
    ).find((el) => el.getClientRects().length > 0);
    if (!menu) return false;
    const items = Array.from(menu.querySelectorAll("[role^=menuitem]"));
    return items.indexOf(document.activeElement) > 0;
  });
  return {
    recipe: "menu-keyboard",
    wcag,
    status: moved ? "pass" : "fail",
    details: moved ? [] : [
      'role="menu" is declared but ArrowDown does not move focus between menu items \u2014 implement the full menu keyboard contract (arrows, Home/End) or use a plain list without role="menu".'
    ]
  };
}
async function recipeNavLabels(page) {
  const wcag = "1.3.1 Info and Relationships (landmarks)";
  const navs = await page.evaluate(() => {
    const isVisible = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
    const name = (el) => {
      const label = el.getAttribute("aria-label");
      if (label && label.trim()) return label.trim().toLowerCase();
      const lb = el.getAttribute("aria-labelledby");
      if (lb) {
        const text = lb.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? "").join(" ").trim();
        if (text) return text.toLowerCase();
      }
      return null;
    };
    return Array.from(
      document.querySelectorAll("nav, [role=navigation]")
    ).filter(isVisible).map((el, i) => ({ i: i + 1, name: name(el) }));
  });
  if (navs.length === 0) {
    return {
      recipe: "nav-labels",
      wcag,
      status: "skipped",
      details: ["No navigation landmarks on the page."]
    };
  }
  if (navs.length === 1) {
    return { recipe: "nav-labels", wcag, status: "pass", details: [] };
  }
  const details = [];
  for (const nav of navs) {
    if (!nav.name) {
      details.push(
        `Navigation landmark #${nav.i} has no aria-label/aria-labelledby \u2014 with ${navs.length} nav landmarks on the page, each needs a unique label.`
      );
    }
  }
  const seen = /* @__PURE__ */ new Map();
  for (const nav of navs) {
    if (!nav.name) continue;
    const firstIdx = seen.get(nav.name);
    if (firstIdx !== void 0) {
      details.push(
        `Navigation landmarks #${firstIdx} and #${nav.i} share the label "${nav.name}" \u2014 labels must be unique.`
      );
    } else {
      seen.set(nav.name, nav.i);
    }
  }
  return {
    recipe: "nav-labels",
    wcag,
    status: details.length > 0 ? "fail" : "pass",
    details
  };
}
async function recipeNavCurrent(page) {
  const wcag = "4.1.2 Name, Role, Value / 2.4.8 Location (AAA)";
  const res = await page.evaluate((currentUrl) => {
    const isVisible = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
    const normalize = (href) => {
      if (!href || href.startsWith("#") || href.toLowerCase().startsWith("javascript:")) {
        return null;
      }
      try {
        const u = new URL(href, document.baseURI);
        const path2 = u.pathname === "/" ? "/" : u.pathname.replace(/\/+$/, "");
        return `${u.origin}${path2}`;
      } catch {
        return null;
      }
    };
    const current = normalize(currentUrl);
    const navs = Array.from(
      document.querySelectorAll("nav, [role=navigation]")
    ).filter(isVisible);
    const issues = [];
    let anySelfLink = false;
    navs.forEach((nav, i) => {
      const links = Array.from(nav.querySelectorAll("a[href]")).filter(
        isVisible
      );
      const selfLinks = links.filter((a) => current && normalize(a.getAttribute("href") ?? "") === current);
      const flagged = links.filter((a) => a.getAttribute("aria-current") === "page");
      if (selfLinks.length > 0) {
        anySelfLink = true;
        const unflagged = selfLinks.filter((a) => a.getAttribute("aria-current") !== "page");
        if (unflagged.length > 0) {
          const text = (unflagged[0]?.textContent ?? "").trim().slice(0, 40);
          issues.push(
            `Navigation landmark #${i + 1}: link to the current page ("${text}") is missing aria-current="page".`
          );
        }
      }
      if (flagged.length > 1) {
        issues.push(
          `Navigation landmark #${i + 1}: ${flagged.length} links carry aria-current="page" \u2014 only the link to the actual current page should.`
        );
      }
    });
    return { issues, navCount: navs.length, anySelfLink };
  }, page.url());
  if (res.navCount === 0) {
    return {
      recipe: "nav-current",
      wcag,
      status: "skipped",
      details: ["No navigation landmarks on the page."]
    };
  }
  if (!res.anySelfLink && res.issues.length === 0) {
    return {
      recipe: "nav-current",
      wcag,
      status: "skipped",
      details: [
        "No navigation link resolves to the current page's URL \u2014 nothing to verify aria-current against."
      ]
    };
  }
  return {
    recipe: "nav-current",
    wcag,
    status: res.issues.length > 0 ? "fail" : "pass",
    details: res.issues
  };
}
var LANDMARK_SELECTOR = 'header, footer, [role="banner"], [role="contentinfo"], aside, [role="complementary"], main, [role="main"], nav, [role="navigation"], [role="region"], section[aria-label], section[aria-labelledby], [role="search"], form[aria-label], form[aria-labelledby]';
async function recipeRegionsHeadings(page) {
  const wcag = "1.3.1 Info and Relationships / 2.4.6 Headings and Labels";
  const res = await page.evaluate((landmarkSel) => {
    const isVisible = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
    const name = (el) => {
      const label = el.getAttribute("aria-label");
      if (label && label.trim()) return label.trim().toLowerCase();
      const lb = el.getAttribute("aria-labelledby");
      if (lb) {
        const text = lb.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? "").join(" ").trim();
        if (text) return text.toLowerCase();
      }
      return null;
    };
    const isTopLevel = (el) => !el.parentElement?.closest("article, aside, main, nav, section, [role]");
    const mains = Array.from(
      document.querySelectorAll('main, [role="main"]')
    ).filter(isVisible);
    const landmarks = Array.from(
      document.querySelectorAll(landmarkSel)
    ).filter(isVisible);
    const banners = landmarks.filter(
      (el) => el.getAttribute("role") === "banner" || el.tagName === "HEADER" && isTopLevel(el)
    );
    const contentinfos = landmarks.filter(
      (el) => el.getAttribute("role") === "contentinfo" || el.tagName === "FOOTER" && isTopLevel(el)
    );
    const asides = landmarks.filter(
      (el) => el.tagName === "ASIDE" || el.getAttribute("role") === "complementary"
    );
    const dupNames = (group, label) => {
      const out = [];
      if (group.length <= 1) return out;
      const unnamed = group.filter((el) => !name(el)).length;
      if (unnamed > 0) {
        out.push(
          `${unnamed} of ${group.length} ${label} landmark(s) have no accessible name \u2014 with more than one on the page, each needs a unique aria-label/aria-labelledby.`
        );
      }
      const seen = /* @__PURE__ */ new Map();
      group.forEach((el, i) => {
        const n = name(el);
        if (!n) return;
        const first = seen.get(n);
        if (first !== void 0) {
          out.push(
            `${label} landmarks #${first + 1} and #${i + 1} share the label "${n}" \u2014 labels must be unique.`
          );
        } else {
          seen.set(n, i);
        }
      });
      return out;
    };
    const landmarkIssues = [];
    if (mains.length === 0) {
      landmarkIssues.push(
        'No <main> (or role="main") landmark on the page \u2014 screen reader users have no way to jump directly to the primary content.'
      );
    } else if (mains.length > 1) {
      landmarkIssues.push(
        `${mains.length} <main> landmarks found \u2014 a page must have exactly one.`
      );
    }
    landmarkIssues.push(...dupNames(banners, "banner"));
    landmarkIssues.push(...dupNames(contentinfos, "contentinfo"));
    landmarkIssues.push(...dupNames(asides, "complementary"));
    const isLandmark = (el) => el.matches(landmarkSel);
    const orphans = [];
    const walk = (node) => {
      for (const child of Array.from(node.children)) {
        if (!isVisible(child)) continue;
        if (isLandmark(child)) continue;
        if (child.tagName === "SCRIPT" || child.tagName === "STYLE") continue;
        if (child.tagName === "A" && (child.getAttribute("href") ?? "").startsWith("#")) {
          continue;
        }
        const ownText = Array.from(child.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => (n.textContent ?? "").trim()).join(" ").trim();
        if (ownText.length > 0) {
          orphans.push(
            `<${child.tagName.toLowerCase()}> "${ownText.slice(0, 40)}" is not inside any landmark region.`
          );
        }
        walk(child);
      }
    };
    walk(document.body);
    const headingEls = Array.from(
      document.querySelectorAll("h1, h2, h3, h4, h5, h6, [role=heading]")
    ).filter(isVisible);
    const headings = headingEls.map((el) => {
      const tagLevel = /^H([1-6])$/.exec(el.tagName)?.[1];
      const level = tagLevel ? Number(tagLevel) : Number(el.getAttribute("aria-level") ?? "0");
      return { level, text: (el.textContent ?? "").trim(), desc: `<${el.tagName.toLowerCase()}>` };
    });
    const failHeadingIssues = [];
    const warnHeadingIssues = [];
    for (const h of headings.filter((h2) => h2.text.length === 0)) {
      failHeadingIssues.push(
        `${h.desc} has no accessible text \u2014 an empty heading breaks screen reader heading navigation.`
      );
    }
    const h1Count = headings.filter((h) => h.level === 1).length;
    if (h1Count === 0) {
      failHeadingIssues.push(
        "No <h1> on the page \u2014 screen reader users navigating by heading level have no top-level entry point."
      );
    } else if (h1Count > 1) {
      warnHeadingIssues.push(
        `${h1Count} <h1> elements found \u2014 most screen reader guidance expects a single top-level heading per page.`
      );
    }
    let prev = 0;
    for (const h of headings) {
      if (h.level === 0) continue;
      if (prev > 0 && h.level > prev + 1) {
        failHeadingIssues.push(
          `Heading level jumps from h${prev} to h${h.level} ("${h.text.slice(0, 40)}") \u2014 do not skip heading levels.`
        );
        break;
      }
      prev = h.level;
    }
    return { landmarkIssues, orphans, failHeadingIssues, warnHeadingIssues };
  }, LANDMARK_SELECTOR);
  const failDetails = [...res.landmarkIssues, ...res.failHeadingIssues];
  const warnDetails = [...res.orphans, ...res.warnHeadingIssues];
  if (failDetails.length > 0) {
    return { recipe: "regions-headings", wcag, status: "fail", details: failDetails };
  }
  if (warnDetails.length > 0) {
    return { recipe: "regions-headings", wcag, status: "warn", details: warnDetails };
  }
  return { recipe: "regions-headings", wcag, status: "pass", details: [] };
}
var VISUAL_HEADING_EXCLUDED_ANCESTORS = 'header, [role="banner"], nav, [role="navigation"], footer, [role="contentinfo"], button, a, [role="button"], [role="link"], [role="tab"], [role="menuitem"]';
async function recipeVisualHeadings(page) {
  const wcag = "1.3.1 Info and Relationships / 2.4.6 Headings and Labels";
  const res = await page.evaluate((excludedAncestorSel) => {
    const isVisible = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
    const isDecorative = (el) => el.tagName === "SVG" || el.tagName === "PATH" || el.getAttribute("aria-hidden") === "true";
    const baseSize = parseFloat(getComputedStyle(document.body).fontSize) || 16;
    const MAX_CANDIDATES = 30;
    const MIN_LEN = 3;
    const MAX_LEN = 120;
    const HAS_LETTER = /\p{L}/u;
    const candidates = [];
    const walk = (node) => {
      if (candidates.length >= MAX_CANDIDATES) return;
      for (const el of Array.from(node.children)) {
        if (!isVisible(el)) continue;
        if (el.tagName === "SCRIPT" || el.tagName === "STYLE") continue;
        if (/^H[1-6]$/.test(el.tagName) || el.getAttribute("role") === "heading") {
          continue;
        }
        if (el.matches(excludedAncestorSel)) continue;
        if (el.getAttribute("aria-hidden") === "true") continue;
        const meaningfulChildren = Array.from(el.children).filter((c) => !isDecorative(c));
        if (meaningfulChildren.length === 0) {
          const text = (el.textContent ?? "").trim().replace(/\s+/g, " ");
          if (text.length >= MIN_LEN && text.length <= MAX_LEN && HAS_LETTER.test(text)) {
            const cs = getComputedStyle(el);
            const fontSize = parseFloat(cs.fontSize) || 0;
            const fontWeight = parseFloat(cs.fontWeight) || 400;
            const bold = fontWeight >= 700;
            const ratio = fontSize / baseSize;
            if (ratio >= 1.6 || bold && ratio >= 1.3) {
              candidates.push({
                tag: el.tagName.toLowerCase(),
                text: text.slice(0, 60),
                fontSize: Math.round(fontSize),
                bold,
                ratio: Math.round(ratio * 10) / 10
              });
            }
          }
        } else {
          walk(el);
        }
      }
    };
    walk(document.body);
    return { candidates };
  }, VISUAL_HEADING_EXCLUDED_ANCESTORS);
  if (res.candidates.length === 0) {
    return { recipe: "visual-headings", wcag, status: "pass", details: [] };
  }
  return {
    recipe: "visual-headings",
    wcag,
    status: "warn",
    details: res.candidates.map(
      (c) => `<${c.tag}> "${c.text}" is ${c.ratio}x body text size (${c.fontSize}px${c.bold ? ", bold" : ""}) but isn't marked up as a heading \u2014 review whether it should be a real heading element or role="heading".`
    )
  };
}
async function recipeTable(page) {
  const wcag = "1.3.1 Info and Relationships (tables)";
  const tables = await page.evaluate(() => {
    const isVisible = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
    return Array.from(document.querySelectorAll("table")).filter(isVisible).slice(0, 10).map((t, i) => {
      t.setAttribute("data-a11y-behave-table", String(i));
      const hasCaption = !!(t.caption && (t.caption.textContent ?? "").trim()) || !!(t.getAttribute("aria-label") ?? "").trim() || !!t.getAttribute("aria-labelledby");
      const ths = Array.from(t.querySelectorAll("th"));
      const thsMissingScope = ths.filter(
        (th) => !th.hasAttribute("scope") && !th.hasAttribute("id")
      ).length;
      return {
        i,
        hasCaption,
        thCount: ths.length,
        thsMissingScope,
        sortable: !!t.querySelector("th[aria-sort]")
      };
    });
  });
  if (tables.length === 0) {
    return {
      recipe: "table",
      wcag,
      status: "skipped",
      details: ["No data tables on the page."]
    };
  }
  const details = [];
  for (const t of tables) {
    const label = `table #${t.i + 1}`;
    if (!t.hasCaption) {
      details.push(`${label}: missing <caption> (or aria-label/aria-labelledby).`);
    }
    if (t.thCount === 0) {
      details.push(`${label}: no <th> header cells \u2014 data tables need marked headers.`);
    } else if (t.thsMissingScope > 0) {
      details.push(
        `${label}: ${t.thsMissingScope} <th> cell(s) without scope (or id for the headers pattern).`
      );
    }
    if (t.sortable) {
      const sel = `[data-a11y-behave-table="${t.i}"] th[aria-sort]`;
      const before = await page.evaluate(
        (s) => document.querySelector(s)?.getAttribute("aria-sort") ?? null,
        sel
      );
      await page.evaluate((s) => {
        const th = document.querySelector(s);
        const button = th?.querySelector("button, [role=button]");
        (button ?? th)?.click();
      }, sel);
      await page.waitForTimeout(150);
      const after = await page.evaluate(
        (s) => document.querySelector(s)?.getAttribute("aria-sort") ?? null,
        sel
      );
      if (before === after) {
        details.push(
          `${label}: activating the sortable header did not change aria-sort (stuck at "${before}").`
        );
      }
    }
  }
  await page.evaluate(() => {
    for (const el of Array.from(document.querySelectorAll("[data-a11y-behave-table]"))) {
      el.removeAttribute("data-a11y-behave-table");
    }
  });
  return {
    recipe: "table",
    wcag,
    status: details.length > 0 ? "fail" : "pass",
    details
  };
}
async function recipeAutocomplete(page) {
  const wcag = "1.3.5 Identify Input Purpose";
  const res = await page.evaluate(() => {
    const isVisible = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
    const PERSONAL = /(e-?mail|phone|mobile|tel|first-?name|last-?name|full-?name|address|street|city|zip|postal|country|birth-?da(y|te))/i;
    const inputs = Array.from(
      document.querySelectorAll("input")
    ).filter(
      (el) => isVisible(el) && !["hidden", "checkbox", "radio", "submit", "button", "file"].includes(el.type)
    );
    const personal = inputs.filter(
      (el) => el.type === "email" || el.type === "tel" || PERSONAL.test(el.name) || PERSONAL.test(el.id)
    );
    return {
      personalCount: personal.length,
      missing: personal.filter((el) => !el.getAttribute("autocomplete")).map(
        (el) => `<input type="${el.type}"${el.name ? ` name="${el.name}"` : ""}${el.id ? ` id="${el.id}"` : ""}>`
      )
    };
  });
  if (res.personalCount === 0) {
    return {
      recipe: "autocomplete",
      wcag,
      status: "skipped",
      details: ["No personal-data inputs detected."]
    };
  }
  return {
    recipe: "autocomplete",
    wcag,
    status: res.missing.length > 0 ? "warn" : "pass",
    details: res.missing.map(
      (m) => `${m} looks like a personal-data field but has no autocomplete attribute.`
    )
  };
}
async function recipeFormNavigation(page) {
  const wcag = "1.3.1 Info and Relationships / 3.3.1 Error Identification / 3.3.2 Labels or Instructions";
  const res = await page.evaluate(() => {
    const isVisible = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
    const accessibleName = (el) => {
      const labelledby = el.getAttribute("aria-labelledby");
      if (labelledby) {
        const text = labelledby.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? "").join(" ").trim();
        if (text) return text;
      }
      const label = el.getAttribute("aria-label");
      if (label && label.trim()) return label.trim();
      if (el.id) {
        const forLabel = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (forLabel && (forLabel.textContent ?? "").trim()) {
          return (forLabel.textContent ?? "").trim();
        }
      }
      const wrapping = el.closest("label");
      if (wrapping && (wrapping.textContent ?? "").trim()) return (wrapping.textContent ?? "").trim();
      const title = el.getAttribute("title");
      if (title && title.trim()) return title.trim();
      return "";
    };
    const controls = Array.from(
      document.querySelectorAll(
        "input, select, textarea"
      )
    ).filter(
      (el) => isVisible(el) && !("type" in el && ["hidden", "submit", "button", "reset", "image"].includes(
        el.type
      ))
    );
    const unnamed = controls.filter((el) => accessibleName(el).length === 0).map((el) => {
      const type = "type" in el ? ` type="${el.type}"` : "";
      const nm = el.name ? ` name="${el.name}"` : "";
      const id = el.id ? ` id="${el.id}"` : "";
      return `<${el.tagName.toLowerCase()}${type}${nm}${id}> has no accessible name.`;
    });
    const radios = Array.from(
      document.querySelectorAll('input[type="radio"]')
    ).filter(isVisible);
    const byName = /* @__PURE__ */ new Map();
    for (const r of radios) {
      if (!r.name) continue;
      const arr = byName.get(r.name) ?? [];
      arr.push(r);
      byName.set(r.name, arr);
    }
    const groupIssues = [];
    for (const [groupName, members] of byName) {
      if (members.length <= 1) continue;
      const groupedByFieldset = (() => {
        const fs2 = members[0]?.closest("fieldset");
        if (!fs2) return false;
        const legend = fs2.querySelector("legend");
        return !!legend && (legend.textContent ?? "").trim().length > 0 && members.every((m) => m.closest("fieldset") === fs2);
      })();
      const radiogroupNamed = (() => {
        const rg = members[0]?.closest('[role="radiogroup"]');
        if (!rg) return false;
        return !!accessibleName(rg) && members.every((m) => m.closest('[role="radiogroup"]') === rg);
      })();
      if (!groupedByFieldset && !radiogroupNamed) {
        groupIssues.push(
          `Radio group "${groupName}" (${members.length} options) is not wrapped in a labelled <fieldset><legend> (or a named role="radiogroup") \u2014 screen reader users won't hear the group's purpose when they land on the first option.`
        );
      }
    }
    const invalid = Array.from(
      document.querySelectorAll('[aria-invalid="true"]')
    ).filter(isVisible);
    const errorIssues = [];
    for (const el of invalid) {
      const describedby = el.getAttribute("aria-describedby");
      const nm = "name" in el && el.name ? ` name="${el.name}"` : "";
      const desc = `<${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${nm}>`;
      if (!describedby) {
        errorIssues.push(
          `${desc} has aria-invalid="true" but no aria-describedby \u2014 the error text is never announced.`
        );
        continue;
      }
      const hasText = describedby.split(/\s+/).some((id) => (document.getElementById(id)?.textContent ?? "").trim().length > 0);
      if (!hasText) {
        errorIssues.push(
          `${desc} has aria-invalid="true" and aria-describedby="${describedby}" but the referenced element is missing or empty.`
        );
      }
    }
    return { unnamed, groupIssues, errorIssues, controlCount: controls.length };
  });
  if (res.controlCount === 0) {
    return {
      recipe: "form-navigation",
      wcag,
      status: "skipped",
      details: ["No form controls on the page."]
    };
  }
  const details = [...res.unnamed, ...res.groupIssues, ...res.errorIssues];
  return {
    recipe: "form-navigation",
    wcag,
    status: details.length > 0 ? "fail" : "pass",
    details
  };
}
async function recipeLiveRegionStatic(page) {
  const wcag = "4.1.3 Status Messages";
  const res = await page.evaluate(() => {
    const regions = Array.from(
      document.querySelectorAll("[role=alert], [role=status], [aria-live]")
    );
    const nested = regions.filter((el) => {
      const role = el.getAttribute("role");
      return (role === "alert" || role === "status") && el.parentElement?.closest("[aria-live]");
    }).map((el) => `<${el.tagName.toLowerCase()} role="${el.getAttribute("role")}">`);
    const staticAlerts = regions.filter(
      (el) => el.getAttribute("role") === "alert" && (el.textContent ?? "").trim().length > 0
    ).map((el) => (el.textContent ?? "").trim().slice(0, 60));
    return { total: regions.length, nested, staticAlerts };
  });
  if (res.total === 0) {
    return {
      recipe: "live-region-static",
      wcag,
      status: "skipped",
      details: [
        "No live regions in the DOM at load. If this app shows toasts or status messages, that absence is itself a problem \u2014 the container must exist before content is injected (judgment check)."
      ]
    };
  }
  const details = [];
  for (const n of res.nested) {
    details.push(
      `${n} is nested inside an aria-live container \u2014 the role already implies a live region; nesting causes double or missed announcements.`
    );
  }
  if (details.length > 0) {
    return { recipe: "live-region-static", wcag, status: "fail", details };
  }
  if (res.staticAlerts.length > 0) {
    return {
      recipe: "live-region-static",
      wcag,
      status: "warn",
      details: res.staticAlerts.map(
        (t) => `role="alert" contains static text at page load ("${t}") \u2014 alerts are for dynamic messages; static content will be announced on every load.`
      )
    };
  }
  return { recipe: "live-region-static", wcag, status: "pass", details: [] };
}
var ALL_RECIPES = [
  { name: "reflow-320", run: recipeReflow320 },
  { name: "zoom-200", run: recipeZoom200 },
  { name: "skip-link", run: recipeSkipLink },
  { name: "focus-visible", run: recipeFocusVisible },
  { name: "tab-order", run: recipeTabOrder },
  { name: "dialog", run: recipeDialog },
  { name: "disclosure", run: recipeDisclosure },
  { name: "menu-keyboard", run: recipeMenuKeyboard },
  { name: "nav-labels", run: recipeNavLabels },
  { name: "nav-current", run: recipeNavCurrent },
  { name: "regions-headings", run: recipeRegionsHeadings },
  { name: "visual-headings", run: recipeVisualHeadings },
  { name: "table", run: recipeTable },
  { name: "autocomplete", run: recipeAutocomplete },
  { name: "form-navigation", run: recipeFormNavigation },
  { name: "live-region-static", run: recipeLiveRegionStatic }
];
async function runRecipes(page, url, names, opts) {
  const selected = names ? ALL_RECIPES.filter((r) => names.includes(r.name)) : ALL_RECIPES;
  const results = [];
  for (const recipe of selected) {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15e3 });
    try {
      results.push(await recipe.run(page, opts));
    } catch (err) {
      results.push({
        recipe: recipe.name,
        wcag: "",
        status: "warn",
        details: [`Recipe did not complete: ${String(err)}`]
      });
    }
  }
  return results;
}
async function main() {
  try {
    require.resolve("playwright");
  } catch {
    console.error(`
a11y-sdk behave requires Playwright. Install it in your project:

  npm install --save-dev playwright
  npx playwright install chromium

Then re-run the behavioral audit.
`);
    process.exit(3);
  }
  const args = process.argv.slice(2);
  const consumed = /* @__PURE__ */ new Set();
  const argValue = (flag) => {
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === void 0) continue;
      if (a === flag && i + 1 < args.length) {
        consumed.add(i);
        consumed.add(i + 1);
        return args[i + 1];
      }
      if (a.startsWith(`${flag}=`)) {
        consumed.add(i);
        return a.slice(flag.length + 1);
      }
    }
    return void 0;
  };
  const dialogTrigger = argValue("--dialog-trigger");
  const recipesArg = argValue("--recipes");
  const urlArg = args.find((a, i) => !a.startsWith("--") && !consumed.has(i));
  if (!urlArg) {
    console.error(
      `Usage: node behave.cjs <url> [--recipes reflow-320,dialog,...] [--dialog-trigger "<css selector>"]
Available recipes: ${ALL_RECIPES.map((r) => r.name).join(", ")}`
    );
    process.exit(2);
  }
  let url;
  try {
    url = new URL(urlArg);
  } catch {
    console.error(`Invalid URL: ${urlArg}`);
    process.exit(2);
  }
  let names = null;
  if (recipesArg) {
    names = recipesArg.split(",").map((s) => s.trim()).filter(Boolean);
    const known = new Set(ALL_RECIPES.map((r) => r.name));
    const unknown = names.filter((n) => !known.has(n));
    if (unknown.length > 0) {
      console.error(
        `Unknown recipe(s): ${unknown.join(", ")}
Available: ${[...known].join(", ")}`
      );
      process.exit(2);
    }
  }
  const { chromium } = await import("playwright");
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch {
    console.error("Failed to launch Chromium. Run: npx playwright install chromium");
    process.exit(2);
  }
  const page = await browser.newPage();
  try {
    const response = await page.goto(url.toString(), {
      waitUntil: "domcontentloaded",
      timeout: 15e3
    });
    if (!response || !response.ok()) {
      console.error(`Page unreachable or returned error: ${url}`);
      await browser.close();
      process.exit(2);
    }
  } catch {
    console.error(`Could not reach ${url} \u2014 is the dev server running?`);
    await browser.close();
    process.exit(2);
  }
  const opts = dialogTrigger ? { dialogTrigger } : {};
  const results = await runRecipes(page, url.toString(), names, opts);
  await browser.close();
  const resultsDir = import_node_path.default.join(process.cwd(), ".a11y");
  if (import_node_fs.default.existsSync(resultsDir)) {
    import_node_fs.default.writeFileSync(
      import_node_path.default.join(resultsDir, "behave-results.json"),
      JSON.stringify({ url: url.toString(), results }, null, 2)
    );
  }
  console.log(formatBehaveResults(results));
  process.exit(exitCodeFor(results));
}
var isMain = typeof require !== "undefined" ? require.main === module : process.argv[1]?.endsWith("behave.ts") || process.argv[1]?.endsWith("behave.cjs");
if (isMain) {
  main().catch((err) => {
    console.error("Unexpected error:", err);
    process.exit(2);
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ALL_RECIPES,
  exitCodeFor,
  formatBehaveResults,
  recipeAutocomplete,
  recipeDialog,
  recipeDisclosure,
  recipeFocusVisible,
  recipeFormNavigation,
  recipeLiveRegionStatic,
  recipeMenuKeyboard,
  recipeNavCurrent,
  recipeNavLabels,
  recipeReflow320,
  recipeRegionsHeadings,
  recipeSkipLink,
  recipeTabOrder,
  recipeTable,
  recipeVisualHeadings,
  recipeZoom200,
  runRecipes
});
