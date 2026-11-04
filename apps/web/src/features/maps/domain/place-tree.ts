/**
 * The places a project touches, as a tree with counts. Pure.
 *
 * A node's counts include everything below it, so a country shows the whole project and a district only its own work. A place
 * counts as "touched" when an activity names it or a figure was recorded for it; by default only touched places (and their
 * ancestors) are listed, so the tree is the project's footprint and not the whole places list.
 */
export interface TreePlace { id: string; name: string; adminLevel: number; parentId?: string | undefined; archived: boolean; code?: string | undefined }

export interface TreeNode {
  id: string;
  name: string;
  level: number;
  depth: number;
  /** Activities that name this place or one inside it. */
  activities: number;
  /** Places at or below this one with a recorded figure. */
  figures: number;
  children: TreeNode[];
}

export interface TreeCounts {
  /** Activities naming each place directly (place id to count). */
  activities: ReadonlyMap<string, number>;
  /** Places with a recorded figure. */
  figures: ReadonlySet<string>;
}

export function buildPlaceTree(places: readonly TreePlace[], counts: TreeCounts, options: { all?: boolean } = {}): TreeNode[] {
  const live = places.filter((p) => !p.archived);
  const byId = new Map(live.map((p) => [p.id, p]));
  const kids = new Map<string | null, TreePlace[]>();
  for (const p of live) {
    const parent = p.parentId && byId.has(p.parentId) ? p.parentId : null;
    kids.set(parent, [...(kids.get(parent) ?? []), p]);
  }
  const visiting = new Set<string>();
  const make = (p: TreePlace, depth: number): TreeNode | null => {
    if (visiting.has(p.id)) return null; // a cycle in the data is cut, never followed
    visiting.add(p.id);
    const children = (kids.get(p.id) ?? [])
      .map((c) => make(c, depth + 1))
      .filter((n): n is TreeNode => n !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
    visiting.delete(p.id);
    const activities = (counts.activities.get(p.id) ?? 0) + children.reduce((n, c) => n + c.activities, 0);
    const figures = (counts.figures.has(p.id) ? 1 : 0) + children.reduce((n, c) => n + c.figures, 0);
    if (!options.all && activities === 0 && figures === 0) return null;
    return { id: p.id, name: p.name, level: p.adminLevel, depth, activities, figures, children };
  };
  return (kids.get(null) ?? []).map((p) => make(p, 0)).filter((n): n is TreeNode => n !== null).sort((a, b) => a.name.localeCompare(b.name));
}

/** The nodes in reading order, only those whose ancestors are all open. */
export function visibleNodes(roots: readonly TreeNode[], open: ReadonlySet<string>): TreeNode[] {
  const out: TreeNode[] = [];
  const walk = (n: TreeNode) => { out.push(n); if (open.has(n.id)) n.children.forEach(walk); };
  roots.forEach(walk);
  return out;
}

/** The ids to open so that `id` can be seen: every ancestor of it. Empty when the place is not in the tree. */
export function ancestorsOf(roots: readonly TreeNode[], id: string): string[] {
  const trail: string[] = [];
  const find = (n: TreeNode): boolean => {
    if (n.id === id) return true;
    trail.push(n.id);
    if (n.children.some(find)) return true;
    trail.pop();
    return false;
  };
  return roots.some(find) ? [...trail] : [];
}
