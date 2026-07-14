import { execSync } from "node:child_process";
import { createInterface } from "node:readline";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { detectFramework, type Framework } from "./detect-framework.js";
import { loadConfig } from "./config-loader.js";
import { isRuleEnabled } from "./rule-filter.js";
import {
  isContractCheckable,
  runContractChecks,
  type ContractFile,
} from "./contract-checks.js";

// ---------------------------------------------------------------------------
// WCAG criterion map: ESLint rule ID → WCAG success criterion
// ---------------------------------------------------------------------------
const WCAG_MAP: Record<string, string> = {
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
  "jsx-a11y/no-interactive-element-to-noninteractive-role":
    "4.1.2 Name, Role, Value",
  "jsx-a11y/no-noninteractive-element-interactions": "4.1.2 Name, Role, Value",
  "jsx-a11y/no-noninteractive-element-to-interactive-role":
    "4.1.2 Name, Role, Value",
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
  "vuejs-accessibility/tabindex-no-positive": "2.4.3 Focus Order",
  // @angular-eslint/template rules (accessibility config)
  "@angular-eslint/template/alt-text": "1.1.1 Non-text Content",
  "@angular-eslint/template/click-events-have-key-events": "2.1.1 Keyboard",
  "@angular-eslint/template/elements-content": "2.4.4 Link Purpose",
  "@angular-eslint/template/interactive-supports-focus": "2.1.1 Keyboard",
  "@angular-eslint/template/label-has-associated-control":
    "1.3.1 Info and Relationships",
  "@angular-eslint/template/mouse-events-have-key-events": "2.1.1 Keyboard",
  "@angular-eslint/template/no-autofocus": "3.2.1 On Focus",
  "@angular-eslint/template/no-distracting-elements": "2.2.2 Pause, Stop, Hide",
  "@angular-eslint/template/no-positive-tabindex": "2.4.3 Focus Order",
  "@angular-eslint/template/role-has-required-aria": "4.1.2 Name, Role, Value",
  "@angular-eslint/template/table-scope": "1.3.1 Info and Relationships",
  "@angular-eslint/template/valid-aria": "4.1.2 Name, Role, Value",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStagedFiles(): string[] {
  try {
    const output = execSync(
      "git diff --cached --name-only --diff-filter=ACMR",
      { encoding: "utf8" },
    );
    return output.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

function getExtensionsForFramework(fw: Framework): string[] {
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

/** Union of every framework's extensions — files that would go to ESLint
 * under SOME framework, used to decide whether framework resolution is
 * needed at all before any prompt can fire. */
const ALL_FRAMEWORK_EXTENSIONS = [
  ".jsx",
  ".tsx",
  ".vue",
  ".svelte",
  ".html",
  ".ts",
];

function filterStagedFiles(files: string[], framework: Framework): string[] {
  const exts = getExtensionsForFramework(framework);
  return files.filter((f) => exts.some((ext) => f.endsWith(ext)));
}

function getEslintConfigPath(framework: Framework, scriptDir: string): string {
  const frameworkToFile: Record<string, string> = {
    react: "react.cjs",
    vue: "vue.cjs",
    svelte: "svelte.cjs",
    angular: "angular.cjs",
  };
  const file = frameworkToFile[framework] ?? "react.cjs";
  // Resolve relative to the toolkit/scripts/ directory
  return resolve(scriptDir, "..", "config", "eslint", file);
}

// ---------------------------------------------------------------------------
// TUI framework picker
// ---------------------------------------------------------------------------

async function promptFramework(): Promise<Framework> {
  const options: Framework[] = ["react", "vue", "svelte", "angular"];

  return new Promise((resolvePromise) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stderr,
    });

    process.stderr.write(
      "\na11y-sdk: framework not detected in package.json.\n\n",
    );
    options.forEach((opt, i) => {
      process.stderr.write(`  ${i + 1}. ${opt}\n`);
    });
    process.stderr.write("\nEnter number (1-4): ");

    let answered = false;
    rl.once("line", (line) => {
      answered = true;
      rl.close();
      const index = parseInt(line.trim(), 10) - 1;
      const chosen = options[index] ?? "react";
      resolvePromise(chosen);
    });
    // EOF before an answer (stdin closed mid-prompt) — fall back to the
    // default instead of leaving the promise dangling, which would let the
    // process exit 0 with every check silently skipped.
    rl.once("close", () => {
      if (!answered) resolvePromise("react");
    });
  });
}

function persistFrameworkChoice(
  projectRoot: string,
  framework: Framework,
): void {
  const configPath = join(projectRoot, ".a11y", "config", "a11y.config.json");
  if (!existsSync(configPath)) return;

  try {
    const raw = readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    parsed["framework"] = framework;
    writeFileSync(configPath, JSON.stringify(parsed, null, 2) + "\n", "utf8");
  } catch {
    // Non-fatal — config persistence is best-effort
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const projectRoot = process.cwd();
  // __dirname is CJS; in the compiled output this is toolkit/scripts/
  const scriptDir = __dirname;

  // 1. Load config
  let config: ReturnType<typeof loadConfig>;
  try {
    config = loadConfig(projectRoot);
  } catch (err) {
    process.stderr.write(
      `a11y-sdk pre-commit: config error — ${String(err)}\n`,
    );
    process.exit(2);
  }

  // 2. Get staged files
  const allStaged = getStagedFiles();
  // Contract checks also cover stylesheets, which ESLint never sees
  const contractFiles = allStaged.filter(isContractCheckable);
  const maybeFrameworkFiles = allStaged.filter((f) =>
    ALL_FRAMEWORK_EXTENSIONS.some((ext) => f.endsWith(ext)),
  );

  if (contractFiles.length === 0 && maybeFrameworkFiles.length === 0) {
    // Nothing relevant staged — pass silently
    process.exit(0);
  }

  const violations: Array<{
    file: string;
    line: number;
    ruleId: string;
    message: string;
    wcag: string;
  }> = [];

  // 3. Source-level contract checks — these need neither ESLint nor a
  // resolved framework, so they run before framework resolution can prompt,
  // fail, or skip.
  const contractInputs: ContractFile[] = [];
  for (const path of contractFiles) {
    try {
      contractInputs.push({
        path,
        content: readFileSync(join(projectRoot, path), "utf8"),
      });
    } catch {
      // File unreadable (e.g. racing deletion) — skip
    }
  }
  violations.push(...runContractChecks(contractInputs, config));

  // 4. Detect framework (only matters for the ESLint layer)
  let framework = detectFramework(projectRoot);

  // Check if framework was previously persisted in config
  try {
    const configPath = join(projectRoot, ".a11y", "config", "a11y.config.json");
    const raw = readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed["framework"] === "string") {
      framework = parsed["framework"] as Framework;
    }
  } catch {
    // Ignore — use detected value
  }

  let eslintSkippedWarning: string | null = null;
  if (framework === "unknown" && maybeFrameworkFiles.length > 0) {
    if (process.stdin.isTTY) {
      framework = await promptFramework();
      persistFrameworkChoice(projectRoot, framework);
    } else {
      // No terminal to prompt on (IDE/GUI commit, CI). Never hang or
      // silently pass — skip only the ESLint layer, say so, and point at
      // the config key that makes the choice permanent.
      eslintSkippedWarning =
        "a11y-sdk pre-commit: framework not detected and no terminal to ask on — " +
        "ESLint a11y checks were SKIPPED for the staged files (contract checks still ran).\n" +
        'Set "framework" ("react" | "vue" | "svelte" | "angular") in ' +
        ".a11y/config/a11y.config.json to enable them.\n";
    }
  }

  const relevantFiles = filterStagedFiles(allStaged, framework);

  // 5. Run ESLint programmatically on framework files
  if (relevantFiles.length > 0) {
    let ESLint: typeof import("eslint").ESLint;
    try {
      // eslint must be in the developer's project node_modules
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      ESLint = (require("eslint") as { ESLint: typeof import("eslint").ESLint })
        .ESLint;
    } catch {
      process.stderr.write(
        "a11y-sdk pre-commit: ESLint not found. Run `bash .a11y/scripts/setup.sh` first.\n",
      );
      process.exit(2);
    }

    const configFile = getEslintConfigPath(framework, scriptDir);
    let eslint: import("eslint").ESLint;
    try {
      eslint = new ESLint({
        overrideConfigFile: configFile,
        overrideConfig: [],
      });
    } catch (err) {
      process.stderr.write(
        `a11y-sdk pre-commit: ESLint error — ${String(err)}\n`,
      );
      process.exit(2);
    }

    let results: import("eslint").ESLint.LintResult[];
    try {
      results = await eslint.lintFiles(relevantFiles);
    } catch (err) {
      process.stderr.write(
        `a11y-sdk pre-commit: ESLint error — ${String(err)}\n`,
      );
      process.exit(2);
    }

    for (const result of results) {
      for (const msg of result.messages) {
        if (!msg.ruleId) continue;
        if (!isRuleEnabled(msg.ruleId, config)) continue;

        violations.push({
          // Contract checks report paths relative to the project root;
          // match that instead of ESLint's absolute paths.
          file: relative(projectRoot, result.filePath),
          line: msg.line,
          ruleId: msg.ruleId,
          message: msg.message,
          wcag: WCAG_MAP[msg.ruleId] ?? "WCAG",
        });
      }
    }
  }

  if (eslintSkippedWarning) {
    process.stderr.write(`\n⚠ ${eslintSkippedWarning}\n`);
  }

  if (violations.length === 0) {
    process.exit(0);
  }

  // 6. Format and output
  process.stderr.write("\n✖ a11y violations found:\n\n");
  for (const v of violations) {
    process.stderr.write(
      `  ${v.file}:${v.line}\n` +
        `    Rule:  ${v.ruleId}\n` +
        `    WCAG:  ${v.wcag}\n` +
        `    Issue: ${v.message}\n\n`,
    );
  }
  process.stderr.write(
    `${violations.length} violation(s). Commit blocked.\n` +
      `Fix the issues above or use --no-verify to bypass (not recommended).\n\n`,
  );

  process.exit(1);
}

main().catch((err: unknown) => {
  process.stderr.write(
    `a11y-sdk pre-commit: unexpected error — ${String(err)}\n`,
  );
  process.exit(2);
});
