import { extname } from "node:path";
import type { A11yConfig } from "./config-loader.js";

// Static source-level contract checks, run by the pre-commit hook alongside
// the framework ESLint plugin. Each check is the commit-time twin of a
// rendered-state recipe in behave.ts: it catches the same contract earlier,
// on staged source, without needing a running page. Text-based on purpose —
// dynamic/bound attribute values are skipped, so the checks under-flag
// rather than over-flag.

export interface ContractFile {
  /** Repo-relative path, used for reporting and extension routing. */
  path: string;
  content: string;
}

export interface ContractViolation {
  file: string;
  line: number;
  ruleId: string;
  message: string;
  wcag: string;
}

// .ts is deliberately absent (Angular inline templates): bare "aria-expanded"
// strings in querySelector/setAttribute code would false-positive.
const MARKUP_EXTS = new Set([".jsx", ".tsx", ".vue", ".svelte", ".html"]);
const STYLE_EXTS = new Set([".css", ".scss", ".sass", ".less"]);

/** True when a staged file is worth reading for contract checks. */
export function isContractCheckable(path: string): boolean {
  const ext = extname(path).toLowerCase();
  return MARKUP_EXTS.has(ext) || STYLE_EXTS.has(ext);
}

/** Config category that gates each rule; null = always enabled. */
const RULE_CATEGORY: Record<string, keyof A11yConfig["rules"] | null> = {
  "a11y-sdk/dialog-contract": "aria-roles",
  "a11y-sdk/expanded-controls": "aria-roles",
  "a11y-sdk/autocomplete-required": "form-labeling",
  "a11y-sdk/no-px-font-size": null,
};

// ---------------------------------------------------------------------------
// Tag scanner
// ---------------------------------------------------------------------------

/**
 * Return the open tag enclosing `attrIndex`, or null when the index is not
 * inside one. Walks back to the nearest `<`, then forward to the matching
 * top-level `>`, skipping quoted strings and `{…}` expressions (JSX handlers
 * contain `=>` and `>`).
 */
function tagAt(
  content: string,
  attrIndex: number,
): { tag: string; start: number } | null {
  const start = content.lastIndexOf("<", attrIndex);
  if (start === -1) return null;
  if (!/^<[A-Za-z]/.test(content.slice(start, start + 2))) return null;

  let braceDepth = 0;
  for (let i = start + 1; i < content.length; i++) {
    const ch = content[i]!;
    if (ch === '"' || ch === "'" || ch === "`") {
      const close = content.indexOf(ch, i + 1);
      if (close === -1) return null;
      i = close;
    } else if (ch === "{") {
      braceDepth++;
    } else if (ch === "}") {
      braceDepth = Math.max(0, braceDepth - 1);
    } else if (ch === ">" && braceDepth === 0) {
      // Tag closed before the attribute — the `<` we found was a different tag.
      if (i < attrIndex) return null;
      return { tag: content.slice(start, i + 1), start };
    }
  }
  return null;
}

function lineOf(content: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) if (content[i] === "\n") line++;
  return line;
}

/** Static (quoted) attribute value, or null when absent or dynamically bound. */
function getAttr(tag: string, name: string): string | null {
  const m = new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i").exec(tag);
  return m ? m[1]! : null;
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

/** role="dialog" must declare aria-modal and an accessible name (behave:dialog verifies the runtime half). */
function checkDialogContract(file: ContractFile): ContractViolation[] {
  const out: ContractViolation[] = [];
  const re = /role\s*=\s*(?:["']dialog["']|\{\s*["'`]dialog["'`]\s*\})/gi;
  for (const m of file.content.matchAll(re)) {
    const t = tagAt(file.content, m.index);
    if (!t) continue;
    const tag = t.tag.toLowerCase();
    const line = lineOf(file.content, t.start);
    if (!tag.includes("aria-modal")) {
      out.push({
        file: file.path,
        line,
        ruleId: "a11y-sdk/dialog-contract",
        message:
          'role="dialog" without aria-modal — set aria-modal="true" on modal dialogs (and trap focus), or use the native <dialog> element with showModal().',
        wcag: "4.1.2 Name, Role, Value",
      });
    }
    // includes("aria-label") also covers aria-labelledby
    if (!tag.includes("aria-label")) {
      out.push({
        file: file.path,
        line,
        ruleId: "a11y-sdk/dialog-contract",
        message:
          'role="dialog" without an accessible name — add aria-labelledby pointing at the dialog title, or aria-label.',
        wcag: "4.1.2 Name, Role, Value",
      });
    }
  }
  return out;
}

