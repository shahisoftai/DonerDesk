// Stand-in for the finance server actions: what was sent is recorded; the import uses the real sheet rules.
import { parseRegisterSheet, registerSheetErrorFile } from "@donordesk/domain/contexts/finance/register-sheet.js";

type H = { calls: Array<{ name: string; args: unknown[] }> };
const h = (): H => (window as unknown as { __h: H }).__h;
const ok = <T,>(value: T) => ({ ok: true as const, value });
const rec = (name: string, ...args: unknown[]) => { h().calls.push({ name, args }); };

export async function addProjectFundingAction(projectId: string, input: unknown) { rec("addFunding", projectId, input); return ok({ id: "f-new" }); }
export async function removeProjectFundingAction(projectId: string, id: string) { rec("removeFunding", projectId, id); return ok({}); }
export async function addDisbursementAction(projectId: string, input: unknown) { rec("addDisbursement", projectId, input); return ok({ id: "d-new" }); }
export async function addExpenseAction(projectId: string, lineId: string, input: unknown) { rec("addExpense", projectId, lineId, input); return ok({ id: "e-new" }); }
export async function decideEntryAction(projectId: string, kind: string, id: string, input: unknown) { rec("decide", projectId, kind, id, input); return ok({}); }
export async function updateDraftEntryAction(projectId: string, kind: string, id: string, input: unknown) { rec("updateDraft", projectId, kind, id, input); return ok({}); }
export async function addDeliverableAction(projectId: string, input: unknown) { rec("addDeliverable", projectId, input); return ok({ id: "dl-new" }); }
export async function approveDeliverableAction(projectId: string, id: string) { rec("approveDeliverable", projectId, id); return ok({}); }
export async function payDeliverableAction(projectId: string, id: string, input: unknown) { rec("payDeliverable", projectId, id, input); return ok({}); }
export async function addAdvanceAction(projectId: string, input: unknown) { rec("addAdvance", projectId, input); return ok({ id: "a-new" }); }
export async function accountForAdvanceAction(projectId: string, id: string, input: unknown) { rec("accountFor", projectId, id, input); return ok({ id: "x-new" }); }

export async function importRegisterSheetAction(projectId: string, input: { text: string; apply: boolean }) {
  rec("import", projectId, input);
  const parsed = parseRegisterSheet(input.text, { lines: new Map([["1.1", { id: "L1", currency: "EUR" }]]), sources: new Map([["donor a", "s1"]]), primaryCurrency: "USD" });
  const problems = parsed.rows.flatMap((r) => r.problems.map((message) => ({ row: r.rowNumber, message })));
  const invalid = parsed.rows.filter((r) => r.problems.length > 0).length;
  const base = { rows: parsed.rows.length, valid: parsed.rows.length - invalid, invalid, unknownColumns: parsed.unknownColumns, missingColumns: parsed.missingColumns, problems, imported: 0, alreadyThere: 0, applied: false };
  if (invalid > 0) return ok({ ...base, errorFile: registerSheetErrorFile(parsed) });
  return ok(input.apply ? { ...base, imported: parsed.rows.length, applied: true } : base);
}
