/**
 * Table-of-contents view of a report's flat, ordered section list. Each
 * section carries its depth (1 = section, 2-4 = sub-sections); the parent is
 * the nearest earlier section one level up, exactly as in the donor template.
 */

export const MAX_OUTLINE_LEVEL = 4;

export type OutlineInput = {
  id: string;
  sectionTitle: string;
  level?: number | null;
  numbering?: string | null;
};

export type OutlineRow = {
  id: string;
  level: number;
  /** Donor numbering when the template has it ("Annex II"), else computed ("3.2"). */
  label: string;
  /** Title without the leading number the stored title carries. */
  title: string;
  parentId?: string;
  hasChildren: boolean;
};

/** "3.2 Progress" → "Progress" when the stored title starts with its numbering. */
function stripNumbering(title: string, numbering: string | undefined): string {
  if (!numbering) return title;
  const prefix = `${numbering} `;
  return title.startsWith(prefix) && title.length > prefix.length ? title.slice(prefix.length) : title;
}

export function buildOutline(sections: readonly OutlineInput[]): OutlineRow[] {
  const counters: number[] = [];
  const stack: OutlineRow[] = [];
  const rows: OutlineRow[] = [];
  for (const s of sections) {
    // Contiguous levels: the first section is level 1 and a section is never
    // more than one level below the one before it.
    const level = Math.max(1, Math.min(s.level ?? 1, stack.length + 1, MAX_OUTLINE_LEVEL));
    while (stack.length >= level) stack.pop();
    counters.length = level;
    counters[level - 1] = (counters[level - 1] ?? 0) + 1;
    const parent = stack[stack.length - 1];
    if (parent) parent.hasChildren = true;
    const numbering = s.numbering?.trim() || undefined;
    const row: OutlineRow = {
      id: s.id,
      level,
      label: numbering ?? counters.map((c) => c ?? 1).join("."),
      title: stripNumbering(s.sectionTitle, numbering),
      ...(parent ? { parentId: parent.id } : {}),
      hasChildren: false,
    };
    rows.push(row);
    stack.push(row);
  }
  return rows;
}

/** The tree shape the helpers below need (an OutlineRow or an editor SectionVM). */
export type OutlineNode = { id: string; level: number; parentId?: string };

/** Index range [start, end) of a row and all of its sub-sections. */
function subtreeRange(rows: readonly OutlineNode[], index: number): [number, number] {
  let end = index + 1;
  while (end < rows.length && rows[end]!.level > rows[index]!.level) end++;
  return [index, end];
}

export function descendantIds(rows: readonly OutlineNode[], id: string): string[] {
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) return [];
  const [start, end] = subtreeRange(rows, i);
  return rows.slice(start + 1, end).map((r) => r.id);
}

/** Rows hidden because an ancestor is collapsed. */
export function hiddenIds(rows: readonly OutlineNode[], collapsed: ReadonlySet<string>): Set<string> {
  const hidden = new Set<string>();
  for (const r of rows) if (collapsed.has(r.id) && !hidden.has(r.id)) for (const d of descendantIds(rows, r.id)) hidden.add(d);
  return hidden;
}

/** The previous/next sibling a section can swap with (same parent), or undefined at the edge. */
function siblingIndex(rows: readonly OutlineNode[], index: number, offset: -1 | 1): number | undefined {
  const row = rows[index]!;
  if (offset === 1) {
    const [, end] = subtreeRange(rows, index);
    return end < rows.length && rows[end]!.level === row.level && rows[end]!.parentId === row.parentId ? end : undefined;
  }
  for (let j = index - 1; j >= 0; j--) {
    if (rows[j]!.level < row.level) return undefined;
    if (rows[j]!.level === row.level) return rows[j]!.parentId === row.parentId ? j : undefined;
  }
  return undefined;
}

export function canMove(rows: readonly OutlineNode[], id: string, offset: -1 | 1): boolean {
  const i = rows.findIndex((r) => r.id === id);
  return i >= 0 && siblingIndex(rows, i, offset) !== undefined;
}

/**
 * New section order after moving a section — with all its sub-sections — past
 * its previous/next sibling. Returns undefined when it cannot move that way.
 */
export function moveWithSubtree(rows: readonly OutlineNode[], id: string, offset: -1 | 1): string[] | undefined {
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) return undefined;
  const j = siblingIndex(rows, i, offset);
  if (j === undefined) return undefined;
  const [aStart, aEnd] = offset === 1 ? subtreeRange(rows, i) : subtreeRange(rows, j);
  const [bStart, bEnd] = offset === 1 ? subtreeRange(rows, j) : subtreeRange(rows, i);
  const ids = rows.map((r) => r.id);
  return [...ids.slice(0, aStart), ...ids.slice(bStart, bEnd), ...ids.slice(aStart, aEnd), ...ids.slice(bEnd)];
}
