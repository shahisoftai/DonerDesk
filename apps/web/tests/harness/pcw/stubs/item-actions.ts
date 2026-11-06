import { acceptItem, acceptMany, editValue, moveResult, rejectItem } from "@donordesk/domain";
import { fail, ok, record, store } from "./state";

/** One decision on one item of the proposal (the older review's action, also used by the wizard's confirm / remove buttons). */
export async function editSetupItemAction(_id: string, input: { area: string; path: string; op: string; value?: unknown }) {
  record("editItem", input);
  const ref = { area: input.area as never, path: input.path };
  const r = input.op === "ACCEPT_MANY" ? acceptMany(store.draft.proposal, input.area as never, (input as unknown as { paths: string[] }).paths) : input.op === "ACCEPT" ? acceptItem(store.draft.proposal, ref) : input.op === "REJECT" ? rejectItem(store.draft.proposal, ref) : input.op === "MOVE" ? moveResult(store.draft.proposal, ref as never, input.value as never) : editValue(store.draft.proposal, ref, input.value);
  if (!r.ok) return fail(r.reason);
  store.draft = { ...store.draft, proposal: r.proposal };
  store.version += 1;
  return ok({ ok: true as const, updatedAt: new Date(store.version * 1000).toISOString() });
}

const found = (value: unknown) => ({ value, sourceQuote: "read from the document", sourceRef: { documentId: "d1", block: 1 }, confidence: "HIGH" as const, status: "PROPOSED" as const });

/** Documents sent: a new draft that is being read, with what the reading will find ready a moment later. Without the AI service the server says so in a sentence. */
export async function startSetupAction(_form: FormData) {
  record("startSetup", {});
  if (store.flags.noAi) return fail("Setup assistance is switched off for this organisation. An administrator can turn it on in Settings.");
  store.status = "EXTRACTING" as never;
  store.version += 1;
  setTimeout(() => {
    store.draft = {
      ...store.draft,
      proposal: {
        ...store.draft.proposal,
        logframe: [
          found({ level: "GOAL", code: "G1", title: "Healthy households", description: null, parentCode: null, codeSource: "DOCUMENT" }),
          found({ level: "OUTCOME", code: "OC1", title: "Households use safe water", description: null, parentCode: "G1", codeSource: "DOCUMENT" }),
          found({ level: "OUTPUT", code: "OP1", title: "Boreholes rehabilitated", description: null, parentCode: "OC1", codeSource: "DOCUMENT" }),
        ],
      },
    };
    store.reading = {
      sources: [{ documentId: "d1", name: "water.txt", sheets: [{ title: null, kind: "PROPOSAL" }], feeds: ["LOGFRAME"] }],
      leftOut: [{ area: "LOGFRAME", total: 2, items: [{ field: "title", text: "Clean taps everywhere", reason: "QUOTE_NOT_FOUND" }] }],
      areaRuns: {},
    };
    store.status = "READY";
    store.version += 1;
  }, 700);
  return ok({ proposalId: "draft-2" });
}

export async function getSetupPassageAction(_id: string, _doc: string, _block: number) {
  record("passage", {});
  return ok({ documentName: "water.txt", sheet: null, text: "The plan: read from the document, as written.", before: "Introduction" });
}
export async function setSetupDocumentKindAction(_id: string, documentId: string, kind: string | null) {
  record("documentKind", { documentId, kind });
  store.reading = { ...store.reading, sources: store.reading.sources.map((x) => ((x as { documentId: string }).documentId === documentId ? { ...(x as object), ...(kind ? { override: kind } : {}) } : x)) };
  return ok({ rereading: ["RESULTS"] });
}
export async function rerunSetupAreaAction(_id: string, area: string) {
  record("rerun", { area });
  return ok(undefined);
}