/** aria-expanded must be paired with aria-controls (behave:disclosure verifies the id resolves and toggles). */
function checkExpandedControls(file: ContractFile): ContractViolation[] {
  const out: ContractViolation[] = [];
  const seenTags = new Set<number>();
  const re = /aria-expanded/gi;
  for (const m of file.content.matchAll(re)) {
    const t = tagAt(file.content, m.index);
    if (!t || seenTags.has(t.start)) continue;
    seenTags.add(t.start);
    if (t.tag.toLowerCase().includes("aria-controls")) continue;
    out.push({
      file: file.path,
      line: lineOf(file.content, t.start),
      ruleId: "a11y-sdk/expanded-controls",
      message:
        "aria-expanded without aria-controls — reference the id of the element being expanded so assistive tech can locate it.",
      wcag: "4.1.2 Name, Role, Value",
    });
  }
  return out;
}

/** px font sizes defeat user font-size preferences (behave:zoom-200 verifies the rendered effect). */
function checkPxFontSize(file: ContractFile): ContractViolation[] {
  const out: ContractViolation[] = [];
  const res = [
    /font-size\s*:\s*([\d.]+)px/gi, // CSS: stylesheets, <style> blocks, style=""
    /fontSize\s*:\s*["'`]([\d.]+)px["'`]/gi, // JS style objects
  ];
  for (const re of res) {
    for (const m of file.content.matchAll(re)) {
      const value = parseFloat(m[1]!);
      if (!Number.isFinite(value) || value === 0) continue;
      out.push({
        file: file.path,
        line: lineOf(file.content, m.index),
        ruleId: "a11y-sdk/no-px-font-size",
        message: `font-size is ${value}px — use rem or em so text scales with the user's font-size preference.`,
        wcag: "1.4.4 Resize Text",
      });
    }
  }
  return out;
}

const SKIP_INPUT_TYPES = new Set([
  "hidden",
  "checkbox",
  "radio",
  "submit",
  "button",
  "reset",
  "file",
  "range",
  "color",
  "image",
]);

/** name/id fragment → autocomplete token, matched against static attributes. */
const PURPOSE_PATTERNS: Array<[RegExp, string]> = [
  [/e[-_]?mail/i, "email"],
  [/phone|mobile|(^|[-_])tel(ephone)?([-_]|$)/i, "tel"],
  [/user[-_]?name/i, "username"],
  [/(^|[-_])(first|given)[-_]?name/i, "given-name"],
  [/(^|[-_])(last|family)[-_]?name|surname/i, "family-name"],
  [/(^|[-_])full[-_]?name/i, "name"],
  [/street|(^|[-_])address([-_]|$)/i, "street-address"],
  [/(^|[-_])city([-_]|$)/i, "address-level2"],
  [/(^|[-_])zip|post[-_]?code|postal/i, "postal-code"],
  [/country/i, "country-name"],
  [/birth|bday|(^|[-_])dob([-_]|$)/i, "bday"],
];

function detectPurpose(tag: string): string | null {
  const type = (getAttr(tag, "type") ?? "").toLowerCase();
  if (type === "email") return "email";
  if (type === "tel") return "tel";
  const identity = [getAttr(tag, "name"), getAttr(tag, "id")]
    .filter(Boolean)
    .join(" ");
  if (!identity) return null;
  for (const [re, token] of PURPOSE_PATTERNS) {
    if (re.test(identity)) return token;
  }
  return null;
}

/** Personal-data inputs must declare autocomplete (lint:autocomplete-valid then checks the token). */
function checkAutocomplete(file: ContractFile): ContractViolation[] {
  const out: ContractViolation[] = [];
  const re = /<(input|textarea)\b/gi;
  for (const m of file.content.matchAll(re)) {
    const t = tagAt(file.content, m.index);
    if (!t) continue;
    const tag = t.tag;
    if (tag.toLowerCase().includes("autocomplete")) continue;
    const type = (getAttr(tag, "type") ?? "").toLowerCase();
    if (SKIP_INPUT_TYPES.has(type)) continue;
    const purpose = detectPurpose(tag);
    if (!purpose) continue;
    out.push({
      file: file.path,
      line: lineOf(file.content, t.start),
      ruleId: "a11y-sdk/autocomplete-required",
      message: `Input collects personal data but has no autocomplete attribute — add autocomplete="${purpose}".`,
      wcag: "1.3.5 Identify Input Purpose",
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/** Run all contract checks over the given files, honoring config category flags. */
export function runContractChecks(
  files: ContractFile[],
  config: A11yConfig,
): ContractViolation[] {
  const out: ContractViolation[] = [];
  for (const file of files) {
    const ext = extname(file.path).toLowerCase();
    if (MARKUP_EXTS.has(ext)) {
      out.push(
        ...checkDialogContract(file),
        ...checkExpandedControls(file),
        ...checkAutocomplete(file),
        ...checkPxFontSize(file),
      );
    } else if (STYLE_EXTS.has(ext)) {
      out.push(...checkPxFontSize(file));
    }
  }
  return out.filter((v) => {
    const category = RULE_CATEGORY[v.ruleId];
    if (category == null) return true;
    return config.rules[category] !== false;
  });
}
