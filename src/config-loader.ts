// Stub — full implementation in Phase 2
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

export function loadConfig(_projectRoot: string): A11yConfig {
  return defaultConfig;
}
