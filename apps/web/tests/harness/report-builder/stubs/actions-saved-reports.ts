// Stand-in for the saved-report actions: reports are kept in memory and what was sent is recorded.
interface Saved { id: string; name: string; scope: string; projectId: string; mine: boolean; canEdit: boolean; query: Record<string, unknown>; updatedAt: string }
type H = { reports: Saved[]; reportSaves: unknown[]; n: number };
const h = (): H => (window as unknown as { __h: H }).__h;
const ok = <T,>(value: T) => ({ ok: true as const, value });

export async function listSavedReportsAction() { return ok([...h().reports]); }
export async function saveReportAction(input: { name: string; scope: string; projectId: string; query: Record<string, unknown> }, reportId?: string) {
  h().reportSaves.push({ input, reportId });
  const updatedAt = new Date(Date.UTC(2026, 9, 10, 8, 0, ++h().n)).toISOString();
  if (reportId) { Object.assign(h().reports.find((r) => r.id === reportId)!, { name: input.name, query: input.query, updatedAt }); return ok({ id: reportId, updatedAt }); }
  const id = `r${h().n}`;
  h().reports.unshift({ id, name: input.name, scope: input.scope, projectId: input.projectId, mine: true, canEdit: true, query: input.query, updatedAt });
  return ok({ id, updatedAt });
}
export async function deleteSavedReportAction(id: string) { h().reports = h().reports.filter((r) => r.id !== id); return ok(undefined); }
