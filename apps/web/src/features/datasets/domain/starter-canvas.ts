import { columnKind, datasetSourceId, type ColumnDef } from "@donordesk/domain/contexts/datasets/browser.js";

/**
 * "Build a chart" (§4.2 screen 7): a canvas with one dataset visual, already holding a sensible first question (a place or the first group on
 * the axis, the first figure that can be added up as the value), so the person starts from a picture and changes the wells. Pure.
 */
export function starterCanvas(datasetId: string, name: string, columns: readonly ColumnDef[], scope: "PROJECT" | "ORGANISATION", projectId?: string) {
  const group = columns.find((c) => c.semantic === "PLACE") ?? columns.find((c) => columnKind(c.kind)?.role === "GROUP");
  const figure = columns.find((c) => columnKind(c.kind)?.additive) ?? columns.find((c) => columnKind(c.kind)?.role === "FIGURE");
  const wells = { ...(group ? { AXIS: [{ ref: group.key }] } : {}), ...(figure ? { VALUES: [{ ref: figure.key }] } : {}) };
  const block = { id: "b1", kind: "DATA_VISUAL", bounds: { x: 0, y: 0, w: 8, h: 5 }, bindings: [], props: { source: datasetSourceId(datasetId), family: group ? "BAR" : "CARD", wells, crossFilter: true, ...(figure ? { altText: `${figure.label}${group ? ` by ${group.label.toLowerCase()}` : ""}` } : {}) } };
  return { title: `${name}: chart`.slice(0, 120), scope: scope === "ORGANISATION" ? "ORG" : "PROJECT", ...(projectId ? { projectId } : {}), pages: [{ id: "p1", title: "Page 1", format: "WEB_FLUID", blocks: [block] }] };
}
