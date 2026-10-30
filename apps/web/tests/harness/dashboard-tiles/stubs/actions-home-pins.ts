// Stand-in for the Home pin actions: the harness only needs the dashboard header's button to exist.
export async function pinDashboardAction(dashboardId: string) { (window as unknown as { __pins?: string[] }).__pins = [...((window as unknown as { __pins?: string[] }).__pins ?? []), dashboardId]; return { ok: true as const, value: { id: "pin-new" } }; }
