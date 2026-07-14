import fs from "node:fs";
import path from "node:path";
import type { Page } from "playwright";

// Behavioral accessibility audit. Complements audit.ts (axe-core static scan)
// with deterministic *interaction* checks that axe cannot perform: focus
// trapping, keyboard contracts, reflow/zoom behavior, disclosure state.
// Each recipe is independent and runs against a freshly loaded page.

// --- Result types ---

export type RecipeStatus = "pass" | "fail" | "warn" | "skipped";

export interface RecipeResult {
  recipe: string;
  wcag: string;
  status: RecipeStatus;
  details: string[];
}

export interface BehaveOptions {
  /** CSS selector for the element that opens the modal dialog, when auto-detection can't find one. */
  dialogTrigger?: string;
}

const STATUS_ORDER: Record<RecipeStatus, number> = {
  fail: 0,
  warn: 1,
  pass: 2,
  skipped: 3,
};

const STATUS_MARK: Record<RecipeStatus, string> = {
  fail: "✖",
  warn: "⚠",
  pass: "✔",
  skipped: "–",
};

const MAX_DETAILS = 12;

function capDetails(details: string[]): string[] {
  if (details.length <= MAX_DETAILS) return details;
  const extra = details.length - MAX_DETAILS;
  return [...details.slice(0, MAX_DETAILS), `…and ${extra} more`];
}

/** Format recipe results into human-readable output, failures first. */
export function formatBehaveResults(results: RecipeResult[]): string {
  if (results.length === 0) return "No behavioral checks were run.";

  const sorted = [...results].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      a.recipe.localeCompare(b.recipe),
  );

  const lines: string[] = [];
  for (const r of sorted) {
    const wcag = r.wcag ? ` — WCAG ${r.wcag}` : "";
    lines.push(`${STATUS_MARK[r.status]} ${r.recipe}${wcag} [${r.status}]`);
    for (const d of capDetails(r.details)) lines.push(`    ${d}`);
  }

  const count = (s: RecipeStatus) => results.filter((r) => r.status === s).length;
  lines.push("");
  lines.push(
    `${count("fail")} failed, ${count("warn")} warning(s), ${count("pass")} passed, ${count("skipped")} not applicable.`,
  );
  return lines.join("\n");
}

/** Exit code contract: 1 when any recipe failed, 0 otherwise (warns don't block). */
export function exitCodeFor(results: RecipeResult[]): number {
  return results.some((r) => r.status === "fail") ? 1 : 0;
}

// --- Recipes ---

async function measureOverflow(
  page: Page,
): Promise<{ scrollWidth: number; clientWidth: number }> {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
}

/** 1.4.10 Reflow — no horizontal scrolling at 320px viewport width. */
export async function recipeReflow320(page: Page): Promise<RecipeResult> {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.waitForTimeout(200); // let responsive layout settle
  const { scrollWidth, clientWidth } = await measureOverflow(page);
  const overflow = scrollWidth - clientWidth;
  const fails = overflow > 1;
  return {
    recipe: "reflow-320",
    wcag: "1.4.10 Reflow",
    status: fails ? "fail" : "pass",
    details: fails
      ? [
          `Horizontal overflow of ${overflow}px at 320px viewport (scrollWidth ${scrollWidth} > clientWidth ${clientWidth}). Content must reflow to a single column.`,
        ]
      : [],
  };
}

/**
 * 1.4.4 Resize Text — emulates 200% full-page zoom (viewport 640px ≈ 1280px at
 * 200%) and checks for horizontal overflow. Secondarily verifies that text
 * responds to root font-size scaling (rem/em rather than hard px anchoring).
 */
export async function recipeZoom200(page: Page): Promise<RecipeResult> {
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
        `Horizontal overflow of ${overflow}px at 200%-zoom-equivalent width (640px). UI must remain usable at 200% zoom without horizontal scrolling.`,
      ],
    };
  }

  // Text-scaling probe: double the root font size and see if any sampled text grows.
  const textResponds = await page.evaluate(() => {
    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>(
        "p, span, a, li, button, label, h1, h2, h3, h4, h5, h6, td, th, input",
      ),
    )
      .filter(
        (el) =>
          el.getClientRects().length > 0 &&
          (el.textContent ?? "").trim().length > 0,
      )
      .slice(0, 30);
    if (candidates.length === 0) return true; // nothing to measure
    const before = candidates.map((el) => getComputedStyle(el).fontSize);
    document.documentElement.style.fontSize = "200%";
    const changed = candidates.some(
      (el, i) => getComputedStyle(el).fontSize !== before[i],
    );
    document.documentElement.style.fontSize = "";
    return changed;
  });

  return {
    recipe: "zoom-200",
    wcag: "1.4.4 Resize Text",
    status: textResponds ? "pass" : "warn",
    details: textResponds
      ? []
      : [
          "No sampled text responds to root font-size scaling — font sizes appear hard-anchored in px. Prefer rem/em so user font-size settings take effect.",
        ],
  };
}

/** 2.4.1 Bypass Blocks — first Tab stop must be an in-page skip link when navigation exists. */
export async function recipeSkipLink(page: Page): Promise<RecipeResult> {
  const wcag = "2.4.1 Bypass Blocks";
  const navCount = await page.locator("nav, [role=navigation]").count();
  if (navCount === 0) {
    return {
      recipe: "skip-link",
      wcag,
      status: "skipped",
      details: ["No navigation landmark on the page — a skip link is not required."],
    };
  }

  await page.keyboard.press("Tab");
  const first = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
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
      text: (el.textContent ?? "").trim().slice(0, 60),
    };
  });

  if (!first) {
    return {
      recipe: "skip-link",
      wcag,
      status: "fail",
      details: ["Nothing receives focus on the first Tab press — the page has no reachable skip link."],
    };
  }

  const ok = first.tag === "a" && first.href.startsWith("#") && first.targetExists;
  return {
    recipe: "skip-link",
    wcag,
    status: ok ? "pass" : "fail",
    details: ok
      ? []
      : [
          `First focusable element is <${first.tag}> "${first.text}" (href="${first.href}") — expected a skip link (an <a href="#…"> whose target exists) as the first Tab stop.`,
        ],
  };
}

