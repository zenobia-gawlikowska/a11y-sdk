import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

// Plan §1.6: the vendorable content (toolkit/context.md, toolkit/rules/*.md) is
// public API. It must stay framework/product-clean so downstream consumers (e.g.
// sl-aipdlc-devkit) can vendor it verbatim. This test is the CI lint rule that
// enforces "no downstream references leak into the knowledge content."

const REPO_ROOT = resolve(__dirname, "..");
const TOOLKIT = join(REPO_ROOT, "toolkit");

// Downstream / product identifiers that must never appear in vendorable content.
const FORBIDDEN = [
  "sl-aipdlc",
  "aipdlc",
  "devkit",
  "sanoma",
  "bitbucket",
];

function contentFiles(): string[] {
  const files = [join(TOOLKIT, "context.md")];
  const rulesDir = join(TOOLKIT, "rules");
  for (const entry of readdirSync(rulesDir)) {
    if (entry.endsWith(".md")) files.push(join(rulesDir, entry));
  }
  return files;
}

describe("vendorable content is product-clean", () => {
  for (const file of contentFiles()) {
    const rel = file.replace(`${REPO_ROOT}/`, "");
    it(`${rel} contains no downstream references`, () => {
      const text = readFileSync(file, "utf8").toLowerCase();
      const hits = FORBIDDEN.filter((token) => text.includes(token));
      expect(
        hits,
        `${rel} references downstream/product names: ${hits.join(", ")}. ` +
          `Edit upstream content to stay vendorable.`,
      ).toEqual([]);
    });
  }
});
