import { defineConfig } from "tsup";

export default defineConfig([
  // Library target — output to dist/
  {
    entry: ["src/index.ts"],
    format: ["cjs", "esm"],
    dts: true,
    clean: false,
    sourcemap: true,
  },
  // Toolkit scripts target — output to toolkit/scripts/ as committed CJS executables
  {
    entry: {
      "detect-framework": "src/detect-framework.ts",
      "pre-commit": "src/pre-commit.ts",
      audit: "src/audit.ts",
      "config-loader": "src/config-loader.ts",
    },
    format: ["cjs"],
    outDir: "toolkit/scripts",
    clean: false,
    sourcemap: false,
    // eslint is a peer dep in the developer's project — never bundle it
    // playwright and @axe-core/playwright are also peer deps (Phase 4)
    external: ["eslint", "playwright", "@axe-core/playwright"],
    banner: { js: "#!/usr/bin/env node" },
  },
]);