/** 2.4.7 Focus Visible — every Tab stop must change its computed style when focused. */
export async function recipeFocusVisible(page: Page): Promise<RecipeResult> {
  const wcag = "2.4.7 Focus Visible";
  const MAX_STOPS = 40;
  const stops: { idx: number; desc: string; style: string }[] = [];

  for (let i = 0; i < MAX_STOPS; i++) {
    await page.keyboard.press("Tab");
    const snap = await page.evaluate(
      (idx): null | { cycled: true } | { cycled: false; desc: string; style: string } => {
        const el = document.activeElement as HTMLElement | null;
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
          cs.textDecorationLine,
        ].join("|");
        const id = el.id ? `#${el.id}` : "";
        const text = (el.textContent ?? el.getAttribute("aria-label") ?? "")
          .trim()
          .slice(0, 40);
        return { cycled: false, style, desc: `<${el.tagName.toLowerCase()}${id}> "${text}"` };
      },
      i,
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
      details: ["No keyboard-focusable elements found on the page."],
    };
  }

  // Second pass: blur everything and read the unfocused styles of the same elements.
  const unfocused = await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    const out: Record<string, string> = {};
    for (const el of Array.from(
      document.querySelectorAll<HTMLElement>("[data-a11y-behave-stop]"),
    )) {
      const cs = getComputedStyle(el);
      out[el.getAttribute("data-a11y-behave-stop") ?? ""] = [
        cs.outlineStyle,
        cs.outlineWidth,
        cs.outlineColor,
        cs.boxShadow,
        cs.borderColor,
        cs.backgroundColor,
        cs.textDecorationLine,
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
      (o) =>
        `${o.desc}: no computed style change between focused and unfocused states — the focus indicator is missing (outline removed without replacement?).`,
    ),
  };
}

const INTERACTIVE_ROLE_SELECTOR =
  "[role=button],[role=link],[role=checkbox],[role=radio],[role=switch],[role=menuitem],[role=menuitemcheckbox],[role=menuitemradio],[role=tab],[role=option]";

const COMPOSITE_CONTAINER_SELECTOR =
  "[role=menu],[role=menubar],[role=tablist],[role=listbox],[role=radiogroup],[role=tree],[role=treegrid],[role=grid]";

/**
 * Keyboard-user persona: tab-stop navigation. 2.1.1 Keyboard / 2.4.3 Focus
 * Order — every ARIA-interactive element must be reachable by Tab (unless
 * it's a roving-tabindex item inside a composite widget), tabindex must
 * never be positive, and Shift+Tab must retrace the exact reverse of the Tab
 * sequence. Asymmetric forward/backward focus management is a common
 * keyboard-trap pattern that axe cannot see because it never presses a key.
 */
export async function recipeTabOrder(page: Page): Promise<RecipeResult> {
  const wcag = "2.1.1 Keyboard / 2.4.3 Focus Order";
  const details: string[] = [];

  const statics = await page.evaluate(
    ({ roleSel, compositeSel }) => {
      const isVisible = (el: Element) =>
        (el as HTMLElement).getClientRects().length > 0 &&
        getComputedStyle(el).visibility !== "hidden";
      const describe = (el: HTMLElement) => {
        const id = el.id ? `#${el.id}` : "";
        const text = (el.textContent ?? el.getAttribute("aria-label") ?? "")
          .trim()
          .slice(0, 40);
        return `<${el.tagName.toLowerCase()}${id} role="${el.getAttribute("role")}"> "${text}"`;
      };

      const positiveTabindex = Array.from(
        document.querySelectorAll<HTMLElement>("[tabindex]"),
      )
        .filter((el) => isVisible(el) && Number(el.getAttribute("tabindex")) > 0)
        .map(
          (el) =>
            `<${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}> tabindex="${el.getAttribute("tabindex")}" — positive tabindex creates a separate tab order; reorder the DOM instead.`,
        );

      const unreachable = Array.from(
        document.querySelectorAll<HTMLElement>(roleSel),
      )
        .filter(
          (el) => isVisible(el) && !el.closest(compositeSel) && el.tabIndex < 0,
        )
        .map(
          (el) =>
            `${describe(el)} is not keyboard-focusable (add tabindex="0" or use a native interactive element).`,
        );

      return { positiveTabindex, unreachable };
    },
    { roleSel: INTERACTIVE_ROLE_SELECTOR, compositeSel: COMPOSITE_CONTAINER_SELECTOR },
  );
  details.push(...statics.positiveTabindex, ...statics.unreachable);

  // Forward pass: Tab through the page, tagging each distinct stop in order.
  const MAX_STOPS = 40;
  let stopCount = 0;
  for (let i = 0; i < MAX_STOPS; i++) {
    await page.keyboard.press("Tab");
    const tagged = await page.evaluate((idx) => {
      const el = document.activeElement as HTMLElement | null;
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
      details:
        details.length > 0
          ? details
          : ["No keyboard-focusable elements found on the page."],
    };
  }

  // Backward pass: from the last stop, Shift+Tab must retrace stops
  // (stopCount - 2) down to 0 in exact reverse order.
  if (stopCount > 1) {
    await page.evaluate((last) => {
      document
        .querySelector<HTMLElement>(`[data-a11y-behave-taborder="${last}"]`)
        ?.focus();
    }, stopCount - 1);

    for (let i = stopCount - 2; i >= 0; i--) {
      await page.keyboard.press("Shift+Tab");
      const at = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        const v = el?.getAttribute("data-a11y-behave-taborder");
        return v === null || v === undefined ? null : Number(v);
      });
      if (at !== i) {
        details.push(
          `Shift+Tab landed on stop ${at ?? "an untracked element"} instead of stop ${i} — Tab and Shift+Tab must retrace the same sequence in reverse.`,
        );
        break;
      }
    }
  }

  await page.evaluate(() => {
    for (const el of Array.from(
      document.querySelectorAll("[data-a11y-behave-taborder]"),
    )) {
      el.removeAttribute("data-a11y-behave-taborder");
    }
  });

  return {
    recipe: "tab-order",
    wcag,
    status: details.length > 0 ? "fail" : "pass",
    details,
  };
}

