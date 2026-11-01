// A stand-in for the wizard's server actions: an in-memory proposal that the REAL domain rules edit, check and plan.
import {
  SETUP_AREAS, SETUP_AREA_KEYS, acceptItem, acceptMany, addIndicator, blockingProblems, checkProposal, chooseAlternative, editValue, fillNotStated, linkItem,
  moveResult, planApply, projectDraftFromProposal, proposeCodes, rejectItem, type ProjectSetupProposal,
} from "@donordesk/domain/contexts/project-setup/index.js";

type Call = { name: string; args: unknown[] };
type Run = { id: string; kind: "EXTRACT" | "APPLY"; area: string | null; status: "RUNNING" | "FINISHED" | "FAILED"; detail: Record<string, string | number | boolean>; startedAt: string; finishedAt: string | null };
interface Stored { id: string; status: string; sourceName: string; proposal: ProjectSetupProposal; appliedProjectId: string | null; updatedAt: number; documents: string[]; runs: Run[]; usage: { calls: number; inputTokens: number; outputTokens: number; costUsd: number | null } }
interface H { calls: Call[]; store: Map<string, Stored>; refresh: () => void; navigate: (u: string) => void; refreshes: number; fixtures: () => ProjectSetupProposal; flags: { planFails: boolean } }
const h = () => (window as unknown as { __h: H }).__h;
const ok = <T,>(value: T) => ({ ok: true as const, value });
const rec = (name: string, ...args: unknown[]) => { h().calls.push({ name, args }); };

const item = <T,>(value: T, quote: string) => ({ value, sourceQuote: quote, sourceRef: { documentId: "source-1", block: 0 }, confidence: "HIGH" as const, status: "PROPOSED" as const });
const none = () => ({ value: null, sourceQuote: null, sourceRef: null, confidence: "LOW" as const, status: "PROPOSED" as const });

/** What a finished reading found: a donor, three results, an indicator and a risk; no name or dates (to be written by hand). */
export function fixture(withPlan: boolean): ProjectSetupProposal {
  return {
    sources: [
      { documentId: "source-1", name: "Proposal.docx", sheets: [{ title: null, kind: "PROPOSAL" }] },
      { documentId: "source-2", name: "Budget.xlsx", sheets: [{ title: "Summary Budget", kind: "BUDGET" }, { title: "LOE", kind: "OTHER" }] },
    ],
    facts: { name: none(), code: none(), donor: { ...item("European Union", "Funded by the European Union."), alternatives: [{ value: "ECHO", sourceQuote: "Grant agreement with ECHO.", sourceRef: null }] }, countries: none(), sectors: none(), startDate: none(), endDate: none(), currency: none(), summary: none() },
    logframe: [
      item({ level: "GOAL", code: "1", title: "Improved health of households", description: null, parentCode: null }, "Goal 1: Improved health of households."),
      item({ level: "OUTCOME", code: "1.1", title: "Households use safe water", description: null, parentCode: "1" }, "Outcome 1.1: Households use safe water."),
      item({ level: "OUTPUT", code: "1.1.1", title: "40 boreholes rehabilitated", description: null, parentCode: "1.1" }, "Output 1.1.1: 40 boreholes rehabilitated."),
    ],
    indicators: [item({ code: "1.1.a", title: "People with safe water", logframeCode: "1.1.1", type: "NUMBER", unit: null, baseline: "0", target: "12,000", targetSchedule: null, frequency: null, direction: null, disaggregation: null, meansOfVerification: null }, "Baseline 0, target 12,000.")],
    periods: [], plan: withPlan ? [item({ title: "Borehole rehabilitation", logframeCode: "1.1.1", start: "2027-04-01", end: "2027-09-30", location: "Gulu", lead: null }, "Activity A1 from 1 April 2027.")] : [], places: [], funding: [], budget: [],
    risks: [item({ kind: "RISK", title: "Flooding may delay works", seriousness: "high", mitigation: "Work in the dry season" }, "Risk: flooding may delay works.")],
  } as unknown as ProjectSetupProposal;
}

const iso = (n: number) => new Date(1_790_000_000_000 + n * 1000).toISOString();
function runsFor(s: Stored): Run[] {
  return s.runs;
}

export function viewOf(s: Stored) {
  const problems = checkProposal(s.proposal);
  return {
    usage: s.usage,
    proposal: { id: s.id, status: s.status, sourceName: s.sourceName, proposal: s.proposal, problems, appliedProjectId: s.appliedProjectId, createdAt: iso(0), updatedAt: iso(s.updatedAt), expiresAt: iso(99999) },
    problems,
    runs: runsFor(s),
    areas: SETUP_AREA_KEYS.map((area) => ({ area, labelKey: SETUP_AREAS[area].labelKey, fields: [...SETUP_AREAS[area].fields], items: SETUP_AREAS[area].items(s.proposal), accepted: SETUP_AREAS[area].accepted(s.proposal) })),
  };
}

/** The test's lever: the reading finishes (with PLAN failing when asked), the way the server's background run would. */
export function finishReading(id: string) {
  const s = h().store.get(id)!;
  s.proposal = fixture(!h().flags.planFails);
  s.status = "READY";
  s.runs = SETUP_AREA_KEYS.map((area, i) => ({
    id: `r${i}`, kind: "EXTRACT" as const, area, status: area === "PLAN" && h().flags.planFails ? "FAILED" as const : "FINISHED" as const,
    detail: area === "PLAN" && h().flags.planFails ? { reason: "The AI service cannot be used right now: it is busy (error 429)." } : { checked: 3, dropped: 0, calls: 1, inputTokens: 2000, outputTokens: 100 },
    startedAt: iso(i), finishedAt: iso(i + 1),
  }));
  s.usage = { calls: 6, inputTokens: 12345, outputTokens: 678, costUsd: null };
  s.updatedAt += 1;
}

