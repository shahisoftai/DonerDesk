/**
 * The results chain as a tree (Phase 37.3). The model finds results-chain statements; these rules make the answer the same
 * every time: a statement repeated in other words is kept once, a parent must sit at a higher level than its child, and the
 * items are put in tree order (each parent followed by what belongs to it), so `proposeCodes` — which places an item under
 * the nearest earlier item one level up — reads exactly the tree that was decided. Nothing is invented: a missing level is
 * reported by `checkProposal`, never filled. Pure.
 */
import { contentWords, wordOverlap } from "./setup-links.js";
import type { LogframeNodeDef, Proposed, SetupLogLevel } from "./proposal.js";

export const LEVEL_RANK: Readonly<Record<SetupLogLevel, number>> = { GOAL: 0, OUTCOME: 1, OUTPUT: 2, ACTIVITY: 3 };

/** Two statements this close in wording say the same thing. */
export const SAME_STATEMENT = 0.85;

type Node = Proposed<LogframeNodeDef>;

/** Indices of items that repeat an earlier item (same words, any level); the earlier one is kept. */
export function repeatedStatements(items: ReadonlyArray<Node>): Set<number> {
  const repeats = new Set<number>();
  const words = items.map((i) => contentWords(i.value?.title));
  for (let i = 0; i < items.length; i++) {
    if (repeats.has(i) || !items[i]!.value) continue;
    for (let j = i + 1; j < items.length; j++) {
      if (!repeats.has(j) && items[j]!.value && wordOverlap(words[i]!, words[j]!) >= SAME_STATEMENT) repeats.add(j);
    }
  }
  return repeats;
}

/**
 * Puts the items in tree order. `parentOf(i)` is the index of item i's parent (or null); a parent that is not one level or
 * more above its child is ignored. Roots and siblings keep the document's order.
 */
export function orderAsTree<T extends Node>(items: ReadonlyArray<T>, parentOf: (index: number) => number | null): { items: T[]; parents: (number | null)[] } {
  const rank = (i: number): number => LEVEL_RANK[items[i]!.value?.level ?? "ACTIVITY"];
  const parent = items.map((_, i) => {
    const p = parentOf(i);
    return p !== null && p !== i && p >= 0 && p < items.length && rank(p) < rank(i) ? p : null;
  });
  // A circle (a parent of its own ancestor) cannot happen with strictly rising ranks, so the walk always ends.
  const children = new Map<number | null, number[]>();
  parent.forEach((p, i) => children.set(p, [...(children.get(p) ?? []), i]));
  const order: number[] = [];
  const visit = (i: number): void => {
    order.push(i);
    for (const c of children.get(i) ?? []) visit(c);
  };
  for (const root of children.get(null) ?? []) visit(root);
  const position = new Map(order.map((original, at) => [original, at]));
  return { items: order.map((i) => items[i]!), parents: order.map((i) => (parent[i] === null ? null : position.get(parent[i]!)!)) };
}

/**
 * The chain tidied: repeats removed, then tree order from the codes the items carry (`parentCode`), with any parentCode
 * that names no listed item cleared. Items keep their quotes and statuses.
 */
export function tidyResultsChain(items: ReadonlyArray<Node>): Node[] {
  const repeats = repeatedStatements(items);
  const kept = items.filter((_, i) => !repeats.has(i));
  const byCode = new Map<string, number>();
  kept.forEach((item, i) => {
    const code = item.value?.code;
    if (code && !byCode.has(code)) byCode.set(code, i);
  });
  const { items: ordered } = orderAsTree(kept, (i) => {
    const code = kept[i]!.value?.parentCode;
    return code ? byCode.get(code) ?? null : null;
  });
  return ordered.map((item) => {
    const code = item.value?.parentCode;
    return code && !byCode.has(code) ? { ...item, value: { ...item.value!, parentCode: null } } : item;
  });
}

/**
 * Applies a structure decision (level and parent index per item, from the structure pass) and returns the chain in tree
 * order with each parentCode set to its parent's code when the parent has one (otherwise the order carries the link).
 */
export function applyStructure(items: ReadonlyArray<Node>, decisions: ReadonlyArray<{ level: SetupLogLevel | null; parent: number | null } | undefined>): Node[] {
  if (decisions.every((d) => d === undefined)) return [...items];
  const leveled = items.map((item, i) => {
    const level = decisions[i]?.level;
    return level && item.value && item.status !== "EDITED" ? { ...item, value: { ...item.value, level } } : item;
  });
  const byCode = new Map<string, number>();
  leveled.forEach((item, i) => {
    const code = item.value?.code;
    if (code && !byCode.has(code)) byCode.set(code, i);
  });
  // An item the answer said nothing about keeps the parent the document gave it.
  const parentOf = (i: number): number | null => {
    const decision = decisions[i];
    if (decision && leveled[i]!.status !== "EDITED") return decision.parent;
    const code = leveled[i]!.value?.parentCode;
    return code ? byCode.get(code) ?? null : null;
  };
  const decided = new Set(leveled.flatMap((item, i) => (decisions[i] && item.status !== "EDITED" ? [item] : [])));
  const { items: ordered, parents } = orderAsTree(leveled, parentOf);
  return ordered.map((item, i) => {
    if (!item.value || !decided.has(item)) return item;
    const p = parents[i];
    const parentCode = p === null || p === undefined ? null : ordered[p]!.value?.code ?? null;
    return { ...item, value: { ...item.value, parentCode } };
  });
}

/** Majority of several structure decisions per item; a tie keeps the first answer. */
export function majorityStructure(votes: ReadonlyArray<ReadonlyArray<{ level: SetupLogLevel | null; parent: number | null } | undefined>>, count: number): ({ level: SetupLogLevel | null; parent: number | null; agreed: boolean } | undefined)[] {
  return Array.from({ length: count }, (_, i) => {
    const answers = votes.map((v) => v[i]).filter((a): a is { level: SetupLogLevel | null; parent: number | null } => a !== undefined);
    if (answers.length === 0) return undefined;
    const tally = new Map<string, { answer: (typeof answers)[number]; n: number }>();
    for (const a of answers) {
      const key = `${a.level}:${a.parent}`;
      tally.set(key, { answer: a, n: (tally.get(key)?.n ?? 0) + 1 });
    }
    const best = [...tally.values()].sort((x, y) => y.n - x.n)[0]!;
    return { ...best.answer, agreed: best.n === answers.length };
  });
}