/** Modal dialog contract — aria-modal, accessible name, focus trap, Escape, focus restore. */
export async function recipeDialog(
  page: Page,
  opts: BehaveOptions,
): Promise<RecipeResult> {
  const wcag = "2.1.2 No Keyboard Trap / 4.1.2 Name, Role, Value";
  const details: string[] = [];

  const state = await page.evaluate(() => {
    const isVisible = (el: Element) =>
      (el as HTMLElement).getClientRects().length > 0 &&
      getComputedStyle(el).visibility !== "hidden";
    const dialogs = Array.from(document.querySelectorAll("[role=dialog], dialog"));
    return {
      present: dialogs.length > 0,
      open: dialogs.some(isVisible),
    };
  });

  let trigger: string | null = null;
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
            "A dialog exists in the DOM but no trigger was found to open it. Re-run with --dialog-trigger \"<selector>\" to test its behavior.",
          ],
        };
      }
      return {
        recipe: "dialog",
        wcag,
        status: "skipped",
        details: ["No dialog or dialog trigger found on the page."],
      };
    }
    trigger = triggerSel;
    await page.locator(triggerSel).first().click();
    await page.waitForTimeout(300);
  }

  const contract = await page.evaluate(() => {
    const isVisible = (el: Element) =>
      (el as HTMLElement).getClientRects().length > 0 &&
      getComputedStyle(el).visibility !== "hidden";
    const dlg = Array.from(
      document.querySelectorAll<HTMLElement>("[role=dialog], dialog"),
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
        `Clicked the trigger (${trigger}) but no visible dialog appeared. Pass --dialog-trigger "<selector>" if a different control opens it.`,
      ],
    };
  }

  if (!contract.native && !contract.ariaModal) {
    details.push('Dialog is missing aria-modal="true".');
  }
  if (!contract.hasName) {
    details.push(
      "Dialog has no accessible name — add aria-labelledby pointing to the title, or aria-label.",
    );
  }
  if (trigger && !contract.focusInside) {
    details.push("Focus did not move inside the dialog when it opened.");
  }

  // Focus trap: Tab repeatedly; focus must stay inside the dialog.
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press("Tab");
    const inside = await page.evaluate(() => {
      const dlg = document.querySelector("[data-a11y-behave-dialog]");
      return !!dlg && dlg.contains(document.activeElement);
    });
    if (!inside) {
      details.push(
        "Focus escaped the open dialog while Tabbing — modal dialogs must trap focus (Tab and Shift+Tab cycle only within the dialog).",
      );
      break;
    }
  }

  // Escape must close the dialog.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  const stillVisible = await page.evaluate(() => {
    const dlg = document.querySelector<HTMLElement>("[data-a11y-behave-dialog]");
    return (
      !!dlg &&
      dlg.getClientRects().length > 0 &&
      getComputedStyle(dlg).visibility !== "hidden"
    );
  });
  if (stillVisible) {
    details.push("Escape did not close the dialog.");
  } else if (trigger) {
    const restored = await page.evaluate(
      (sel) => document.querySelector(sel) === document.activeElement,
      trigger,
    );
    if (!restored) {
      details.push(
        "After closing, focus did not return to the element that opened the dialog.",
      );
    }
  }

  await page.evaluate(() =>
    document
      .querySelector("[data-a11y-behave-dialog]")
      ?.removeAttribute("data-a11y-behave-dialog"),
  );

  return {
    recipe: "dialog",
    wcag,
    status: details.length > 0 ? "fail" : "pass",
    details,
  };
}

/** 4.1.2 — aria-expanded toggles must actually toggle, and aria-controls must resolve. */
export async function recipeDisclosure(page: Page): Promise<RecipeResult> {
  const wcag = "4.1.2 Name, Role, Value";
  const candidates = await page.evaluate(() => {
    const isVisible = (el: Element) =>
      (el as HTMLElement).getClientRects().length > 0 &&
      getComputedStyle(el).visibility !== "hidden";
    return Array.from(document.querySelectorAll<HTMLElement>("[aria-expanded]"))
      .filter(isVisible)
      .slice(0, 10)
      .map((el, i) => {
        el.setAttribute("data-a11y-behave-disclosure", String(i));
        const controls = el.getAttribute("aria-controls");
        return {
          i,
          desc: `<${el.tagName.toLowerCase()}> "${(el.textContent ?? el.getAttribute("aria-label") ?? "").trim().slice(0, 40)}"`,
          expanded: el.getAttribute("aria-expanded"),
          controlsTargetExists:
            !controls ||
            controls.split(/\s+/).every((id) => !!document.getElementById(id)),
          safeToClick:
            el.tagName === "BUTTON" ||
            el.tagName === "SUMMARY" ||
            el.getAttribute("role") === "button",
        };
      });
  });

  if (candidates.length === 0) {
    return {
      recipe: "disclosure",
      wcag,
      status: "skipped",
      details: ["No elements with aria-expanded found."],
    };
  }

  const details: string[] = [];
  for (const c of candidates) {
    if (c.expanded !== "true" && c.expanded !== "false") {
      details.push(`${c.desc}: aria-expanded="${c.expanded}" — must be "true" or "false".`);
    }
    if (!c.controlsTargetExists) {
      details.push(`${c.desc}: aria-controls points to an id that does not exist.`);
    }
    if (!c.safeToClick) continue; // don't activate links — they may navigate

    const sel = `[data-a11y-behave-disclosure="${c.i}"]`;
    // Synthetic clicks so overlays opened by earlier toggles can't block the check.
    await page.evaluate((s) => (document.querySelector(s) as HTMLElement | null)?.click(), sel);
    await page.waitForTimeout(150);
    const after = await page.evaluate(
      (s) => document.querySelector(s)?.getAttribute("aria-expanded") ?? null,
      sel,
    );
    if (after === c.expanded) {
      details.push(
        `${c.desc}: activating the control did not toggle aria-expanded (stuck at "${c.expanded}").`,
      );
    } else {
      // restore original state
      await page.evaluate((s) => (document.querySelector(s) as HTMLElement | null)?.click(), sel);
      await page.waitForTimeout(100);
    }
  }

  await page.evaluate(() => {
    for (const el of Array.from(
      document.querySelectorAll("[data-a11y-behave-disclosure]"),
    )) {
      el.removeAttribute("data-a11y-behave-disclosure");
    }
  });

  return {
    recipe: "disclosure",
    wcag,
    status: details.length > 0 ? "fail" : "pass",
    details,
  };
}

