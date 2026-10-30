// Stand-in for the dashboard actions: a save is recorded, nothing else is stored.
type H = { saves: Array<{ input: Record<string, unknown>; id?: string }>; refreshes: number };
const h = (): H => (window as unknown as { __h: H }).__h;
const ok = <T,>(value: T) => ({ ok: true as const, value });
export async function saveDashboardAction(input: Record<string, unknown>, id?: string) { h().saves.push({ input, id }); return ok({ id: id ?? "d1", updatedAt: "2026-10-10T09:00:00.000Z" }); }
export async function getDashboardChartsAction() { return ok([]); }
export async function deleteDashboardAction() { return ok(undefined); }
export async function listDashboardLinksAction() { return ok([]); }
export async function createDashboardLinkAction() { return ok({ id: "l1", token: "t", expiresAt: "2027-01-01" }); }
export async function revokeDashboardLinkAction() { return ok(undefined); }
