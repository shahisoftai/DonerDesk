// The setup wizard's application layer with fake extractors, repositories and storage (Phase 36.1): a fake document
// yields a stored, editable proposal end to end. No model, no database.
import test from "node:test";
import assert from "node:assert/strict";
import { SETUP_AREAS, TenantId } from "@donordesk/domain";
import {
  DiscardSetupProposalHandler, EditSetupProposalHandler, GetSetupProposalHandler, ListSetupProposalsHandler,
  RerunSetupAreaHandler, SetupExtractionOrchestrator, StartSetupExtractionHandler, UpdateSetupAssistSettingsHandler,
  emptySetupProposal, proposalExpiry,
} from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const NOW = new Date("2026-10-30T08:00:00Z");
const as = (userId, role = "ADMIN") => ({ tenant: { tenantId, userId, role }, requestId: "r" });
const creator = as("u1");
const manager = as("admin");
const other = as("u2", "PROJECT_MANAGER");
const ok = (value) => ({ ok: true, value });

const P = (value, quote) => ({ value, sourceQuote: quote ?? null, sourceRef: quote ? { documentId: "source", block: 0 } : null, confidence: "HIGH", status: "PROPOSED" });
const DOCUMENT = "The project is named Blue Water. It starts on 1 January 2026 and ends on 1 January 2025. GOAL-1: Clean water for all. Budget is EUR 1,000. A risk is flooding.";

function fakeProposalRepo() {
  const byId = new Map();
  return {
    byId,
    async create(p) { byId.set(p.id, { ...p }); return ok(undefined); },
    async findById(id) { return ok(byId.get(id) ?? null); },
    async update(p, expectedUpdatedAt) {
      const current = byId.get(p.id);
      if (!current) return ok(false);
      if (expectedUpdatedAt && current.updatedAt.getTime() !== expectedUpdatedAt.getTime()) return ok(false);
      byId.set(p.id, { ...p, updatedAt: new Date(NOW.getTime() + 1000) });
      return ok(true);
    },
    async listForCreator(tenantId, userId) { return ok([...byId.values()].filter((p) => p.createdById === userId).reverse()); },
    async countStartedSince() { return ok([...byId.values()].length); },
    async delete(id) { byId.delete(id); return ok(undefined); },
  };
}
function fakeRunRepo() {
  const runs = new Map();
  let seq = 0;
  return {
    runs,
    async start(r) { runs.set(r.id, { ...r }); return ok(undefined); },
    async progress(id, _t, detail) { const r = runs.get(id); if (r) r.detail = detail; return ok(undefined); },
    async finish(id, _t, detail, at) { const r = runs.get(id); if (r) { r.status = "FINISHED"; r.detail = detail; r.finishedAt = at; } return ok(undefined); },
    async fail(id, _t, detail, at) { const r = runs.get(id); if (r) { r.status = "FAILED"; r.detail = detail; r.finishedAt = at; } return ok(undefined); },
    async find(id) { return ok(runs.get(id) ?? null); },
    async listByProposal(proposalId) { return ok([...runs.values()].filter((r) => r.proposalId === proposalId)); },
    async deleteByProposal(proposalId) { for (const [id, r] of [...runs]) if (r.proposalId === proposalId) runs.delete(id); return ok(undefined); },
    nextId: () => `run-${++seq}`,
  };
}
const factsWith = (patch = {}) => ({ ...emptySetupProposal().facts, ...patch });

const factsExtractor = () => ({
  area: "FACTS",
  async extract() {
    return ok({
      fields: {
        facts: factsWith({
          name: P("Blue Water", "The project is named Blue Water."),
          startDate: P("2026-01-01", "It starts on 1 January 2026"),
          endDate: P("2025-01-01", "ends on 1 January 2025"),
        }),
      },
      model: "test-model", promptVersion: "p1",
    });
  },
});
const logframeExtractor = (fail = false) => ({
  area: "LOGFRAME",
  async extract({ sourceText }) {
    if (fail) return { ok: false, error: Object.assign(new Error("The model did not answer with JSON."), { name: "DomainError" }) };
    return ok({
      fields: {
        logframe: [
          P({ level: "GOAL", code: "GOAL-1", title: "Clean water", description: null, parentCode: null }, "GOAL-1: Clean water for all."),
          // One item whose quote is not in the document: the orchestrator must drop it before anyone sees it.
          P({ level: "OUTCOME", code: "OUT-9", title: "Made up", description: null, parentCode: "GOAL-1" }, "This quote is not in the document."),
        ],
      },
      model: "test-model", promptVersion: "p1",
    });
  },
});

