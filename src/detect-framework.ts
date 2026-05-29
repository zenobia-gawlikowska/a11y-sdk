import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Framework = "react" | "vue" | "svelte" | "angular" | "unknown";

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

function readDeps(projectRoot: string): Record<string, string> {
  try {
    const raw = readFileSync(join(projectRoot, "package.json"), "utf8");
    const pkg = JSON.parse(raw) as PackageJson;
    return {
      ...pkg.dependencies,
      ...pkg.devDependencies,
      ...pkg.peerDependencies,
    };
  } catch {
    return {};
  }
}

/**
 * Detect the JS framework in use by inspecting package.json dependencies.
 * Priority (highest first): angular > svelte > vue > react.
 * Returns "unknown" if no recognised framework is found or package.json is absent.
 */
export function detectFramework(projectRoot: string): Framework {
  const deps = readDeps(projectRoot);

  if ("@angular/core" in deps) return "angular";
  if ("svelte" in deps) return "svelte";
  if ("vue" in deps) return "vue";
  if ("react" in deps) return "react";

  return "unknown";
}

// CLI entry point — used by setup.sh: node detect-framework.cjs <projectRoot>
if (require.main === module) {
  const projectRoot = process.argv[2] ?? process.cwd();
  process.stdout.write(detectFramework(projectRoot) + "\n");
}
