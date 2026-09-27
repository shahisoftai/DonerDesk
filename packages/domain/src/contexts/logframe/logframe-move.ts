import { DomainError } from "../../core/domain-error.js";
import type { Result } from "../../core/result.js";
import { canParentLogframeLevel, logframeLevelRank, type LogframeItem } from "./logframe-item.js";

export interface LogframeMove {
  itemId: string;
  /** null = top level. */
  parentId: string | null;
  /** Target position among the new siblings (clamped). */
  index: number;
}

/** Sibling order used everywhere items are listed: explicit sortOrder, then level, then code. */
export function compareLogframeItems(a: LogframeItem, b: LogframeItem): number {
  return (
    a.sortOrder - b.sortOrder ||
    logframeLevelRank(a.level) - logframeLevelRank(b.level) ||
    (a.code ?? "").localeCompare(b.code ?? "", undefined, { numeric: true }) ||
    a.createdAt.getTime() - b.createdAt.getTime()
  );
}

/**
 * Validates moving one item within a project's logframe and places the
 * affected siblings densely (0..n-1). Returns the items whose position changed.
 */
export function planLogframeMove(items: readonly LogframeItem[], move: LogframeMove): Result<LogframeItem[], DomainError> {
  const byId = new Map(items.map((item) => [item.id, item]));
  const item = byId.get(move.itemId);
  if (!item) return { ok: false, error: DomainError.notFound("LogframeItem", move.itemId) };

  const parent = move.parentId ? byId.get(move.parentId) : undefined;
  if (move.parentId) {
    if (!parent || parent.projectId !== item.projectId) {
      return { ok: false, error: DomainError.notFound("LogframeItem", move.parentId) };
    }
    if (!canParentLogframeLevel(parent.level, item.level)) {
      return { ok: false, error: DomainError.validation(`A ${item.level} cannot be placed under a ${parent.level}`) };
    }
    for (let cursor: LogframeItem | undefined = parent; cursor; cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined) {
      if (cursor.id === item.id) {
        return { ok: false, error: DomainError.validation("An item cannot be moved under itself or its own descendants") };
      }
    }
  }

  const newParentId = move.parentId ?? undefined;
  const siblings = items
    .filter((other) => other.id !== item.id && other.projectId === item.projectId && (other.parentId ?? undefined) === newParentId)
    .sort(compareLogframeItems);
  const index = Math.max(0, Math.min(Math.trunc(move.index), siblings.length));
  siblings.splice(index, 0, item);

  const changed: LogframeItem[] = [];
  siblings.forEach((sibling, position) => {
    const parentChanged = sibling === item && (item.parentId ?? undefined) !== newParentId;
    if (parentChanged || sibling.sortOrder !== position) {
      sibling.placeAt(sibling === item ? newParentId : sibling.parentId, position);
      changed.push(sibling);
    }
  });
  return { ok: true, value: changed };
}