function world(over = {}) {
  const events = [];
  const proposals = fakeProposalRepo();
  const runs = fakeRunRepo();
  const removedKeys = [];
  const tasks = [];
  const runInBackground = (task) => { tasks.push(task); };
  const flush = async () => { while (tasks.length > 0) await tasks.shift()(); };
  const org = { id: "o1", aiEnabled: over.aiEnabled ?? true, setupAssistEnabled: over.optedIn ?? true, updateSetupAssistSettings(p) { this.setupAssistEnabled = p.enabled; } };
  // Server storage is used only to clean up proposals made before documents moved to the organisation's Drive.
  const storage = { remove: async (key) => { removedKeys.push(key); } };
  const stagedDocs = [];
  const removedStaged = [];
  const documents = {
    available: async () => over.driveConnected ?? true,
    stage: async (_tenant, doc) => {
      if (over.driveFails) return { ok: false, error: Object.assign(new Error("drive down"), { name: "DomainError" }) };
      stagedDocs.push(doc);
      return ok({ fileId: `file-${stagedDocs.length}` });
    },
    read: async () => ok({ bytes: Buffer.from(DOCUMENT), mimeType: "text/plain", name: "d" }),
    moveToProject: async () => ok({ folder: "00-Project-Documents" }),
    removeStaged: async (_tenant, fileId) => { removedStaged.push(fileId); return ok(undefined); },
  };
  const common = { proposals, runs, runRows: runs.runs, storage, documents, stagedDocs, removedStaged, tasks, flush, events, removedKeys, org, proposalsById: proposals.byId };
  const reader = {
    read: async () => over.unreadable ? { ok: false, error: Object.assign(new Error("No readable text was found in this document."), { name: "DomainError" }) } : ok([
      { documentId: "source", index: 0, text: DOCUMENT },
    ]),
  };
  const extractors = over.extractors ?? [factsExtractor(), logframeExtractor(over.logframeFails ?? false)];
  const audit = { record: async (e) => { events.push(e); } };
  const clock = { now: () => NOW };
  const ids = { generate: () => `id-${proposals.byId.size + 1}-${Math.random().toString(36).slice(2, 8)}` };
  const llm = { available: async () => over.providerAvailable ?? true, completeJson: async () => ok(null) };
  const orchestrator = new SetupExtractionOrchestrator(proposals, runs, reader, extractors, audit, clock, ids, undefined, undefined, over.concurrency);
  const start = new StartSetupExtractionHandler(
    { findByTenant: async () => ok(org) }, proposals, runs, documents, llm, orchestrator, audit, clock, ids, runInBackground, over.maxRunsPerDay ?? 10,
  );
  const gets = new GetSetupProposalHandler(proposals, runs, clock);
  const edits = new EditSetupProposalHandler(proposals, audit, clock);
  const reruns = new RerunSetupAreaHandler(proposals, runs, reader, over.rerunExtractors ?? extractors, audit, clock, ids);
  const discards = new DiscardSetupProposalHandler(proposals, runs, storage, documents, audit, clock);
  const lists = new ListSetupProposalsHandler(proposals, clock);
  const settings = new UpdateSetupAssistSettingsHandler({ findByTenant: async () => ok(org), update: async (o) => (Object.assign(org, o), ok(undefined)) }, audit);
  return { start, gets, edits, reruns, discards, lists, settings, orchestrator, ...common, audit, clock };
}

