// Stand-in for the dashboards actions: one dashboard the person can change; what is added is recorded.
type H = { dashboardAdds: unknown[] };
const h = (): H => (window as unknown as { __h: H }).__h;
const ok = <T,>(value: T) => ({ ok: true as const, value });
export async function listDashboardsAction() { return ok([{ id: "d1", name: "Results dashboard", scope: "PROJECT", projectId: "p1", ownerId: "u", mine: true, canEdit: true, chartCount: 2, updatedAt: "2026-10-10T08:00:00.000Z" }]); }
export async function addDashboardChartAction(dashboardId: string, input: unknown) { h().dashboardAdds.push({ dashboardId, input }); return ok({ chartCount: 3 }); }
