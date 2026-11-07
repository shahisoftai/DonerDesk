import { canvasToWidgets, childrenOf, containerRole, isContainerKind, repeatKey, type Canvas, type DashboardWidget } from "@donordesk/domain";

/** One thing a repeater repeats for: a project or a place. */
export interface RepeatItem { key: string; label: string; projectId?: string; placeKey?: string }
export type RepeatItems = Record<string, RepeatItem[]>;

const MAX = 12;
type RepeaterProps = { over?: unknown; limit?: unknown };

/** The items each repeater of the canvas repeats for: the projects the viewer can see, or the places the project names. Nothing outside the viewer's access. */
export function repeaterItems(canvas: Canvas, projects: ReadonlyArray<{ id: string; title: string }>, places: ReadonlyArray<{ key: string; label: string }>): RepeatItems {
  const out: RepeatItems = {};
  for (const page of canvas.pages) for (const b of page.blocks) {
    if (containerRole(b.kind) !== "REPEAT" || b.style?.hidden) continue;
    const p = (b.props ?? {}) as RepeaterProps;
    const limit = Math.max(1, Math.min(MAX, typeof p.limit === "number" ? Math.floor(p.limit) : 6));
    out[b.id] = p.over === "PLACE" ? places.slice(0, limit).map((x) => ({ key: x.key, label: x.label, placeKey: x.key })) : p.over === "PROJECT" ? projects.slice(0, limit).map((x) => ({ key: x.id, label: x.title, projectId: x.id })) : [];
  }
  return out;
}

/** A copy of each chart-style child of a project repeater for each project, so the one drawing path draws every copy. The copy always reads the item\'s project. */
export function repeatedWidgets(canvas: Canvas, items: RepeatItems): DashboardWidget[] {
  const out: DashboardWidget[] = [];
  for (const page of canvas.pages) for (const holderId of Object.keys(items)) {
    if (!page.blocks.some((b) => b.id === holderId)) continue;
    for (const child of childrenOf(page.blocks, holderId)) for (const item of items[holderId] ?? []) {
      if (!item.projectId) continue;
      const made = canvasToWidgets({ ...canvas, pages: [{ ...page, blocks: [{ ...child, container: undefined, bindings: [] }] }] }, item.projectId).widgets[0];
      if (made) out.push({ ...made, id: repeatKey(child.id, item.key), projectId: item.projectId });
    }
  }
  return out;
}

/** The block ids a repeater holds: they are drawn once per item, not once on their own. */
export const heldByRepeater = (canvas: Canvas, items: RepeatItems): Set<string> => {
  const held = new Set<string>();
  for (const page of canvas.pages) for (const holderId of Object.keys(items)) for (const c of childrenOf(page.blocks, holderId)) held.add(c.id);
  return held;
};
export { isContainerKind };