test("a fake document yields a stored, editable proposal end to end", async () => {
  const w = world();
  const started = await w.start.handle(creator, { fileName: "proposal.docx", fileType: "application/vnd.octet", buffer: Buffer.from(DOCUMENT) });
  assert.ok(started.ok);
  assert.equal(started.value.status, "EXTRACTING");
  assert.equal(started.value.sourceName, "proposal.docx");
  const row = w.proposalsById.get(started.value.proposalId);
  assert.equal(row.status, "EXTRACTING");
  assert.match(row.sourceStorageKey, /^drive:/, "the document is in the organisation's Drive, not server storage");
  assert.equal(row.expiresAt.getTime(), proposalExpiry(NOW).getTime());
  assert.ok(w.tasks.length === 1, "extraction is scheduled in the background");
  await w.flush();

  const stored = w.proposalsById.get(started.value.proposalId);
  assert.equal(stored.status, "READY");
  assert.equal(stored.proposal.facts.name.value, "Blue Water");
  assert.equal(stored.proposal.logframe.length, 1, "the ungrounded item was dropped before anyone saw it");
  assert.equal(stored.proposal.logframe[0].value.code, "GOAL-1");
  assert.equal(stored.model, "test-model");
  assert.deepEqual(stored.problems.map((p) => p.code), ["END_BEFORE_START"], "facts end before start: a real cross-area problem");
  const kinds = [...w.runRows.values()].map((r) => r.status);
  assert.deepEqual(kinds.filter((s) => s === "FINISHED").length >= 3, true, "the whole-document run and both area runs finished");

  const view = await w.gets.handle(creator, started.value.proposalId);
  assert.ok(view.ok);
  const logframeArea = view.value.areas.find((a) => a.area === "LOGFRAME");
  assert.equal(logframeArea.items, 1);
  assert.equal(logframeArea.accepted, 0);

  const accepted = await w.edits.handle(creator, started.value.proposalId, { area: "LOGFRAME", path: "logframe.0", op: "ACCEPT" });
  assert.ok(accepted.ok);
  assert.equal(SETUP_AREAS.LOGFRAME.accepted(w.proposalsById.get(started.value.proposalId).proposal), 1);
  assert.ok(w.events.some((e) => e.eventType === "setup.proposal.edited"));
  assert.ok(w.events.some((e) => e.eventType === "setup.extraction.started"));
  assert.ok(w.events.some((e) => e.eventType === "setup.extraction.finished"));
  const startedEvent = w.events.find((e) => e.eventType === "setup.extraction.started");
  assert.ok(!JSON.stringify(startedEvent).includes("Blue Water"), "the audit carries the length, never the text");
});

test("the document goes to the organisation's Drive, not the server, and discard removes source, runs and proposal", async () => {
  const w = world();
  const started = await w.start.handle(creator, { fileName: "d.txt", fileType: "text/plain", buffer: Buffer.from(DOCUMENT) });
  await w.flush();
  const key = w.proposalsById.get(started.value.proposalId).sourceStorageKey;
  assert.equal(key, "drive:file-1", "the proposal keeps only the Drive file's reference");
  assert.equal(w.stagedDocs.length, 1);
  assert.equal(w.stagedDocs[0].name, "d.txt");
  const discarded = await w.discards.handle(creator, started.value.proposalId);
  assert.ok(discarded.ok);
  assert.deepEqual(w.removedStaged, ["file-1"], "a never-applied document is removed from the staging folder");
  assert.deepEqual(w.removedKeys, [], "nothing was in server storage");
  assert.equal(w.proposalsById.size, 0);
  assert.equal([...w.runRows.values()].length, 0);
  assert.ok(w.events.some((e) => e.eventType === "setup.proposal.discarded"));
  const gone = await w.gets.handle(creator, started.value.proposalId);
  assert.equal(gone.ok, false);
});

