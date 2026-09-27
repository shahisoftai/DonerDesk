/**
 * Pure operations on a template's flat, ordered section list where each item
 * carries `parentId` and `level`. Every operation moves whole subtrees and
 * keeps the invariants the api enforces: a parent precedes its children and a
 * child is exactly one level deeper than its parent (max depth 4).
 */
export const MAX_LEVEL = 4;

export interface TreeNode {
  id: string;
  parentId?: string;
  level: number;
}

/** [start, end) of the node and all its descendants. */
export function subtreeEnd<T extends TreeNode>(list: readonly T[], index: number): number {
  const level = list[index]!.level;
  let end = index + 1;
  while (end < list.length && list[end]!.level > level) end++;
  return end;
}

function siblingStarts<T extends TreeNode>(list: readonly T[], index: number): number[] {
  const parentId = list[index]!.parentId;
  const level = list[index]!.level;
  const out: number[] = [];
  for (let i = 0; i < list.length; i++) if (list[i]!.parentId === parentId && list[i]!.level === level) out.push(i);
  return out;
}

function depthBelow<T extends TreeNode>(list: readonly T[], index: number): number {
  let max = list[index]!.level;
  for (let i = index + 1; i < subtreeEnd(list, index); i++) max = Math.max(max, list[i]!.level);
  return max - list[index]!.level;
}

function shift<T extends TreeNode>(block: T[], delta: number): T[] {
  return block.map((n) => ({ ...n, level: n.level + delta }));
}

export function moveUp<T extends TreeNode>(list: readonly T[], index: number): T[] {
  const sibs = siblingStarts(list, index);
  const pos = sibs.indexOf(index);
  if (pos <= 0) return [...list];
  const prev = sibs[pos - 1]!;
  const end = subtreeEnd(list, index);
  return [...list.slice(0, prev), ...list.slice(index, end), ...list.slice(prev, index), ...list.slice(end)];
}

export function moveDown<T extends TreeNode>(list: readonly T[], index: number): T[] {
  const sibs = siblingStarts(list, index);
  const pos = sibs.indexOf(index);
  if (pos === -1 || pos === sibs.length - 1) return [...list];
  const next = sibs[pos + 1]!;
  return moveUp(list, next);
}

export function canIndent<T extends TreeNode>(list: readonly T[], index: number): boolean {
  const sibs = siblingStarts(list, index);
  return sibs.indexOf(index) > 0 && list[index]!.level + depthBelow(list, index) < MAX_LEVEL;
}

/** Makes the node (with its subtree) the last child of its previous sibling. */
export function indent<T extends TreeNode>(list: readonly T[], index: number): T[] {
  if (!canIndent(list, index)) return [...list];
  const sibs = siblingStarts(list, index);
  const newParent = list[sibs[sibs.indexOf(index) - 1]!]!;
  const end = subtreeEnd(list, index);
  const block = shift(list.slice(index, end), 1);
  block[0] = { ...block[0]!, parentId: newParent.id };
  return [...list.slice(0, index), ...block, ...list.slice(end)];
}

/** Moves the node (with its subtree) up one level, placed right after its former parent's subtree. */
export function outdent<T extends TreeNode>(list: readonly T[], index: number): T[] {
  const node = list[index]!;
  if (!node.parentId) return [...list];
  const parentIndex = list.findIndex((n) => n.id === node.parentId);
  if (parentIndex === -1) return [...list];
  const end = subtreeEnd(list, index);
  const block = shift(list.slice(index, end), -1);
  block[0] = { ...block[0]!, parentId: list[parentIndex]!.parentId };
  const rest = [...list.slice(0, index), ...list.slice(end)];
  const parentEnd = subtreeEnd(rest, parentIndex);
  return [...rest.slice(0, parentEnd), ...block, ...rest.slice(parentEnd)];
}

export function removeAt<T extends TreeNode>(list: readonly T[], index: number): T[] {
  return [...list.slice(0, index), ...list.slice(subtreeEnd(list, index))];
}

export function insertSiblingAfter<T extends TreeNode>(list: readonly T[], index: number, node: T): T[] {
  const ref = list[index]!;
  const end = subtreeEnd(list, index);
  return [...list.slice(0, end), { ...node, parentId: ref.parentId, level: ref.level }, ...list.slice(end)];
}

export function insertChild<T extends TreeNode>(list: readonly T[], index: number, node: T): T[] {
  const ref = list[index]!;
  if (ref.level >= MAX_LEVEL) return [...list];
  const end = subtreeEnd(list, index);
  return [...list.slice(0, end), { ...node, parentId: ref.id, level: ref.level + 1 }, ...list.slice(end)];
}
