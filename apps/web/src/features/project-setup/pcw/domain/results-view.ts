export type DraftItemOrigin = "DOCUMENT" | "SUGGESTED" | "USER";
import type { IndicatorDef, LogframeNodeDef, SetupLogLevel } from "@donordesk/domain";
import type { SetupDraftView } from "../../../../lib/server/schemas-project-setup-draft.ts";

type NodeItem = SetupDraftView["logframe"][number];
type IndicatorItem = SetupDraftView["indicators"][number];

export const LEVELS: readonly SetupLogLevel[] = ["GOAL", "OUTCOME", "OUTPUT", "ACTIVITY"];
export const LEVEL_LABEL: Record<SetupLogLevel, string> = { GOAL: "Goal", OUTCOME: "Outcome", OUTPUT: "Output", ACTIVITY: "Activity" };
const PARENT_OF: Record<SetupLogLevel, SetupLogLevel | null> = { GOAL: null, OUTCOME: "GOAL", OUTPUT: "OUTCOME", ACTIVITY: "OUTPUT" };
const DEPTH: Record<SetupLogLevel, number> = { GOAL: 0, OUTCOME: 1, OUTPUT: 2, ACTIVITY: 3 };

export interface TreeRow {
  item: NodeItem;
  node: LogframeNodeDef;
  depth: number;
}

/** The results as an indented tree: every result under its parent, in the order they were given. A result whose parent is gone is shown at the top, not hidden. */
export function treeRows(items: readonly NodeItem[]): TreeRow[] {
  const nodes = items.map((item) => ({ item, node: item.value as LogframeNodeDef }));
  const codes = new Set(nodes.map((n) => n.node.code).filter((c): c is string => c !== null));
  const rows: TreeRow[] = [];
  const place = (parentCode: string | null, depth: number, seen: Set<string>) => {
    for (const n of nodes) {
      const isRoot = parentCode === null && (n.node.parentCode === null || !codes.has(n.node.parentCode));
      if (!(isRoot || (parentCode !== null && n.node.parentCode === parentCode)) || seen.has(n.item.path)) continue;
      seen.add(n.item.path);
      rows.push({ item: n.item, node: n.node, depth });
      if (n.node.code) place(n.node.code, depth + 1, seen);
    }
  };
  place(null, 0, new Set());
  return rows;
}

/** The results a new result of this level can be placed under. */
export function parentChoices(level: SetupLogLevel, items: readonly NodeItem[]): Array<{ code: string; label: string }> {
  const wanted = PARENT_OF[level];
  if (!wanted) return [];
  return items.flatMap((i) => {
    const n = i.value as LogframeNodeDef;
    return n.level === wanted && n.code ? [{ code: n.code, label: `${n.code} · ${n.title ?? ""}` }] : [];
  });
}

/** Whether a parent has to be chosen for this level (an outcome may stand alone). */
export const needsParent = (level: SetupLogLevel): boolean => level === "OUTPUT" || level === "ACTIVITY";

/** Codes the domain made up that the person has not yet kept. */
export function unconfirmedCodes(items: readonly NodeItem[], confirmed: readonly string[]): string[] {
  const kept = new Set(confirmed);
  return items.flatMap((i) => {
    const n = i.value as LogframeNodeDef;
    return n.code && n.codeSource === "GENERATED" && !kept.has(n.code) ? [n.code] : [];
  });
}

export const indentFor = (level: SetupLogLevel): number => DEPTH[level];

/** The results an indicator can measure, deepest first: outputs, then outcomes, then the goal. */
export function indicatorTargets(items: readonly NodeItem[]): Array<{ code: string; label: string }> {
  return [...items]
    .map((i) => i.value as LogframeNodeDef)
    .filter((n): n is LogframeNodeDef & { code: string } => n.code !== null && n.level !== "ACTIVITY")
    .sort((a, b) => DEPTH[b.level] - DEPTH[a.level])
    .map((n) => ({ code: n.code, label: `${LEVEL_LABEL[n.level]} ${n.code} · ${n.title ?? ""}` }));
}

export const INDICATOR_TYPE_LABEL = { NUMBER: "Number", PERCENTAGE: "Percentage", RATIO: "Ratio", CURRENCY: "Money" } as const;
export const INDICATOR_TYPES = Object.keys(INDICATOR_TYPE_LABEL) as Array<keyof typeof INDICATOR_TYPE_LABEL>;
export const FREQUENCIES = ["Monthly", "Quarterly", "Semi-annual", "Annual"] as const;
export const BREAKDOWN_SUGGESTIONS = ["Sex", "Age group", "Disability", "Location"] as const;

export interface IndicatorRow {
  item: IndicatorItem;
  value: IndicatorDef;
  ownerKey: string;
  direction: "HIGHER" | "LOWER" | "";
  baselineNone: boolean;
}

/** Each indicator joined to what the person has decided about it. */
export function indicatorRows(view: SetupDraftView): IndicatorRow[] {
  return view.indicators.map((item) => {
    const value = item.value as IndicatorDef;
    const setup = value.code ? view.extras.indicatorSetup[value.code] : undefined;
    return { item, value, ownerKey: setup?.ownerKey ?? "", direction: setup?.direction ?? "", baselineNone: setup?.baselineNone === true };
  });
}

/** Typed list "Sex, Age group" -> ["Sex", "Age group"]; an empty text clears the breakdown. */
export function parseBreakdown(text: string): string[] | null {
  const parts = text.split(",").map((p) => p.trim()).filter(Boolean);
  return parts.length === 0 ? null : [...new Set(parts)];
}