test("a failed area leaves the others intact, is reported, and a rerun repairs only that area", async () => {
  const w = world({ logframeFails: true, rerunExtractors: [factsExtractor(), logframeExtractor(false)] });
  const started = await w.start.handle(creator, { fileName: "d.txt", fileType: "text/plain", buffer: Buffer.from(DOCUMENT) });
  await w.flush();
  const stored = w.proposalsById.get(started.value.proposalId);
  assert.equal(stored.status, "READY", "facts read fine, so the proposal is reviewable");
  assert.equal(stored.proposal.logframe.length, 0);
  const failedRun = [...w.runRows.values()].find((r) => r.area === "LOGFRAME");
  assert.equal(failedRun.status, "FAILED");

  const rerun = await w.reruns.handle(creator, started.value.proposalId, "LOGFRAME");
  assert.ok(rerun.ok);
  const after = w.proposalsById.get(started.value.proposalId);
  assert.equal(after.proposal.logframe.length, 1, "the rerun replaces the area");
  assert.equal(after.proposal.facts.name.value, "Blue Water", "the other areas keep what they read");
  const repaired = [...w.runRows.values()].filter((r) => r.area === "LOGFRAME");
  assert.deepEqual(repaired.map((r) => r.status), ["FAILED", "FINISHED"]);
});

test("a rerun keeps edits of other areas and replaces the rerun area's decisions", async () => {
  const rerunExtractors = [{
    area: "LOGFRAME",
    async extract() {
      return ok({ fields: { logframe: [P({ level: "GOAL", code: "GOAL-1", title: "New reading", description: null, parentCode: null }, "GOAL-1: Clean water for all.")] } });
    },
  }];
  const w = world({ rerunExtractors });
  const started = await w.start.handle(creator, { fileName: "d.txt", fileType: "text/plain", buffer: Buffer.from(DOCUMENT) });
  await w.flush();
  const id = started.value.proposalId;
  await w.edits.handle(creator, id, { area: "LOGFRAME", path: "logframe.0", op: "ACCEPT" });
  await w.edits.handle(creator, id, { area: "FACTS", path: "facts.name", op: "EDIT", value: "Blue Water (revised)" });
  const rerun = await w.reruns.handle(creator, id, "LOGFRAME");
  assert.ok(rerun.ok);
  const stored = w.proposalsById.get(id);
  assert.equal(stored.proposal.logframe[0].value.title, "New reading", "the rerun area shows the new reading");
  assert.equal(stored.proposal.logframe[0].status, "PROPOSED", "the rerun area's earlier decisions are gone");
  assert.equal(stored.proposal.facts.name.value, "Blue Water (revised)", "the person's edit of another area survives");
  assert.equal(stored.proposal.facts.name.status, "EDITED");
});

test("a stale expectedUpdatedAt refuses the edit; the current one saves", async () => {
  const w = world();
  const started = await w.start.handle(creator, { fileName: "d.txt", fileType: "text/plain", buffer: Buffer.from(DOCUMENT) });
  await w.flush();
  const id = started.value.proposalId;
  const stale = await w.edits.handle(creator, id, { area: "LOGFRAME", path: "logframe.0", op: "ACCEPT", expectedUpdatedAt: new Date(NOW.getTime() - 1000).toISOString() });
  assert.equal(stale.ok, false);
  assert.match(stale.error.message, /Someone saved a decision/);
  const current = await w.edits.handle(creator, id, { area: "LOGFRAME", path: "logframe.0", op: "ACCEPT" });
  assert.ok(current.ok);
});

test("a proposal is private: another person is told not found, a manager can open it but not edit it", async () => {
  const w = world();
  const started = await w.start.handle(creator, { fileName: "d.txt", fileType: "text/plain", buffer: Buffer.from(DOCUMENT) });
  await w.flush();
  const id = started.value.proposalId;
  const othersView = await w.gets.handle(other, id);
  assert.equal(othersView.ok, false);
  assert.equal(othersView.error.code, "NOT_FOUND");
  const managersView = await w.gets.handle(manager, id);
  assert.ok(managersView.ok);
  const managersEdit = await w.edits.handle(manager, id, { area: "LOGFRAME", path: "logframe.0", op: "ACCEPT" });
  assert.equal(managersEdit.ok, false);
  assert.match(managersEdit.error.message, /Only the person who started/);
  const list = await w.lists.handle(creator);
  assert.deepEqual(list.value.map((p) => p.id), [id]);
  const otherList = await w.lists.handle(other);
  assert.deepEqual(otherList.value, []);
});

