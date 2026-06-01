#!/usr/bin/env node
"use strict";

// src/pre-commit.ts
var import_node_child_process = require("child_process");
var import_node_readline = require("readline");
var import_node_fs3 = require("fs");
var import_node_path3 = require("path");

// src/detect-framework.ts
var import_node_fs = require("fs");
var import_node_path = require("path");
function readDeps(projectRoot) {
  try {
    const raw = (0, import_node_fs.readFileSync)((0, import_node_path.join)(projectRoot, "package.json"), "utf8");
    const pkg = JSON.parse(raw);
    return {
      ...pkg.dependencies,
      ...pkg.devDependencies,
      ...pkg.peerDependencies
    };
  } catch {
    return {};
  }
}
function detectFramework(projectRoot) {
  const deps = readDeps(projectRoot);
  if ("@angular/core" in deps) return "angular";
  if ("svelte" in deps) return "svelte";
  if ("vue" in deps) return "vue";
  if ("react" in deps) return "react";
  return "unknown";
}
if (require.main === module) {
  const projectRoot = process.argv[2] ?? process.cwd();
  process.stdout.write(detectFramework(projectRoot) + "\n");
}

// src/config-loader.ts
var import_node_fs2 = require("fs");
var import_node_path2 = require("path");
var defaultConfig = {
  wcagLevel: "AA",
  rules: {
    "focus-management": true,
    "aria-roles": true,
    "keyboard-navigation": true,
    "color-contrast": true,
    "form-labeling": true,
    "landmark-structure": true,
    "live-regions": true,
    images: true
  }
};
var CONFIG_PATH = ".a11y/config/a11y.config.json";
function isRuleFlags(obj) {
  if (typeof obj !== "object" || obj === null) return false;
  const keys = [
    "focus-management",
    "aria-roles",
    "keyboard-navigation",
    "color-contrast",
    "form-labeling",
    "landmark-structure",
    "live-regions",
    "images"
  ];
  return keys.every((k) => typeof obj[k] === "boolean");
}
function isA11yConfig(obj) {
  if (typeof obj !== "object" || obj === null) return false;
  const record = obj;
  if (record["wcagLevel"] !== "AA" && record["wcagLevel"] !== "AAA") return false;
  return isRuleFlags(record["rules"]);
}
function loadConfig(projectRoot) {
  const configPath = (0, import_node_path2.join)(projectRoot, CONFIG_PATH);
  let raw;
  try {
    raw = (0, import_node_fs2.readFileSync)(configPath, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") {
      return { ...defaultConfig, rules: { ...defaultConfig.rules } };
    }
    throw new Error(
      `a11y-sdk: could not read config at ${configPath}: ${String(err)}`
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      `a11y-sdk: malformed JSON in ${configPath}. Fix the syntax error and try again.`
    );
  }
  if (!isA11yConfig(parsed)) {
    throw new Error(
      `a11y-sdk: invalid config shape in ${configPath}. Expected { wcagLevel: "AA"|"AAA", rules: { ... } } with all rule flags as booleans.`
    );
  }
  return parsed;
}

