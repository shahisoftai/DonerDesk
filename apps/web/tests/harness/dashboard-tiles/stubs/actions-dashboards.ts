// Stand-in for the dashboard actions: a save is recorded, nothing else is stored.
type H = { saves: Array<{ input: Record<string, unknown>; id?: string }>; refreshes: number; previews?: Array<string[]> };
const h = (): H => (window as unknown as { __h: H }).__h;
const ok = <T,>(value: T) => ({ ok: true as const, value });
export async function saveDashboardAction(input: Record<string, unknown>, id?: string) { h().saves.push({ input, id }); return ok({ id: id ?? "d1", updatedAt: "2026-10-10T09:00:00.000Z" }); }
export async function getDashboardChartsAction() { return ok([]); }
/** Draws a tile that is not saved yet: the real server answers from the project's data; here a map and a number tile get a drawing of their own settings. */
export async function previewDashboardChartsAction(widgets: Array<Record<string, any>>) {
  (h().previews ??= []).push(widgets.map((w) => String(w.id)));
  return ok(widgets.map((w) => w.kind === "MAP"
    ? { widgetId: w.id, map: { view: w.map.view, title: w.map.title ?? "Map", projectId: w.projectId } }
    : w.kind === "METRIC"
      ? { widgetId: w.id, metric: { title: w.metric.title ?? "Tile", color: w.metric.color ?? "GREY", value: 3, text: "3", unit: "activities", note: null } }
      : w.kind === "TEXT" ? { widgetId: w.id, text: w.text ?? "" }
      : { widgetId: w.id, unavailable: "not drawn by this stand-in" }));
}
export async function deleteDashboardAction() { return ok(undefined); }
export async function listDashboardLinksAction() { return ok([]); }
export async function createDashboardLinkAction() { return ok({ id: "l1", token: "t", expiresAt: "2027-01-01" }); }
export async function revokeDashboardLinkAction() { return ok(undefined); }
