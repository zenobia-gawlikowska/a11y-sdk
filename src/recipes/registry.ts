import type { Recipe, RecipeAlias, RecipeId } from "./types.js";
import { r1Context } from "./r1-context.js";
import { r2CommitGate } from "./r2-commit-gate.js";
import { r3Audit } from "./r3-audit.js";

/** The recipe catalog — the product surface (plan §1.1). Ordered R1 → R2 → R3. */
export const RECIPES: readonly Recipe[] = [r1Context, r2CommitGate, r3Audit];

const BY_ID = new Map<string, Recipe>(RECIPES.map((r) => [r.id, r]));
const BY_ALIAS = new Map<string, Recipe>(RECIPES.map((r) => [r.alias, r]));

/** Resolve a recipe by its id (`r1-context`) or `--only` alias (`context`). */
export function resolveRecipe(token: string): Recipe | undefined {
  return BY_ID.get(token) ?? BY_ALIAS.get(token);
}

export type { Recipe, RecipeAlias, RecipeId };
export { r1Context, r2CommitGate, r3Audit };