test("start refuses without the permission, the opt-in, a provider, or over the daily cap", async () => {
  const off = world({ optedIn: false });
  const refused = await off.start.handle(creator, { fileName: "d", fileType: "text/plain", buffer: Buffer.from("x") });
  assert.equal(refused.ok, false);
  assert.match(refused.error.message, /switched off/);

  const noProvider = world({ providerAvailable: false });
  const unavailable = await noProvider.start.handle(creator, { fileName: "d", fileType: "text/plain", buffer: Buffer.from("x") });
  assert.equal(unavailable.ok, false);
  assert.match(unavailable.error.message, /AI service is not available/);

  const capped = world({ maxRunsPerDay: 2 });
  await capped.start.handle(creator, { fileName: "1", fileType: "text/plain", buffer: Buffer.from("a") });
  await capped.flush();
  await capped.start.handle(creator, { fileName: "2", fileType: "text/plain", buffer: Buffer.from("b") });
  await capped.flush();
  const third = await capped.start.handle(creator, { fileName: "3", fileType: "text/plain", buffer: Buffer.from("c") });
  assert.equal(third.ok, false);
  assert.equal(third.error.code, "RATE_LIMITED");

  const field = world();
  const denied = await field.start.handle(as("u3", "PROJECT_MANAGER"), { fileName: "d", fileType: "text/plain", buffer: Buffer.from("x") });
  assert.equal(denied.ok, false);
  const empty = await field.start.handle(creator, { fileName: "d", fileType: "text/plain", buffer: Buffer.from("") });
  assert.equal(empty.ok, false);
});

test("an unreadable document fails the whole proposal with a plain reason and deletes nothing silently", async () => {
  const w = world({ unreadable: true });
  const started = await w.start.handle(creator, { fileName: "scan.pdf", fileType: "application/pdf", buffer: Buffer.from("%PDF-") });
  await w.flush();
  const stored = w.proposalsById.get(started.value.proposalId);
  assert.equal(stored.status, "FAILED");
  const failedRun = [...w.runRows.values()].find((r) => r.status === "FAILED");
  assert.match(failedRun.detail.reason, /No readable text/);
  assert.ok(w.events.some((e) => e.eventType === "setup.extraction.failed"));
  const gone = await w.gets.handle(creator, started.value.proposalId);
  assert.ok(gone.ok, "the failed proposal stays visible so the person knows what happened");
});

test("the organisation's opt-in is set and audited by the settings handler", async () => {
  const w = world({ optedIn: false });
  const set = await w.settings.handle(manager, { enabled: true });
  assert.ok(set.ok);
  assert.equal(w.org.setupAssistEnabled, true);
  assert.ok(w.events.some((e) => e.eventType === "organization.setup_assist_updated"));
  const denied = await w.settings.handle(other, { enabled: false });
  assert.equal(denied.ok, false);
});

test("after a rate limit only areas the document answers without the AI still run", async () => {
  let asked = [];
  const limited = (area) => ({ area, extract: async () => { asked.push(area); return { ok: false, error: Object.assign(new Error("busy (error 429)"), { name: "DomainError", code: "RATE_LIMITED" }) }; } });
  const sheet = { area: "LOGFRAME", canReadWithoutModel: () => true, extract: async () => { asked.push("LOGFRAME"); return ok({ fields: { logframe: [P({ level: "GOAL", code: "GOAL-1", title: "Clean water", description: null, parentCode: null }, "GOAL-1: Clean water for all.")] }, promptVersion: "sheet-reader-v1" }); } };
  const needsModel = { area: "INDICATORS", canReadWithoutModel: () => false, extract: async () => { asked.push("INDICATORS"); return ok({ fields: { indicators: [] } }); } };
  const w = world({ extractors: [limited("FACTS"), sheet, needsModel] });
  const started = await w.start.handle(creator, { fileName: "p.csv", fileType: "text/csv", buffer: Buffer.from(DOCUMENT) });
  await w.flush();
  assert.deepEqual(asked, ["FACTS", "LOGFRAME"], "the sheet area ran; the area that needs the model did not ask again");
  const stored = w.proposalsById.get(started.value.proposalId);
  assert.equal(stored.status, "READY");
  assert.equal(stored.proposal.logframe.length, 1);
});

