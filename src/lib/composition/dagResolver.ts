import type { Stage } from "@prisma/client";

/**
 * Resolve a composition's stages into an ordered execution plan.
 *
 * v1 chains are strictly linear (Prompt A -> B -> C), so this sorts by `order`
 * ascending. Non-mutating (returns a sorted copy). Throws if there are no stages.
 */
export function resolveDag(stages: Stage[]): Stage[] {
  if (stages.length === 0) {
    throw new Error("Composition has no stages to execute");
  }
  return [...stages].sort((a, b) => a.order - b.order);
}