/** 2.1.1 — role="menu" must implement the arrow-key contract it promises. */
export async function recipeMenuKeyboard(page: Page): Promise<RecipeResult> {
  const wcag = '2.1.1 Keyboard (role="menu" contract)';
  const state = await page.evaluate(() => {
    const isVisible = (el: Element) =>
      (el as HTMLElement).getClientRects().length > 0 &&
      getComputedStyle(el).visibility !== "hidden";
    const all = Array.from(
      document.querySelectorAll<HTMLElement>("[role=menu], [role=menubar]"),
    );
    return { present: all.length > 0, open: all.some(isVisible) };
  });

  if (!state.present) {
    return {
      recipe: "menu-keyboard",
      wcag,
      status: "skipped",
      details: ['No role="menu" or role="menubar" on the page.'],
    };
  }

  if (!state.open) {
    const trig = page.locator('[aria-haspopup="menu"], [aria-haspopup="true"]');
    if ((await trig.count()) === 0) {
      return {
        recipe: "menu-keyboard",
        wcag,
        status: "warn",
        details: [
          'role="menu" exists but is not visible and no aria-haspopup trigger was found to open it.',
        ],
      };
    }
    await trig.first().click();
    await page.waitForTimeout(200);
  }

  const focused = await page.evaluate(() => {
    const isVisible = (el: Element) =>
      (el as HTMLElement).getClientRects().length > 0 &&
      getComputedStyle(el).visibility !== "hidden";
    const menu = Array.from(
      document.querySelectorAll<HTMLElement>("[role=menu], [role=menubar]"),
    ).find(isVisible);
    if (!menu) return null;
    const items = Array.from(
      menu.querySelectorAll<HTMLElement>(
        "[role=menuitem], [role=menuitemcheckbox], [role=menuitemradio]",
      ),
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
      details: ["Could not open the menu to test its keyboard contract."],
    };
  }
  if (focused.items === 0) {
    return {
      recipe: "menu-keyboard",
      wcag,
      status: "fail",
      details: ['role="menu" contains no role="menuitem" children.'],
    };
  }

  await page.keyboard.press("ArrowDown");
  const moved = await page.evaluate(() => {
    const menu = Array.from(
      document.querySelectorAll<HTMLElement>("[role=menu], [role=menubar]"),
    ).find((el) => el.getClientRects().length > 0);
    if (!menu) return false;
    const items = Array.from(menu.querySelectorAll("[role^=menuitem]"));
    return items.indexOf(document.activeElement as Element) > 0;
  });

  return {
    recipe: "menu-keyboard",
    wcag,
    status: moved ? "pass" : "fail",
    details: moved
      ? []
      : [
          'role="menu" is declared but ArrowDown does not move focus between menu items — implement the full menu keyboard contract (arrows, Home/End) or use a plain list without role="menu".',
        ],
  };
}

/** Multiple <nav> landmarks must have unique accessible names. */
export async function recipeNavLabels(page: Page): Promise<RecipeResult> {
  const wcag = "1.3.1 Info and Relationships (landmarks)";
  const navs = await page.evaluate(() => {
    const isVisible = (el: Element) =>
      (el as HTMLElement).getClientRects().length > 0 &&
      getComputedStyle(el).visibility !== "hidden";
    const name = (el: HTMLElement): string | null => {
      const label = el.getAttribute("aria-label");
      if (label && label.trim()) return label.trim().toLowerCase();
      const lb = el.getAttribute("aria-labelledby");
      if (lb) {
        const text = lb
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? "")
          .join(" ")
          .trim();
        if (text) return text.toLowerCase();
      }
      return null;
    };
    return Array.from(
      document.querySelectorAll<HTMLElement>("nav, [role=navigation]"),
    )
      .filter(isVisible)
      .map((el, i) => ({ i: i + 1, name: name(el) }));
  });

  if (navs.length === 0) {
    return {
      recipe: "nav-labels",
      wcag,
      status: "skipped",
      details: ["No navigation landmarks on the page."],
    };
  }
  if (navs.length === 1) {
    return { recipe: "nav-labels", wcag, status: "pass", details: [] };
  }

  const details: string[] = [];
  for (const nav of navs) {
    if (!nav.name) {
      details.push(
        `Navigation landmark #${nav.i} has no aria-label/aria-labelledby — with ${navs.length} nav landmarks on the page, each needs a unique label.`,
      );
    }
  }
  const seen = new Map<string, number>();
  for (const nav of navs) {
    if (!nav.name) continue;
    const firstIdx = seen.get(nav.name);
    if (firstIdx !== undefined) {
      details.push(
        `Navigation landmarks #${firstIdx} and #${nav.i} share the label "${nav.name}" — labels must be unique.`,
      );
    } else {
      seen.set(nav.name, nav.i);
    }
  }

  return {
    recipe: "nav-labels",
    wcag,
    status: details.length > 0 ? "fail" : "pass",
    details,
  };
}