test("a rate-limited AI service stops the run after the first refusal instead of asking for every other area", async () => {
  let calls = 0;
  const limited = (area) => ({ area, extract: async () => { calls += 1; return { ok: false, error: Object.assign(new Error("The AI service is busy (error 429)."), { name: "DomainError", code: "RATE_LIMITED" }) }; } });
  const w = world({ extractors: [limited("FACTS"), limited("LOGFRAME")] });
  const started = await w.start.handle(creator, { fileName: "p.docx", fileType: "application/vnd.octet", buffer: Buffer.from(DOCUMENT) });
  await w.flush();
  assert.equal(calls, 1, "only the first area asked");
  const stored = w.proposalsById.get(started.value.proposalId);
  assert.equal(stored.status, "FAILED");
  const failed = [...w.runRows.values()].filter((r) => r.status === "FAILED");
  assert.match(failed[0].detail.reason, /busy .*429/);
});

test("without a connected Google Drive nothing is stored anywhere and the person is told why", async () => {
  const w = world({ driveConnected: false });
  const refused = await w.start.handle(creator, { fileName: "d.txt", fileType: "text/plain", buffer: Buffer.from(DOCUMENT) });
  assert.equal(refused.ok, false);
  assert.match(refused.error.message, /Google Drive/);
  assert.equal(w.stagedDocs.length, 0);
  assert.equal(w.proposalsById.size, 0);
});

test("a Drive failure leaves no half-created proposal", async () => {
  const w = world({ driveFails: true });
  const failed = await w.start.handle(creator, { fileName: "d.txt", fileType: "text/plain", buffer: Buffer.from(DOCUMENT) });
  assert.equal(failed.ok, false);
  assert.equal(w.proposalsById.size, 0);
  assert.equal(w.tasks.length, 0, "no reading was scheduled");
});

test("discarding a proposal that created a project never deletes the document now in the project's folder", async () => {
  const w = world();
  const started = await w.start.handle(creator, { fileName: "d.txt", fileType: "text/plain", buffer: Buffer.from(DOCUMENT) });
  await w.flush();
  const row = w.proposalsById.get(started.value.proposalId);
  row.appliedProjectId = "proj-1";
  row.status = "APPLIED";
  assert.ok((await w.discards.handle(creator, started.value.proposalId)).ok);
  assert.deepEqual(w.removedStaged, []);
  assert.deepEqual(w.removedKeys, []);
});

test("a proposal made before documents moved to Drive is cleaned from server storage", async () => {
  const w = world();
  const started = await w.start.handle(creator, { fileName: "d.txt", fileType: "text/plain", buffer: Buffer.from(DOCUMENT) });
  await w.flush();
  w.proposalsById.get(started.value.proposalId).sourceStorageKey = "project-setup/tenant-a/old";
  assert.ok((await w.discards.handle(creator, started.value.proposalId)).ok);
  assert.deepEqual(w.removedKeys, ["project-setup/tenant-a/old"]);
  assert.deepEqual(w.removedStaged, []);
});

function timedArea(log, tracker, area, fields, usage) {
  return {
    area,
    async extract() {
      log.push(`start ${area}`);
      tracker.inFlight += 1;
      tracker.max = Math.max(tracker.max, tracker.inFlight);
      await new Promise((resolve) => setTimeout(resolve, 25));
      tracker.inFlight -= 1;
      log.push(`end ${area}`);
      return ok({ fields, ...(usage ? { usage } : {}) });
    },
  };
}
const threeAreas = () => {
  const log = [];
  const tracker = { inFlight: 0, max: 0 };
  const extractors = [
    timedArea(log, tracker, "FACTS", { facts: factsWith({ name: P("Blue Water", "The project is named Blue Water.") }) }, { calls: 1, inputTokens: 1000, outputTokens: 200 }),
    timedArea(log, tracker, "RISKS", { risks: [P({ kind: "RISK", title: "flooding", seriousness: "high", mitigation: null }, "A risk is flooding.")] }, { calls: 2, inputTokens: 500, outputTokens: 100 }),
    timedArea(log, tracker, "LOGFRAME", { logframe: [P({ level: "GOAL", code: "GOAL-1", title: "Clean water", description: null, parentCode: null }, "GOAL-1: Clean water for all.")] }, { calls: 1, inputTokens: 300, outputTokens: 50 }),
  ];
  return { log, tracker, extractors };
};

