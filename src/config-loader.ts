import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface RuleFlags {
  "focus-management": boolean;
  "aria-roles": boolean;
  "keyboard-navigation": boolean;
  "color-contrast": boolean;
  "form-labeling": boolean;
  "landmark-structure": boolean;
  "live-regions": boolean;
  images: boolean;
}

export interface A11yConfig {
  wcagLevel: "AA" | "AAA";
  rules: RuleFlags;
}

export const defaultConfig: A11yConfig = {
  wcagLevel: "AA",
  rules: {
    "focus-management": true,
    "aria-roles": true,
    "keyboard-navigation": true,
    "color-contrast": true,
    "form-labeling": true,
    "landmark-structure": true,
    "live-regions": true,
    images: true,
  },
};

const CONFIG_PATH = ".a11y/config/a11y.config.json";

function isRuleFlags(obj: unknown): obj is RuleFlags {
  if (typeof obj !== "object" || obj === null) return false;
  const keys: Array<keyof RuleFlags> = [
    "focus-management",
    "aria-roles",
    "keyboard-navigation",
    "color-contrast",
    "form-labeling",
    "landmark-structure",
    "live-regions",
    "images",
  ];
  return keys.every((k) => typeof (obj as Record<string, unknown>)[k] === "boolean");
}

function isA11yConfig(obj: unknown): obj is A11yConfig {
  if (typeof obj !== "object" || obj === null) return false;
  const record = obj as Record<string, unknown>;
  if (record["wcagLevel"] !== "AA" && record["wcagLevel"] !== "AAA") return false;
  return isRuleFlags(record["rules"]);
}

/**
 * Load the a11y config from `<projectRoot>/.a11y/config/a11y.config.json`.
 * Returns the default config if the file is absent.
 * Throws with a descriptive message on malformed JSON or unexpected shape.
 */
export function loadConfig(projectRoot: string): A11yConfig {
  const configPath = join(projectRoot, CONFIG_PATH);

  let raw: string;
  try {
    raw = readFileSync(configPath, "utf8");
  } catch (err) {
    // File absent — return defaults
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { ...defaultConfig, rules: { ...defaultConfig.rules } };
    }
    throw new Error(
      `a11y-sdk: could not read config at ${configPath}: ${String(err)}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      `a11y-sdk: malformed JSON in ${configPath}. Fix the syntax error and try again.`,
    );
  }

  if (!isA11yConfig(parsed)) {
    throw new Error(
      `a11y-sdk: invalid config shape in ${configPath}. ` +
        `Expected { wcagLevel: "AA"|"AAA", rules: { ... } } with all rule flags as booleans.`,
    );
  }

  return parsed;
}
