import type { LogframeLevel } from "./logframe-item.js";

export interface OutcomeNode {
  id: string;
  parentId?: string | null;
  level: LogframeLevel | string;
  code?: string;
  title: string;
}

export interface OwningOutcome {
  id: string;
  code?: string;
  title: string;
}

/**
 * The outcome an indicator's logframe item belongs to: the item itself when it is an outcome, else its nearest
 * outcome ancestor. A report that has one section per outcome uses this to give each section only its own indicators
 * (before, every "Outcome" section printed the same table). A goal-level or unparented item has no owning outcome.
 */
export function owningOutcome(items: ReadonlyArray<OutcomeNode>, itemId: string | undefined): OwningOutcome | undefined {
  if (!itemId) return undefined;
  const byId = new Map(items.map((i) => [i.id, i]));
  const seen = new Set<string>();
  let node = byId.get(itemId);
  while (node && !seen.has(node.id)) {
    seen.add(node.id);
    if (node.level === "OUTCOME") return { id: node.id, ...(node.code ? { code: node.code } : {}), title: node.title };
    node = node.parentId ? byId.get(node.parentId) : undefined;
  }
  return undefined;
}