test("independent areas are read at the same time, and an area waits for the ones it depends on", async () => {
  const { log, tracker, extractors } = threeAreas();
  const w = world({ extractors });
  await w.start.handle(creator, { fileName: "p.txt", fileType: "text/plain", buffer: Buffer.from(DOCUMENT) });
  await w.flush();
  assert.ok(tracker.max >= 2, `facts and risks overlap, got at most ${tracker.max} at once`);
  assert.ok(log.indexOf("end FACTS") < log.indexOf("start LOGFRAME"), "the results framework starts only after the facts are read");
  assert.ok(log.indexOf("start RISKS") < log.indexOf("end FACTS"), "risks did not wait for the facts");
});

test("the number read at once is capped", async () => {
  const { tracker, extractors } = threeAreas();
  const w = world({ extractors, concurrency: 1 });
  await w.start.handle(creator, { fileName: "p.txt", fileType: "text/plain", buffer: Buffer.from(DOCUMENT) });
  await w.flush();
  assert.equal(tracker.max, 1);
});

test("areas that finish together do not overwrite each other's results, and the document's usage adds up", async () => {
  const { extractors } = threeAreas();
  const w = world({ extractors });
  const started = await w.start.handle(creator, { fileName: "p.txt", fileType: "text/plain", buffer: Buffer.from(DOCUMENT) });
  await w.flush();
  const stored = w.proposalsById.get(started.value.proposalId);
  assert.equal(stored.status, "READY");
  assert.equal(stored.proposal.facts.name.value, "Blue Water");
  assert.equal(stored.proposal.risks.length, 1);
  assert.equal(stored.proposal.logframe.length, 1);
  const whole = [...w.runRows.values()].find((r) => r.kind === "EXTRACT" && r.area === undefined);
  assert.deepEqual([whole.detail.calls, whole.detail.inputTokens, whole.detail.outputTokens], [4, 1800, 350]);
  const risksRun = [...w.runRows.values()].find((r) => r.area === "RISKS");
  assert.equal(risksRun.detail.inputTokens, 500, "each area's own usage is on its run");
});

test("a document's usage adds up every area and re-read, ignores the whole-document total, and prices only a known model", async () => {
  const { usageOf } = await import("../dist/index.js");
  const run = (area, detail, kind = "EXTRACT") => ({ id: Math.random().toString(), kind, area, status: "FINISHED", detail });
  const runs = [
    run(undefined, { calls: 99, inputTokens: 999999, outputTokens: 999999 }),
    run("FACTS", { calls: 1, inputTokens: 1_000_000, outputTokens: 0 }),
    run("RISKS", { calls: 2, inputTokens: 0, outputTokens: 2_000_000 }),
    run("RISKS", { calls: 1, inputTokens: 0, outputTokens: 0 }),
    run("PLAN", { checked: 3, dropped: 1 }),
    run("PLAN", { calls: 5, inputTokens: 7 }, "APPLY"),
  ];
  const priced = usageOf(runs, "glm-5.3-flash");
  assert.deepEqual([priced.calls, priced.inputTokens, priced.outputTokens], [4, 1_000_000, 2_000_000]);
  assert.equal(priced.costUsd, 0.15 + 1.0, "1M in at 0.15 and 2M out at 0.5 per million");
  const unpriced = usageOf(runs, "claude-haiku-5-5");
  assert.equal(unpriced.costUsd, null, "a model with no price on file is never given a made-up cost");
  assert.equal(usageOf([], "glm-5.3-flash").costUsd, null, "nothing used, nothing to price");
  assert.equal(usageOf(runs, undefined).costUsd, null);
});

const doc = (name, text = "x") => ({ fileName: name, fileType: "text/plain", buffer: Buffer.from(text) });