// src/rule-filter.ts
var CATEGORY_RULE_PREFIXES = {
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
    "no-noninteractive-element-to-interactive-role"
  ],
  "color-contrast": [],
  // Static analysis can't catch contrast; placeholder
  "form-labeling": [
    "label-has-associated-control",
    "label-has-for",
    "form-control-has-label",
    "autocomplete-valid"
  ],
  "landmark-structure": ["html-has-lang"],
  "live-regions": [],
  // Runtime pattern; static analysis limited
  images: ["alt-text", "img-redundant-alt"]
};
function isRuleEnabled(ruleId, config) {
  const shortId = ruleId.includes("/") ? ruleId.split("/")[1] : ruleId;
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

// src/pre-commit.ts
var WCAG_MAP = {
  // jsx-a11y rules
  "jsx-a11y/alt-text": "1.1.1 Non-text Content",
  "jsx-a11y/anchor-has-content": "2.4.4 Link Purpose",
  "jsx-a11y/anchor-is-valid": "2.4.4 Link Purpose",
  "jsx-a11y/aria-activedescendant-has-tabindex": "4.1.2 Name, Role, Value",
  "jsx-a11y/aria-props": "4.1.2 Name, Role, Value",
  "jsx-a11y/aria-proptypes": "4.1.2 Name, Role, Value",
  "jsx-a11y/aria-role": "4.1.2 Name, Role, Value",
  "jsx-a11y/aria-unsupported-elements": "4.1.2 Name, Role, Value",
  "jsx-a11y/autocomplete-valid": "1.3.5 Identify Input Purpose",
  "jsx-a11y/click-events-have-key-events": "2.1.1 Keyboard",
  "jsx-a11y/heading-has-content": "2.4.6 Headings and Labels",
  "jsx-a11y/html-has-lang": "3.1.1 Language of Page",
  "jsx-a11y/iframe-has-title": "2.4.2 Page Titled",
  "jsx-a11y/img-redundant-alt": "1.1.1 Non-text Content",
  "jsx-a11y/interactive-supports-focus": "2.1.1 Keyboard",
  "jsx-a11y/label-has-associated-control": "1.3.1 Info and Relationships",
  "jsx-a11y/media-has-caption": "1.2.2 Captions",
  "jsx-a11y/mouse-events-have-key-events": "2.1.1 Keyboard",
  "jsx-a11y/no-access-key": "2.1.1 Keyboard",
  "jsx-a11y/no-aria-hidden-on-focusable": "1.3.1 Info and Relationships",
  "jsx-a11y/no-autofocus": "3.2.1 On Focus",
  "jsx-a11y/no-distracting-elements": "2.2.2 Pause, Stop, Hide",
  "jsx-a11y/no-interactive-element-to-noninteractive-role": "4.1.2 Name, Role, Value",
  "jsx-a11y/no-noninteractive-element-interactions": "4.1.2 Name, Role, Value",
  "jsx-a11y/no-noninteractive-element-to-interactive-role": "4.1.2 Name, Role, Value",
  "jsx-a11y/no-noninteractive-tabindex": "2.1.1 Keyboard",
  "jsx-a11y/no-redundant-roles": "4.1.2 Name, Role, Value",
  "jsx-a11y/no-static-element-interactions": "2.1.1 Keyboard",
  "jsx-a11y/prefer-tag-over-role": "4.1.2 Name, Role, Value",
  "jsx-a11y/role-has-required-aria-props": "4.1.2 Name, Role, Value",
  "jsx-a11y/role-supports-aria-props": "4.1.2 Name, Role, Value",
  "jsx-a11y/scope": "1.3.1 Info and Relationships",
  "jsx-a11y/tabindex-no-positive": "2.4.3 Focus Order",
  // vuejs-accessibility rules (selected common ones)
  "vuejs-accessibility/alt-text": "1.1.1 Non-text Content",
  "vuejs-accessibility/anchor-has-content": "2.4.4 Link Purpose",
  "vuejs-accessibility/aria-props": "4.1.2 Name, Role, Value",
  "vuejs-accessibility/aria-role": "4.1.2 Name, Role, Value",
  "vuejs-accessibility/click-events-have-key-events": "2.1.1 Keyboard",
  "vuejs-accessibility/form-control-has-label": "1.3.1 Info and Relationships",
  "vuejs-accessibility/heading-has-content": "2.4.6 Headings and Labels",
  "vuejs-accessibility/html-has-lang": "3.1.1 Language of Page",
  "vuejs-accessibility/iframe-has-title": "2.4.2 Page Titled",
  "vuejs-accessibility/interactive-supports-focus": "2.1.1 Keyboard",
  "vuejs-accessibility/label-has-for": "1.3.1 Info and Relationships",
  "vuejs-accessibility/mouse-events-have-key-events": "2.1.1 Keyboard",
  "vuejs-accessibility/no-access-key": "2.1.1 Keyboard",
  "vuejs-accessibility/no-autofocus": "3.2.1 On Focus",
  "vuejs-accessibility/no-distracting-elements": "2.2.2 Pause, Stop, Hide",
  "vuejs-accessibility/no-onchange": "3.2.2 On Input",
  "vuejs-accessibility/no-redundant-roles": "4.1.2 Name, Role, Value",
  "vuejs-accessibility/role-has-required-aria-props": "4.1.2 Name, Role, Value",
  "vuejs-accessibility/tabindex-no-positive": "2.4.3 Focus Order"
};
function getStagedFiles() {
  try {
    const output = (0, import_node_child_process.execSync)(
      "git diff --cached --name-only --diff-filter=ACMR",
      { encoding: "utf8" }
    );
    return output.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}
function getExtensionsForFramework(fw) {
  switch (fw) {
    case "react":
      return [".jsx", ".tsx"];
    case "vue":
      return [".vue"];
    case "svelte":
      return [".svelte"];
    case "angular":
      return [".html", ".ts"];
    default:
      return [];
  }
}
function filterStagedFiles(files, framework) {
  const exts = getExtensionsForFramework(framework);
  return files.filter((f) => exts.some((ext) => f.endsWith(ext)));
}
function getEslintConfigPath(framework, scriptDir) {
  const frameworkToFile = {
    react: "react.cjs",
    vue: "vue.cjs",
    svelte: "svelte.cjs",
    angular: "angular.cjs"
  };
  const file = frameworkToFile[framework] ?? "react.cjs";
  return (0, import_node_path3.resolve)(scriptDir, "..", "config", "eslint", file);
}
async function promptFramework() {
  const options = ["react", "vue", "svelte", "angular"];
  return new Promise((resolvePromise) => {
    const rl = (0, import_node_readline.createInterface)({ input: process.stdin, output: process.stderr });
    process.stderr.write("\na11y-sdk: framework not detected in package.json.\n\n");
    options.forEach((opt, i) => {
      process.stderr.write(`  ${i + 1}. ${opt}
`);
    });
    process.stderr.write("\nEnter number (1-4): ");
    rl.once("line", (line) => {
      rl.close();
      const index = parseInt(line.trim(), 10) - 1;
      const chosen = options[index] ?? "react";
      resolvePromise(chosen);
    });
  });
}
function persistFrameworkChoice(projectRoot, framework) {
  const configPath = (0, import_node_path3.join)(projectRoot, ".a11y", "config", "a11y.config.json");
  if (!(0, import_node_fs3.existsSync)(configPath)) return;
  try {
    const raw = (0, import_node_fs3.readFileSync)(configPath, "utf8");
    const parsed = JSON.parse(raw);
    parsed["framework"] = framework;
    (0, import_node_fs3.writeFileSync)(configPath, JSON.stringify(parsed, null, 2) + "\n", "utf8");
  } catch {
  }
}
async function main() {
  const projectRoot = process.cwd();
  const scriptDir = __dirname;
  let config;
  try {
    config = loadConfig(projectRoot);
  } catch (err) {
    process.stderr.write(`a11y-sdk pre-commit: config error \u2014 ${String(err)}
`);
    process.exit(2);
  }
  let framework = detectFramework(projectRoot);
  try {
    const configPath = (0, import_node_path3.join)(projectRoot, ".a11y", "config", "a11y.config.json");
    const raw = (0, import_node_fs3.readFileSync)(configPath, "utf8");
    const parsed = JSON.parse(raw);
    if (typeof parsed["framework"] === "string") {
      framework = parsed["framework"];
    }
  } catch {
  }
  if (framework === "unknown") {
    framework = await promptFramework();
    persistFrameworkChoice(projectRoot, framework);
  }
  const allStaged = getStagedFiles();
  const relevantFiles = filterStagedFiles(allStaged, framework);
  if (relevantFiles.length === 0) {
    process.exit(0);
  }
  let ESLint;
  try {
    ESLint = require("eslint").ESLint;
  } catch {
    process.stderr.write(
      "a11y-sdk pre-commit: ESLint not found. Run `bash .a11y/scripts/setup.sh` first.\n"
    );
    process.exit(2);
  }
  const configFile = getEslintConfigPath(framework, scriptDir);
  let eslint;
  try {
    eslint = new ESLint({
      overrideConfigFile: configFile,
      overrideConfig: []
    });
  } catch (err) {
    process.stderr.write(`a11y-sdk pre-commit: ESLint error \u2014 ${String(err)}
`);
    process.exit(2);
  }
  let results;
  try {
    results = await eslint.lintFiles(relevantFiles);
  } catch (err) {
    process.stderr.write(`a11y-sdk pre-commit: ESLint error \u2014 ${String(err)}
`);
    process.exit(2);
  }
  const violations = [];
  for (const result of results) {
    for (const msg of result.messages) {
      if (!msg.ruleId) continue;
      if (!isRuleEnabled(msg.ruleId, config)) continue;
      violations.push({
        file: result.filePath,
        line: msg.line,
        ruleId: msg.ruleId,
        message: msg.message,
        wcag: WCAG_MAP[msg.ruleId] ?? "WCAG"
      });
    }
  }
  if (violations.length === 0) {
    process.exit(0);
  }
  process.stderr.write("\n\u2716 a11y violations found:\n\n");
  for (const v of violations) {
    process.stderr.write(
      `  ${v.file}:${v.line}
    Rule:  ${v.ruleId}
    WCAG:  ${v.wcag}
    Issue: ${v.message}

`
    );
  }
  process.stderr.write(
    `${violations.length} violation(s). Commit blocked.
Fix the issues above or use --no-verify to bypass (not recommended).

`
  );
  process.exit(1);
}
main().catch((err) => {
  process.stderr.write(`a11y-sdk pre-commit: unexpected error \u2014 ${String(err)}
`);
  process.exit(2);
});
