import type { A11yConfig } from "./config-loader.js";

// ---------------------------------------------------------------------------
// Config-to-ESLint-rule category mapping
// ---------------------------------------------------------------------------

/**
 * Maps each a11y config category to the ESLint rule ID prefixes (short form,
 * after stripping the plugin namespace, e.g. "jsx-a11y/alt-text" → "alt-text")
 * that belong to it.
 *
 * The `startsWith` check in `isRuleEnabled` means any future rule whose short
 * ID starts with one of these prefixes will also be affected. Use exact strings
 * where possible and keep prefixes as specific as practical to avoid
 * unintentional over-suppression.
 */
export const CATEGORY_RULE_PREFIXES: Record<string, string[]> = {
  "focus-management": ["no-autofocus", "interactive-supports-focus"],
  "aria-roles": ["aria-role", "aria-props", "aria-proptypes", "role-"],
  "keyboard-navigation": [
    "click-events-have-key-events",
    "mouse-events-have-key-events",
    "no-noninteractive-tabindex",
    "tabindex-no-positive",
    "no-access-key",
    "interactive-supports-focus",
    "no-static-element-interactions",
    "no-noninteractive-element-interactions",
    "no-noninteractive-element-to-interactive-role",
  ],
  "color-contrast": [], // Static analysis can't catch contrast; placeholder
  "form-labeling": [
    "label-has-associated-control",
    "label-has-for",
    "form-control-has-label",
    "autocomplete-valid",
  ],
  "landmark-structure": ["html-has-lang"],
  "live-regions": [], // Runtime pattern; static analysis limited
  images: ["alt-text", "img-redundant-alt"],
};

/**
 * Returns true if the given ESLint rule should fire based on the loaded config.
 * A rule is disabled when its short ID (after stripping the plugin namespace)
 * starts with or exactly matches a prefix in a disabled config category.
 */
export function isRuleEnabled(ruleId: string, config: A11yConfig): boolean {
  const shortId = ruleId.includes("/") ? ruleId.split("/")[1]! : ruleId;
  for (const [category, enabled] of Object.entries(config.rules)) {
    if (!enabled) {
      const prefixes = CATEGORY_RULE_PREFIXES[category] ?? [];
      if (prefixes.some((p) => shortId.startsWith(p) || shortId === p)) {
        return false;
      }
    }
  }
  return true;
}