test("a setup can use several documents: each is saved to Drive and the proposal keeps one key for the set", async () => {
  const w = world();
  const started = await w.start.handle(creator, { documents: [doc("proposal.docx", DOCUMENT), doc("logframe.csv", "a"), doc("budget.xlsx", "b")] });
  assert.equal(started.ok, true, started.error?.message);
  assert.equal(started.value.sourceName, "proposal.docx (+2 more)");
  assert.deepEqual(w.stagedDocs.map((d) => d.name), ["proposal.docx", "logframe.csv", "budget.xlsx"]);
  const row = w.proposalsById.get(started.value.proposalId);
  assert.equal(row.sourceStorageKey, "drive:file-1,file-2,file-3");
  assert.equal(row.sourceLength, DOCUMENT.length + 2);
  // Discarding removes every file of the set that is still in staging.
  await w.flush();
  assert.ok((await w.discards.handle(creator, started.value.proposalId)).ok);
  assert.deepEqual(w.removedStaged, ["file-1", "file-2", "file-3"]);
});

test("too many documents, or an empty one, are refused before anything is saved", async () => {
  const w = world();
  const six = Array.from({ length: 6 }, (_, i) => doc(`d${i}.txt`));
  const tooMany = await w.start.handle(creator, { documents: six });
  assert.equal(tooMany.ok, false);
  assert.match(tooMany.error.message, /at most 5/i);
  const empty = await w.start.handle(creator, { documents: [doc("a.txt"), doc("b.txt", "")] });
  assert.equal(empty.ok, false);
  assert.equal((await w.start.handle(creator, { documents: [] })).ok, false);
  assert.equal(w.stagedDocs.length, 0);
  assert.equal(w.proposalsById.size, 0);
});

test("if the second document cannot be saved, the first is taken back out and no proposal is made", async () => {
  const w = world();
  let calls = 0;
  const original = w.documents.stage;
  w.documents.stage = async (t, d) => (++calls === 2 ? { ok: false, error: Object.assign(new Error("drive down"), { name: "DomainError" }) } : original(t, d));
  const started = await w.start.handle(creator, { documents: [doc("a.txt"), doc("b.txt"), doc("c.txt")] });
  assert.equal(started.ok, false);
  assert.deepEqual(w.removedStaged, ["file-1"], "the file already saved is removed again");
  assert.equal(w.proposalsById.size, 0);
  assert.equal(w.tasks.length, 0);
});

test("a background re-read answers at once, is not started twice, and a part stuck reading is shown as failed", async () => {
  const w = world({ logframeFails: true });
  const started = await w.start.handle(creator, { fileName: "d.txt", fileType: "text/plain", buffer: Buffer.from(DOCUMENT) });
  await w.flush();
  const id = started.value.proposalId;
  const reader = { read: async () => ok([{ documentId: "source", index: 0, text: DOCUMENT }]) };
  const later = [];
  const reruns = new RerunSetupAreaHandler(w.proposals, w.runs, reader, [factsExtractor(), logframeExtractor(false)], w.audit, w.clock, { generate: () => `rr-${Math.random().toString(36).slice(2, 8)}` }, undefined, undefined, (task) => { later.push(task); });
  const first = await reruns.handle(creator, id, "LOGFRAME");
  assert.ok(first.ok, "answers before the model has been asked");
  assert.equal(w.proposalsById.get(id).proposal.logframe.length, 0, "nothing is read yet");
  const second = await reruns.handle(creator, id, "LOGFRAME");
  assert.equal(second.ok, false, "the same part is not read twice at once");
  await later.shift()();
  assert.equal(w.proposalsById.get(id).proposal.logframe.length, 1);

  // A run left RUNNING long ago (a restart, a lost request) is reported as failed so the screen stops waiting.
  const stuck = { id: "stuck", tenantId: w.proposalsById.get(id).tenantId, proposalId: id, kind: "EXTRACT", area: "PLAN", status: "RUNNING", detail: {}, startedAt: new Date(w.clock.now().getTime() - 7 * 60_000) };
  await w.runs.start(stuck);
  const view = await w.gets.handle(creator, id);
  assert.equal(view.value.runs.find((r) => r.id === "stuck").status, "FAILED");
  assert.match(view.value.runs.find((r) => r.id === "stuck").detail.reason, /Read it again/);
});
