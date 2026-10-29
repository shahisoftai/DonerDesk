// Stand-in for the server actions: records what the screen sends and answers like a healthy server (or fails when a test asks).
type H = { saves: unknown[]; verified: unknown[]; failNext: string | null; parse: unknown; history: unknown; historyCalls: string[]; workbookCalls: number };
const h = (): H => (window as unknown as { __h: H }).__h;
const ok = <T,>(value: T) => ({ ok: true as const, value });

export async function bulkSaveIndicatorUpdatesAction(periodId: string, rows: unknown[]) {
  if (h().failNext) { const message = h().failNext!; h().failNext = null; return { ok: false as const, error: { kind: "conflict", message } }; }
  h().saves.push({ periodId, rows });
  return ok({ saved: rows.length, skipped: 0 });
}
export async function parseIndicatorSheetAction() { return ok(h().parse); }
export async function parseIndicatorWorkbookAction() { h().workbookCalls += 1; return ok(h().parse); }
export async function verifyIndicatorUpdateAction() { return ok({}); }
export async function verifyAllIndicatorUpdatesAction(periodId: string, ids?: string[]) { h().verified.push({ periodId, ids }); return ok({ verified: ids?.length ?? 0, failed: [] }); }
export async function submitAllIndicatorUpdatesAction() { return ok({ submitted: 0, failed: [] }); }
export async function returnAllIndicatorUpdatesAction() { return ok({ returned: 0 }); }
export async function reopenIndicatorUpdatesAction() { return ok({ returned: 0 }); }
export async function setEntryWindowAction() { return ok({ description: null }); }
export async function loadValueHistoryAction(updateId: string) { h().historyCalls.push(updateId); return ok(h().history); }
