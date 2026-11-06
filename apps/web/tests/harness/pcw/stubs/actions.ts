import {
  applyFinanceOperation, applyOperation, applyPack, applyPlaceOperation, applyPlanOperation, applyResultOperation, applyRiskOperation,
  SETUP_REQUIREMENTS, evaluateRequirements, gapInbox, resolvePack, signOffDraft, canLaunch,
} from "@donordesk/domain";
import { fail, ok, packs, record, store, view } from "./state";

const save = (draft: typeof store.draft) => { store.draft = draft; store.version += 1; };

async function viaProposal<Op>(name: string, op: unknown, apply: (p: typeof store.draft.proposal, o: Op) => { ok: true; proposal: typeof store.draft.proposal } | { ok: false; reason: string }) {
  record(name, op);
  const r = apply(store.draft.proposal, op as Op);
  if (!r.ok) return fail(r.reason);
  save({ ...store.draft, proposal: r.proposal });
  return ok(view());
}

export async function startDraftAction(input: unknown) { record("startDraft", input); return ok({ proposalId: "draft-1" }); }
export async function getDraftAction(_id: string) { return ok(view()); }
export async function editDraftAction(_id: string, op: unknown) {
  record("editDraft", op);
  const r = applyOperation(store.draft, op as never);
  if (!r.ok) return fail(r.reason);
  save(r.draft);
  return ok(view());
}
export async function applyPackAction(_id: string) {
  record("applyPack", {});
  const pack = resolvePack(packs, store.draft.extras.start.sector);
  if (!pack) return fail("There are no starting answers for this sector yet.");
  const applied = applyPack(store.draft, pack);
  save(applied.draft);
  return ok({ view: view(), packLabel: pack.label, filled: applied.filled });
}
export const changeResultsAction = (_id: string, op: unknown) => viaProposal("changeResults", op, applyResultOperation as never);
export const changePlacesAction = (_id: string, op: unknown) => viaProposal("changePlaces", op, applyPlaceOperation as never);
export const changePlanAction = (_id: string, op: unknown) => viaProposal("changePlan", op, applyPlanOperation as never);
export const changeFinanceAction = (_id: string, op: unknown) => viaProposal("changeFinance", op, applyFinanceOperation as never);
export const changeRisksAction = (_id: string, op: unknown) => viaProposal("changeRisks", op, applyRiskOperation as never);

export async function signOffAction(_id: string) {
  record("signOff", {});
  const open = gapInbox(evaluateRequirements(store.draft, SETUP_REQUIREMENTS)).length;
  const r = signOffDraft(store.draft, "u1", new Date(0).toISOString(), open);
  if (!r.ok) return fail(r.reason);
  save(r.draft);
  return ok(view());
}

/** The server's real launch is proven on a real database elsewhere; here the page only needs the verdict and a report to show. */
export async function launchProjectAction(_id: string) {
  record("launch", {});
  const verdict = canLaunch(evaluateRequirements(store.draft, SETUP_REQUIREMENTS), store.draft);
  if (!verdict.ok) return fail("Sign off on the last slide before starting the project.");
  const areas = ["FACTS", "LOGFRAME", "INDICATORS", "PERIODS", "PLAN", "PLACES", "FUNDING_BUDGET", "RISKS"].map((area) => ({ area, status: "APPLIED" as const, created: 1, skipped: 0, notes: [] as string[] }));
  if (store.flags.failLaunch) {
    store.status = "PARTIAL";
    store.appliedProjectId = "proj-1";
    return ok({ projectId: "proj-1", status: "PARTIAL" as const, areas: areas.map((a) => (a.area === "PLAN" ? { ...a, status: "FAILED" as const, error: "The project's folders are still being prepared." } : a)), steps: [], notWritten: [] });
  }
  store.status = "APPLIED";
  store.appliedProjectId = "proj-1";
  store.version += 1;
  return ok({ projectId: "proj-1", status: "LAUNCHED" as const, areas, steps: [{ key: "FORMS", label: "Draft forms for field collection", status: "DONE" as const, done: 1, notes: ["I2: a rate cannot have a form."] }, { key: "ACTIVATION", label: "Start the project", status: "DONE" as const, done: 1, notes: [] }], notWritten: ["1 budget line that pay for the whole project: add them there."] });
}
