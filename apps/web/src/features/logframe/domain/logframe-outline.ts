import { LogframeLevelSchema } from "@donordesk/contracts";
import { buildHierarchy, type HierarchyNode } from "../../../lib/shared/hierarchy.ts";
import type { Tone } from "../../../lib/shared/tone.ts";

const LEVEL_ORDER: readonly string[] = LogframeLevelSchema.options;

export interface OutlineSource {
  id: string;
  parentId?: string | null;
  level: string;
  code?: string;
  title: string;
}

export interface OutlineRow<T extends OutlineSource> {
  item: T;
  depth: number;
  /** Parent id, or null at the top level. */
  parentId: string | null;
  /** Position among its siblings (0-based) and how many siblings share that parent. */
  index: number;
  siblingCount: number;
}

/** Depth-first outline that keeps the API's order (already sorted by sortOrder → level → code). */
export function outlineLogframe<T extends OutlineSource>(items: readonly T[]): OutlineRow<T>[] {
  const rows: OutlineRow<T>[] = [];
  const walk = (nodes: HierarchyNode<T>[], parentId: string | null, depth: number) => {
    nodes.forEach((node, index) => {
      const { children, ...item } = node;
      rows.push({ item: item as unknown as T, depth, parentId, index, siblingCount: nodes.length });
      walk(children, node.id, depth + 1);
    });
  };
  walk(buildHierarchy([...items]), null, 0);
  return rows;
}

export function logframeLevelRank(level: string): number {
  const rank = LEVEL_ORDER.indexOf(level);
  return rank === -1 ? LEVEL_ORDER.length : rank;
}

/** Mirrors the domain rule: a parent sits at a strictly higher level; levels may be skipped. */
export function canParentLevel(parentLevel: string, childLevel: string): boolean {
  return logframeLevelRank(parentLevel) < logframeLevelRank(childLevel);
}

/** Items that may become the parent of `child` (excludes itself and its descendants). */
export function eligibleParents<T extends OutlineSource>(items: readonly T[], child: Pick<T, "level"> & { id?: string }): T[] {
  const blocked = new Set<string>();
  if (child.id) {
    blocked.add(child.id);
    let grew = true;
    while (grew) {
      grew = false;
      for (const item of items) {
        if (item.parentId && blocked.has(item.parentId) && !blocked.has(item.id)) {
          blocked.add(item.id);
          grew = true;
        }
      }
    }
  }
  return items.filter((item) => !blocked.has(item.id) && canParentLevel(item.level, child.level));
}

export function logframeLevelTone(level: string): Tone {
  switch (level) {
    case "GOAL": return "info";
    case "OUTCOME": return "success";
    case "OUTPUT": return "warning";
    default: return "neutral";
  }
}