export async function startSetupAction(formData: FormData) {
  const files = formData.getAll("file").map((f) => (f as File).name);
  const text = String(formData.get("text") ?? "");
  rec("start", files, text);
  const id = "p1";
  h().store.set(id, { id, status: "EXTRACTING", sourceName: files.length > 1 ? `${files[0]} (+${files.length - 1} more)` : files[0] ?? "Project description (pasted text).txt", proposal: { ...fixture(false), logframe: [], indicators: [], risks: [], facts: fixture(false).facts } as ProjectSetupProposal, appliedProjectId: null, updatedAt: 1, documents: files.length > 0 ? files : ["Project description (pasted text).txt"], runs: [], usage: { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: null } });
  return ok({ proposalId: id });
}
export async function listSetupProposalsAction() { return ok({ proposals: [] }); }
export async function getSetupProposalAction(id: string) { const s = h().store.get(id); return s ? ok(viewOf(s)) : { ok: false as const, error: { kind: "not_found" as const, message: "Not found" } }; }

export async function editSetupItemAction(id: string, input: { area: string; path: string; op: string; value?: unknown }) {
  rec("edit", id, input);
  const s = h().store.get(id)!;
  const ref = { area: input.area as never, path: input.path };
  const op = input.op;
  const r = op === "ACCEPT" ? acceptItem(s.proposal, ref)
    : op === "ACCEPT_MANY" ? acceptMany(s.proposal, input.area as never, (input as { paths?: string[] }).paths ?? [])
    : op === "REJECT" ? rejectItem(s.proposal, ref)
    : op === "FILL" ? fillNotStated(s.proposal, ref, input.value)
    : op === "LINK" ? linkItem(s.proposal, ref, input.value ?? null)
    : op === "CHOOSE" ? chooseAlternative(s.proposal, ref, input.value)
    : op === "MOVE" ? moveResult(s.proposal, ref, input.value)
    : op === "ADD_INDICATOR" ? addIndicator(s.proposal, input.value, input.area as never)
    : editValue(s.proposal, ref, input.value);
  if (!r.ok) return { ok: false as const, error: { kind: "validation" as const, message: r.reason, fields: {} } };
  s.proposal = r.proposal;
  s.updatedAt += 1;
  return ok({ ok: true as const, updatedAt: iso(s.updatedAt) });
}

export async function rerunSetupAreaAction(id: string, area: string) {
  rec("rerun", id, area);
  const s = h().store.get(id)!;
  if (area === "PLAN") s.proposal = { ...s.proposal, plan: fixture(true).plan };
  s.runs = s.runs.map((r) => (r.area === area ? { ...r, status: "FINISHED" as const, detail: { checked: 1, dropped: 0, calls: 1, inputTokens: 500, outputTokens: 50 } } : r));
  s.usage = { ...s.usage, calls: s.usage.calls + 1, inputTokens: s.usage.inputTokens + 500 };
  s.updatedAt += 1;
  return ok({});
}

export async function setSetupDocumentKindAction(id: string, documentId: string, kind: string | null) {
  rec("kind", id, documentId, kind);
  const s = h().store.get(id)!;
  s.proposal = { ...s.proposal, sources: (s.proposal.sources ?? []).map((d) => (d.documentId === documentId ? (kind ? { ...d, override: kind as never } : { documentId: d.documentId, name: d.name, sheets: d.sheets }) : d)) };
  s.updatedAt += 1;
  return ok({ rereading: [...SETUP_AREA_KEYS] });
}

export async function getSetupPassageAction(id: string, documentId: string, block: number) {
  rec("passage", id, documentId, block);
  return ok({ documentName: "Proposal.docx", sheet: null, text: "Introduction.\nGoal 1: Improved health of households.\nMore text.", before: "Title page" });
}

export async function previewSetupApplyAction(id: string, areas?: string[]) {
  rec("preview", id, areas);
  const s = h().store.get(id)!;
  const proposal = proposeCodes(s.proposal);
  const selection = Object.fromEntries((areas ?? SETUP_AREA_KEYS).map((a) => [a, true]));
  const plan = planApply(proposal, selection);
  const { draft, missing } = projectDraftFromProposal(proposal);
  const problems = checkProposal(proposal);
  return ok({ plan, areas: plan.steps.map((st) => ({ area: st.area, items: st.items, notes: [] as string[] })), draft: draft as Record<string, string>, missing, blocking: blockingProblems(problems), problems });
}

export async function applySetupProposalAction(id: string, input: { project: unknown; areas?: string[] }) {
  rec("apply", id, input);
  const s = h().store.get(id)!;
  s.status = "APPLIED";
  s.appliedProjectId = "proj-1";
  const areas = (input.areas ?? SETUP_AREA_KEYS).map((area) => ({ area: area as never, status: "APPLIED" as const, created: SETUP_AREAS[area as never as keyof typeof SETUP_AREAS]?.accepted(s.proposal) ?? 0, skipped: 0, notes: [] as string[] }));
  return ok({
    projectId: "proj-1", status: "APPLIED" as const, areas,
    documents: s.documents.map((name) => ({ name, folder: "00-Project-Documents", link: `https://drive.example/${encodeURIComponent(name)}` })),
  });
}
export async function discardSetupProposalAction(id: string) { rec("discard", id); h().store.delete(id); return ok(undefined); }