/**
 * Navigation "you are here" state. 4.1.2 Name, Role, Value / 2.4.8 Location
 * (AAA). A screen reader user relies on `aria-current="page"` to know which
 * nav link represents the page they're already on. For every nav landmark,
 * if one of its links resolves to the current page's URL (path only —
 * query/hash ignored, and in-page "#" anchors are never treated as a
 * separate page), that link must carry `aria-current="page"`, and it must
 * be the only one that does. Pages with no self-referencing nav link (SPA
 * navs driven entirely by JS, or a page not represented in the nav at all)
 * skip cleanly rather than guessing.
 */
export async function recipeNavCurrent(page: Page): Promise<RecipeResult> {
  const wcag = '4.1.2 Name, Role, Value / 2.4.8 Location (AAA)';

  const res = await page.evaluate((currentUrl) => {
    const isVisible = (el: Element) =>
      (el as HTMLElement).getClientRects().length > 0 &&
      getComputedStyle(el).visibility !== "hidden";

    const normalize = (href: string): string | null => {
      if (!href || href.startsWith("#") || href.toLowerCase().startsWith("javascript:")) {
        return null;
      }
      try {
        const u = new URL(href, document.baseURI);
        const path = u.pathname === "/" ? "/" : u.pathname.replace(/\/+$/, "");
        return `${u.origin}${path}`;
      } catch {
        return null;
      }
    };

    const current = normalize(currentUrl);
    const navs = Array.from(
      document.querySelectorAll<HTMLElement>("nav, [role=navigation]"),
    ).filter(isVisible);

    const issues: string[] = [];
    let anySelfLink = false;

    navs.forEach((nav, i) => {
      const links = Array.from(nav.querySelectorAll<HTMLAnchorElement>("a[href]")).filter(
        isVisible,
      );
      const selfLinks = links.filter((a) => current && normalize(a.getAttribute("href") ?? "") === current);
      const flagged = links.filter((a) => a.getAttribute("aria-current") === "page");

      if (selfLinks.length > 0) {
        anySelfLink = true;
        const unflagged = selfLinks.filter((a) => a.getAttribute("aria-current") !== "page");
        if (unflagged.length > 0) {
          const text = (unflagged[0]?.textContent ?? "").trim().slice(0, 40);
          issues.push(
            `Navigation landmark #${i + 1}: link to the current page ("${text}") is missing aria-current="page".`,
          );
        }
      }
      if (flagged.length > 1) {
        issues.push(
          `Navigation landmark #${i + 1}: ${flagged.length} links carry aria-current="page" — only the link to the actual current page should.`,
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
      details: ["No navigation landmarks on the page."],
    };
  }
  if (!res.anySelfLink && res.issues.length === 0) {
    return {
      recipe: "nav-current",
      wcag,
      status: "skipped",
      details: [
        "No navigation link resolves to the current page's URL — nothing to verify aria-current against.",
      ],
    };
  }

  return {
    recipe: "nav-current",
    wcag,
    status: res.issues.length > 0 ? "fail" : "pass",
    details: res.issues,
  };
}

const LANDMARK_SELECTOR =
  'header, footer, [role="banner"], [role="contentinfo"], aside, [role="complementary"], main, [role="main"], nav, [role="navigation"], [role="region"], section[aria-label], section[aria-labelledby], [role="search"], form[aria-label], form[aria-labelledby]';

/**
 * Screen-reader persona: region and heading navigation (the "rotor" model —
 * jumping page structure by landmark or heading level, independent of any
 * single widget). 1.3.1 Info and Relationships / 2.4.6 Headings and Labels.
 * Fails on structural defects (no/duplicate <main>, unnamed/duplicate
 * banner-contentinfo-complementary landmarks when more than one exists, no
 * <h1>, skipped heading levels, empty headings); warns on content that sits
 * outside every landmark, since that heuristic has legitimate exceptions.
 */
export async function recipeRegionsHeadings(page: Page): Promise<RecipeResult> {
  const wcag = "1.3.1 Info and Relationships / 2.4.6 Headings and Labels";

  const res = await page.evaluate((landmarkSel) => {
    const isVisible = (el: Element) =>
      (el as HTMLElement).getClientRects().length > 0 &&
      getComputedStyle(el).visibility !== "hidden";
    const name = (el: HTMLElement): string | null => {
      const label = el.getAttribute("aria-label");
      if (label && label.trim()) return label.trim().toLowerCase();
      const lb = el.getAttribute("aria-labelledby");
      if (lb) {
        const text = lb
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? "")
          .join(" ")
          .trim();
        if (text) return text.toLowerCase();
      }
      return null;
    };
    const isTopLevel = (el: HTMLElement) =>
      !el.parentElement?.closest("article, aside, main, nav, section, [role]");

    const mains = Array.from(
      document.querySelectorAll<HTMLElement>('main, [role="main"]'),
    ).filter(isVisible);
    const landmarks = Array.from(
      document.querySelectorAll<HTMLElement>(landmarkSel),
    ).filter(isVisible);
    const banners = landmarks.filter(
      (el) =>
        el.getAttribute("role") === "banner" ||
        (el.tagName === "HEADER" && isTopLevel(el)),
    );
    const contentinfos = landmarks.filter(
      (el) =>
        el.getAttribute("role") === "contentinfo" ||
        (el.tagName === "FOOTER" && isTopLevel(el)),
    );
    const asides = landmarks.filter(
      (el) => el.tagName === "ASIDE" || el.getAttribute("role") === "complementary",
    );

    const dupNames = (group: HTMLElement[], label: string): string[] => {
      const out: string[] = [];
      if (group.length <= 1) return out;
      const unnamed = group.filter((el) => !name(el)).length;
      if (unnamed > 0) {
        out.push(
          `${unnamed} of ${group.length} ${label} landmark(s) have no accessible name — with more than one on the page, each needs a unique aria-label/aria-labelledby.`,
        );
      }
      const seen = new Map<string, number>();
      group.forEach((el, i) => {
        const n = name(el);
        if (!n) return;
        const first = seen.get(n);
        if (first !== undefined) {
          out.push(
            `${label} landmarks #${first + 1} and #${i + 1} share the label "${n}" — labels must be unique.`,
          );
        } else {
          seen.set(n, i);
        }
      });
      return out;
    };

    const landmarkIssues: string[] = [];
    if (mains.length === 0) {
      landmarkIssues.push(
        'No <main> (or role="main") landmark on the page — screen reader users have no way to jump directly to the primary content.',
      );
    } else if (mains.length > 1) {
      landmarkIssues.push(
        `${mains.length} <main> landmarks found — a page must have exactly one.`,
      );
    }
    landmarkIssues.push(...dupNames(banners, "banner"));
    landmarkIssues.push(...dupNames(contentinfos, "contentinfo"));
    landmarkIssues.push(...dupNames(asides, "complementary"));

    // Content that sits directly under a non-landmark ancestor chain up to
    // <body>, with its own visible text — unreachable via landmark navigation.
    const isLandmark = (el: Element) => el.matches(landmarkSel);
    const orphans: string[] = [];
    const walk = (node: Element) => {
      for (const child of Array.from(node.children)) {
        if (!isVisible(child)) continue;
        if (isLandmark(child)) continue;
        if (child.tagName === "SCRIPT" || child.tagName === "STYLE") continue;
        // In-page bypass/skip links are a documented exception — they
        // intentionally sit outside every landmark and are already covered
        // by the dedicated skip-link recipe.
        if (
          child.tagName === "A" &&
          (child.getAttribute("href") ?? "").startsWith("#")
        ) {
          continue;
        }
        const ownText = Array.from(child.childNodes)
          .filter((n) => n.nodeType === Node.TEXT_NODE)
          .map((n) => (n.textContent ?? "").trim())
          .join(" ")
          .trim();
        if (ownText.length > 0) {
          orphans.push(
            `<${child.tagName.toLowerCase()}> "${ownText.slice(0, 40)}" is not inside any landmark region.`,
          );
        }
        walk(child);
      }
    };
    walk(document.body);

    const headingEls = Array.from(
      document.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6, [role=heading]"),
    ).filter(isVisible);
    const headings = headingEls.map((el) => {
      const tagLevel = /^H([1-6])$/.exec(el.tagName)?.[1];
      const level = tagLevel ? Number(tagLevel) : Number(el.getAttribute("aria-level") ?? "0");
      return { level, text: (el.textContent ?? "").trim(), desc: `<${el.tagName.toLowerCase()}>` };
    });

    const failHeadingIssues: string[] = [];
    const warnHeadingIssues: string[] = [];
    for (const h of headings.filter((h) => h.text.length === 0)) {
      failHeadingIssues.push(
        `${h.desc} has no accessible text — an empty heading breaks screen reader heading navigation.`,
      );
    }
    const h1Count = headings.filter((h) => h.level === 1).length;
    if (h1Count === 0) {
      failHeadingIssues.push(
        "No <h1> on the page — screen reader users navigating by heading level have no top-level entry point.",
      );
    } else if (h1Count > 1) {
      warnHeadingIssues.push(
        `${h1Count} <h1> elements found — most screen reader guidance expects a single top-level heading per page.`,
      );
    }
    let prev = 0;
    for (const h of headings) {
      if (h.level === 0) continue;
      if (prev > 0 && h.level > prev + 1) {
        failHeadingIssues.push(
          `Heading level jumps from h${prev} to h${h.level} ("${h.text.slice(0, 40)}") — do not skip heading levels.`,
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

/** Data table contract — caption/name, header cells with scope, aria-sort toggling. */
export async function recipeTable(page: Page): Promise<RecipeResult> {
  const wcag = "1.3.1 Info and Relationships (tables)";
  const tables = await page.evaluate(() => {
    const isVisible = (el: Element) =>
      (el as HTMLElement).getClientRects().length > 0 &&
      getComputedStyle(el).visibility !== "hidden";
    return Array.from(document.querySelectorAll("table"))
      .filter(isVisible)
      .slice(0, 10)
      .map((t, i) => {
        t.setAttribute("data-a11y-behave-table", String(i));
        const hasCaption =
          !!(t.caption && (t.caption.textContent ?? "").trim()) ||
          !!(t.getAttribute("aria-label") ?? "").trim() ||
          !!t.getAttribute("aria-labelledby");
        const ths = Array.from(t.querySelectorAll("th"));
        const thsMissingScope = ths.filter(
          (th) => !th.hasAttribute("scope") && !th.hasAttribute("id"),
        ).length;
        return {
          i,
          hasCaption,
          thCount: ths.length,
          thsMissingScope,
          sortable: !!t.querySelector("th[aria-sort]"),
        };
      });
  });

  if (tables.length === 0) {
    return {
      recipe: "table",
      wcag,
      status: "skipped",
      details: ["No data tables on the page."],
    };
  }

  const details: string[] = [];
  for (const t of tables) {
    const label = `table #${t.i + 1}`;
    if (!t.hasCaption) {
      details.push(`${label}: missing <caption> (or aria-label/aria-labelledby).`);
    }
    if (t.thCount === 0) {
      details.push(`${label}: no <th> header cells — data tables need marked headers.`);
    } else if (t.thsMissingScope > 0) {
      details.push(
        `${label}: ${t.thsMissingScope} <th> cell(s) without scope (or id for the headers pattern).`,
      );
    }
    if (t.sortable) {
      const sel = `[data-a11y-behave-table="${t.i}"] th[aria-sort]`;
      const before = await page.evaluate(
        (s) => document.querySelector(s)?.getAttribute("aria-sort") ?? null,
        sel,
      );
      await page.evaluate((s) => {
        const th = document.querySelector<HTMLElement>(s);
        const button = th?.querySelector<HTMLElement>("button, [role=button]");
        (button ?? th)?.click();
      }, sel);
      await page.waitForTimeout(150);
      const after = await page.evaluate(
        (s) => document.querySelector(s)?.getAttribute("aria-sort") ?? null,
        sel,
      );
      if (before === after) {
        details.push(
          `${label}: activating the sortable header did not change aria-sort (stuck at "${before}").`,
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
    details,
  };
}

/** 1.3.5 Identify Input Purpose — personal-data inputs should carry autocomplete. Heuristic → warn. */
export async function recipeAutocomplete(page: Page): Promise<RecipeResult> {
  const wcag = "1.3.5 Identify Input Purpose";
  const res = await page.evaluate(() => {
    const isVisible = (el: Element) =>
      (el as HTMLElement).getClientRects().length > 0 &&
      getComputedStyle(el).visibility !== "hidden";
    const PERSONAL =
      /(e-?mail|phone|mobile|tel|first-?name|last-?name|full-?name|address|street|city|zip|postal|country|birth-?da(y|te))/i;
    const inputs = Array.from(
      document.querySelectorAll<HTMLInputElement>("input"),
    ).filter(
      (el) =>
        isVisible(el) &&
        !["hidden", "checkbox", "radio", "submit", "button", "file"].includes(el.type),
    );
    const personal = inputs.filter(
      (el) =>
        el.type === "email" ||
        el.type === "tel" ||
        PERSONAL.test(el.name) ||
        PERSONAL.test(el.id),
    );
    return {
      personalCount: personal.length,
      missing: personal
        .filter((el) => !el.getAttribute("autocomplete"))
        .map(
          (el) =>
            `<input type="${el.type}"${el.name ? ` name="${el.name}"` : ""}${el.id ? ` id="${el.id}"` : ""}>`,
        ),
    };
  });

  if (res.personalCount === 0) {
    return {
      recipe: "autocomplete",
      wcag,
      status: "skipped",
      details: ["No personal-data inputs detected."],
    };
  }
  return {
    recipe: "autocomplete",
    wcag,
    status: res.missing.length > 0 ? "warn" : "pass",
    details: res.missing.map(
      (m) => `${m} looks like a personal-data field but has no autocomplete attribute.`,
    ),
  };
}

/**
 * Screen-reader persona: form navigation. 1.3.1 Info and Relationships /
 * 3.3.1 Error Identification / 3.3.2 Labels or Instructions. Covers what
 * axe's `label` rule and the pre-commit lint don't reach at runtime: every
 * visible control has a computed accessible name, radio groups are grouped
 * under a labelled <fieldset><legend> (or named role="radiogroup"), and
 * aria-invalid="true" fields carry a real, non-empty aria-describedby.
 */
export async function recipeFormNavigation(page: Page): Promise<RecipeResult> {
  const wcag =
    "1.3.1 Info and Relationships / 3.3.1 Error Identification / 3.3.2 Labels or Instructions";

  const res = await page.evaluate(() => {
    const isVisible = (el: Element) =>
      (el as HTMLElement).getClientRects().length > 0 &&
      getComputedStyle(el).visibility !== "hidden";

    const accessibleName = (el: HTMLElement): string => {
      const labelledby = el.getAttribute("aria-labelledby");
      if (labelledby) {
        const text = labelledby
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? "")
          .join(" ")
          .trim();
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
      document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
        "input, select, textarea",
      ),
    ).filter(
      (el) =>
        isVisible(el) &&
        !(
          "type" in el &&
          ["hidden", "submit", "button", "reset", "image"].includes(
            (el as HTMLInputElement).type,
          )
        ),
    );

    const unnamed = controls
      .filter((el) => accessibleName(el).length === 0)
      .map((el) => {
        const type = "type" in el ? ` type="${(el as HTMLInputElement).type}"` : "";
        const nm = el.name ? ` name="${el.name}"` : "";
        const id = el.id ? ` id="${el.id}"` : "";
        return `<${el.tagName.toLowerCase()}${type}${nm}${id}> has no accessible name.`;
      });

    // Radio groups: same `name`, count > 1, must share a labelled
    // <fieldset><legend> or a named role="radiogroup" wrapper.
    const radios = Array.from(
      document.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
    ).filter(isVisible);
    const byName = new Map<string, HTMLInputElement[]>();
    for (const r of radios) {
      if (!r.name) continue;
      const arr = byName.get(r.name) ?? [];
      arr.push(r);
      byName.set(r.name, arr);
    }
    const groupIssues: string[] = [];
    for (const [groupName, members] of byName) {
      if (members.length <= 1) continue;
      const groupedByFieldset = (() => {
        const fs = members[0]?.closest("fieldset");
        if (!fs) return false;
        const legend = fs.querySelector("legend");
        return (
          !!legend &&
          (legend.textContent ?? "").trim().length > 0 &&
          members.every((m) => m.closest("fieldset") === fs)
        );
      })();
      const radiogroupNamed = (() => {
        const rg = members[0]?.closest('[role="radiogroup"]');
        if (!rg) return false;
        return (
          !!accessibleName(rg as HTMLElement) &&
          members.every((m) => m.closest('[role="radiogroup"]') === rg)
        );
      })();
      if (!groupedByFieldset && !radiogroupNamed) {
        groupIssues.push(
          `Radio group "${groupName}" (${members.length} options) is not wrapped in a labelled <fieldset><legend> (or a named role="radiogroup") — screen reader users won't hear the group's purpose when they land on the first option.`,
        );
      }
    }

    // Error association: aria-invalid="true" must pair with a real,
    // non-empty aria-describedby target.
    const invalid = Array.from(
      document.querySelectorAll<HTMLElement>('[aria-invalid="true"]'),
    ).filter(isVisible);
    const errorIssues: string[] = [];
    for (const el of invalid) {
      const describedby = el.getAttribute("aria-describedby");
      const nm = "name" in el && (el as HTMLInputElement).name ? ` name="${(el as HTMLInputElement).name}"` : "";
      const desc = `<${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${nm}>`;
      if (!describedby) {
        errorIssues.push(
          `${desc} has aria-invalid="true" but no aria-describedby — the error text is never announced.`,
        );
        continue;
      }
      const hasText = describedby
        .split(/\s+/)
        .some((id) => (document.getElementById(id)?.textContent ?? "").trim().length > 0);
      if (!hasText) {
        errorIssues.push(
          `${desc} has aria-invalid="true" and aria-describedby="${describedby}" but the referenced element is missing or empty.`,
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
      details: ["No form controls on the page."],
    };
  }

  const details = [...res.unnamed, ...res.groupIssues, ...res.errorIssues];
  return {
    recipe: "form-navigation",
    wcag,
    status: details.length > 0 ? "fail" : "pass",
    details,
  };
}

/** 4.1.3 Status Messages — structural live-region mistakes detectable at load. */
export async function recipeLiveRegionStatic(page: Page): Promise<RecipeResult> {
  const wcag = "4.1.3 Status Messages";
  const res = await page.evaluate(() => {
    const regions = Array.from(
      document.querySelectorAll<HTMLElement>("[role=alert], [role=status], [aria-live]"),
    );
    const nested = regions
      .filter((el) => {
        const role = el.getAttribute("role");
        return (
          (role === "alert" || role === "status") &&
          el.parentElement?.closest("[aria-live]")
        );
      })
      .map((el) => `<${el.tagName.toLowerCase()} role="${el.getAttribute("role")}">`);
    const staticAlerts = regions
      .filter(
        (el) =>
          el.getAttribute("role") === "alert" &&
          (el.textContent ?? "").trim().length > 0,
      )
      .map((el) => (el.textContent ?? "").trim().slice(0, 60));
    return { total: regions.length, nested, staticAlerts };
  });

  if (res.total === 0) {
    return {
      recipe: "live-region-static",
      wcag,
      status: "skipped",
      details: [
        "No live regions in the DOM at load. If this app shows toasts or status messages, that absence is itself a problem — the container must exist before content is injected (judgment check).",
      ],
    };
  }

  const details: string[] = [];
  for (const n of res.nested) {
    details.push(
      `${n} is nested inside an aria-live container — the role already implies a live region; nesting causes double or missed announcements.`,
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
        (t) =>
          `role="alert" contains static text at page load ("${t}") — alerts are for dynamic messages; static content will be announced on every load.`,
      ),
    };
  }
  return { recipe: "live-region-static", wcag, status: "pass", details: [] };
}

// --- Recipe registry & runner ---

export interface Recipe {
  name: string;
  run: (page: Page, opts: BehaveOptions) => Promise<RecipeResult>;
}

export const ALL_RECIPES: Recipe[] = [
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
  { name: "table", run: recipeTable },
  { name: "autocomplete", run: recipeAutocomplete },
  { name: "form-navigation", run: recipeFormNavigation },
  { name: "live-region-static", run: recipeLiveRegionStatic },
];

/**
 * Run the selected recipes (all when `names` is null), reloading the page
 * before each so interactions from one recipe can't leak into the next.
 */
export async function runRecipes(
  page: Page,
  url: string,
  names: string[] | null,
  opts: BehaveOptions,
): Promise<RecipeResult[]> {
  const selected = names
    ? ALL_RECIPES.filter((r) => names.includes(r.name))
    : ALL_RECIPES;
  const results: RecipeResult[] = [];
  for (const recipe of selected) {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15_000 });
    try {
      results.push(await recipe.run(page, opts));
    } catch (err: unknown) {
      results.push({
        recipe: recipe.name,
        wcag: "",
        status: "warn",
        details: [`Recipe did not complete: ${String(err)}`],
      });
    }
  }
  return results;
}

// --- CLI entrypoint ---

async function main(): Promise<void> {
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
  const consumed = new Set<number>();
  const argValue = (flag: string): string | undefined => {
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === undefined) continue;
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
    return undefined;
  };

  const dialogTrigger = argValue("--dialog-trigger");
  const recipesArg = argValue("--recipes");
  const urlArg = args.find((a, i) => !a.startsWith("--") && !consumed.has(i));

  if (!urlArg) {
    console.error(
      'Usage: node behave.cjs <url> [--recipes reflow-320,dialog,...] [--dialog-trigger "<css selector>"]\n' +
        `Available recipes: ${ALL_RECIPES.map((r) => r.name).join(", ")}`,
    );
    process.exit(2);
  }

  let url: URL;
  try {
    url = new URL(urlArg);
  } catch {
    console.error(`Invalid URL: ${urlArg}`);
    process.exit(2);
  }

  let names: string[] | null = null;
  if (recipesArg) {
    names = recipesArg.split(",").map((s) => s.trim()).filter(Boolean);
    const known = new Set(ALL_RECIPES.map((r) => r.name));
    const unknown = names.filter((n) => !known.has(n));
    if (unknown.length > 0) {
      console.error(
        `Unknown recipe(s): ${unknown.join(", ")}\nAvailable: ${[...known].join(", ")}`,
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

  // Reachability check before running the recipe loop
  try {
    const response = await page.goto(url.toString(), {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });
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

  const opts: BehaveOptions = dialogTrigger ? { dialogTrigger } : {};
  const results = await runRecipes(page, url.toString(), names, opts);
  await browser.close();

  const resultsDir = path.join(process.cwd(), ".a11y");
  if (fs.existsSync(resultsDir)) {
    fs.writeFileSync(
      path.join(resultsDir, "behave-results.json"),
      JSON.stringify({ url: url.toString(), results }, null, 2),
    );
  }

  console.log(formatBehaveResults(results));
  process.exit(exitCodeFor(results));
}

// Only run when executed directly (not when imported by tests)
const isMain =
  typeof require !== "undefined"
    ? require.main === module
    : process.argv[1]?.endsWith("behave.ts") || process.argv[1]?.endsWith("behave.cjs");

if (isMain) {
  main().catch((err) => {
    console.error("Unexpected error:", err);
    process.exit(2);
  });
}
