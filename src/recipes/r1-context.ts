import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  AiTarget,
  Change,
  DetectResult,
  Recipe,
  RecipeContext,
  RecipeResult,
  VerifyResult,
} from "./types.js";
import { copyIfAbsent, ensureMarker, fileContains } from "./util.js";

const A11Y_MARKER = "@.a11y/context.md";
const COPILOT_MARKER = ".a11y/context.md";

interface AiFileSpec {
  /** Path relative to scope. */
  file: string;
  marker: string;
  wrapper: string; // relative to toolkitDir
  createOnly: boolean;
  /** When appending to an existing file, use the wrapper body rather than the bare marker. */
  appendWrapperBody: boolean;
}

function aiFileSpec(target: AiTarget): AiFileSpec {
  switch (target) {
    case "claude":
      return {
        file: "CLAUDE.md",
        marker: A11Y_MARKER,
        wrapper: "wrappers/CLAUDE.md",
        createOnly: false,
        appendWrapperBody: false,
      };
    case "copilot":
      return {
        file: ".github/copilot-instructions.md",
        marker: COPILOT_MARKER,
        wrapper: "wrappers/copilot-instructions.md",
        createOnly: false,
        appendWrapperBody: true,
      };
    case "cursor":
      return {
        file: ".cursorrules",
        marker: COPILOT_MARKER,
        wrapper: "wrappers/.cursorrules",
        createOnly: true,
        appendWrapperBody: false,
      };
    case "agents":
      return {
        file: "AGENTS.md",
        marker: COPILOT_MARKER,
        wrapper: "wrappers/AGENTS.md",
        createOnly: true,
        appendWrapperBody: false,
      };
  }
}

function knowledgeAssets(ctx: RecipeContext): Change[] {
  return [
    copyIfAbsent(
      ctx,
      join(ctx.toolkitDir, "context.md"),
      join(ctx.scope, ".a11y", "context.md"),
    ),
    copyIfAbsent(
      ctx,
      join(ctx.toolkitDir, "rules"),
      join(ctx.scope, ".a11y", "rules"),
    ),
  ];
}

function patchAiFiles(ctx: RecipeContext): Change[] {
  const changes: Change[] = [];
  for (const target of ctx.ai) {
    const spec = aiFileSpec(target);
    const file = join(ctx.scope, spec.file);
    const wrapperSrc = join(ctx.toolkitDir, spec.wrapper);
    let appendBody: string | undefined;
    if (spec.appendWrapperBody && existsSync(wrapperSrc)) {
      appendBody = readWrapper(wrapperSrc);
    }
    changes.push(
      ensureMarker(ctx, {
        file,
        marker: spec.marker,
        wrapperSrc,
        ...(appendBody !== undefined ? { appendBody } : {}),
        createOnly: spec.createOnly,
      }),
    );
  }
  return changes;
}

function readWrapper(src: string): string {
  return readFileSync(src, "utf8").trimEnd();
}

export const r1Context: Recipe = {
  id: "r1-context",
  alias: "context",
  title: "AI context injection",
  idempotent: true,
  requiredFlags: [],

  detect(ctx: RecipeContext): DetectResult {
    const knowledgePresent = existsSync(
      join(ctx.scope, ".a11y", "context.md"),
    );
    const allPatched = ctx.ai.every((t) => {
      const spec = aiFileSpec(t);
      return fileContains(join(ctx.scope, spec.file), spec.marker);
    });
    return {
      applicable: true,
      alreadyApplied: knowledgePresent && allPatched,
    };
  },

  plan(ctx: RecipeContext): Change[] {
    const dry = { ...ctx, dryRun: true };
    return [...knowledgeAssets(dry), ...patchAiFiles(dry)];
  },

  apply(ctx: RecipeContext): RecipeResult {
    const changes = [...knowledgeAssets(ctx), ...patchAiFiles(ctx)];
    return {
      id: this.id,
      status: ctx.dryRun ? "planned" : "applied",
      changes,
      messages: [
        `AI context wired for: ${ctx.ai.join(", ")}`,
      ],
    };
  },

  verify(ctx: RecipeContext): VerifyResult {
    const checks = [
      {
        name: ".a11y/context.md present",
        ok: existsSync(join(ctx.scope, ".a11y", "context.md")),
      },
      ...ctx.ai.map((t) => {
        const spec = aiFileSpec(t);
        return {
          name: `${spec.file} references a11y context`,
          ok: fileContains(join(ctx.scope, spec.file), spec.marker),
        };
      }),
    ];
    return { ok: checks.every((c) => c.ok), checks };
  },
};
