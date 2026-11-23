import test from "node:test";
import assert from "node:assert/strict";
import { TenantId } from "@donordesk/domain";
import {
  SaveCollectionFormHandler, SetCollectionFormStatusHandler, SubmitCollectionRecordHandler, CreateCollectionLinkHandler, PublicCollectionFormHandler, PublicSubmitCollectionRecordHandler,
  AssessmentRecorder, SaveCollectionDraftHandler, GetCollectionDraftHandler, DiscardCollectionDraftHandler, ExpireCollectionDraftsHandler, ListMyCollectionDraftsHandler,
  AssignFacilitiesHandler, MoveAssignmentHandler, ListFacilityAssignmentsHandler, ListMyAssignmentsHandler, GetAssessmentPrefillHandler, CompareVisitsHandler, GetRecordScoreHandler,
  CreateCorrectiveActionHandler, ApplyFormKitHandler, ListFormKitsHandler, ProposeFormFromFileHandler, ExportAssessmentHandler, GetOfflinePackHandler,
} from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ok = (value) => ({ ok: true, value });
const user = (userId, role) => ({ tenant: { tenantId, userId, role }, requestId: "r" });
const manager = user("mgr", "PROJECT_MANAGER");
const officer = user("off", "FIELD_OFFICER");
const viewer = user("v", "VIEWER");
let n = 0;
const ids = { generate: () => `id-${++n}-xxxxxxxx` };
const audit = { events: [], record: async function (e) { this.events.push(e.eventType); } };
let now = new Date("2026-11-20T10:00:00Z");
const clock = { now: () => now };
const sent = [];
const notifier = { send: async (m) => { sent.push(m); } };

const rules = { minAnsweredShare: 0.5, bands: [{ min: 70, label: "Ready", tone: "GOOD" }, { min: 0, label: "Not ready", tone: "POOR" }], sections: [{ key: "s", title: "Services", items: [{ path: "checks.*.ok", label: "Check", points: { yes: 1, no: 0 } }] }] };
const formInput = {
  projectId: "p1", name: "Facility check", subject: "FACILITY", score: rules, mappings: [],
  fields: [
    { key: "year", label: "Year established", type: "NUMBER", carryForward: true },
    { key: "checks", label: "Checks", type: "GRID", rows: [{ key: "water", label: "Water" }, { key: "power", label: "Power" }], columns: [{ key: "ok", label: "Working", type: "YES_NO" }] },
    { key: "gps", label: "GPS", type: "GPS" },
  ],
};

function world() {
  const forms = new Map(), records = new Map(), drafts = new Map(), assignments = new Map();
  const places = [
    { id: "f1", name: "BHU One", facility: true, latitude: 34.0, longitude: 71.5, adminLevel: 4, kind: "POINT", parentId: "d1" },
    { id: "f2", name: "BHU Two", facility: true, adminLevel: 4, kind: "POINT", parentId: "d1" },
    { id: "v1", name: "Village", facility: false, adminLevel: 4, kind: "POINT", parentId: "d1" },
    { id: "d1", name: "Upper Dir", adminLevel: 2, kind: "AREA" },
    { id: "gone", name: "Closed", facility: true, adminLevel: 4, kind: "POINT", archivedAt: new Date() },
  ].map((p) => ({ tenantId, createdById: "x", aliases: [], ...p }));
  const w = {
    stores: { forms, records, drafts, assignments },
    forms: { create: async (f) => (forms.set(f.id, f), ok()), update: async (f) => (forms.set(f.id, f), ok()), findById: async (id) => ok(forms.get(id) ?? null), listByProject: async () => ok([...forms.values()]), deleteDraft: async () => ok(false) },
    records: {
      createOnce: async (r) => (records.has(r.id) ? ok({ record: records.get(r.id), created: false }) : (records.set(r.id, { ...r, createdAt: r.createdAt ?? new Date() }), ok({ record: r, created: true }))),
      update: async (r) => (records.set(r.id, r), ok()), findById: async (id) => ok(records.get(id) ?? null), listByForm: async () => ok([...records.values()]),
      listByPlace: async (formId, placeId) => ok([...records.values()].filter((r) => r.placeId === placeId)), countByStatus: async () => ok({ PENDING: 0, ACCEPTED: 0, REJECTED: 0 }),
    },
    drafts: {
      find: async (formId, userId, key) => ok(drafts.get(`${formId}|${userId}|${key}`) ?? null), save: async (d) => (drafts.set(`${d.formId}|${d.userId}|${d.placeKey}`, d), ok(d)),
      delete: async (formId, userId, key) => (drafts.delete(`${formId}|${userId}|${key}`), ok()), listForUser: async (userId) => ok([...drafts.values()].filter((d) => d.userId === userId)),
      listOlderThan: async (before) => ok([...drafts.values()].filter((d) => d.updatedAt < before)), deleteIds: async (idsToGo) => { for (const [k, d] of drafts) if (idsToGo.includes(d.id)) drafts.delete(k); return ok(); },
    },
    assignments: {
      upsertMany: async (items) => { for (const a of items) assignments.set(`${a.formId}|${a.placeId}`, { ...(assignments.get(`${a.formId}|${a.placeId}`) ?? {}), ...a }); return ok(); },
      update: async (a) => (assignments.set(`${a.formId}|${a.placeId}`, a), ok()), findById: async (id) => ok([...assignments.values()].find((a) => a.id === id) ?? null),
      findByFormAndPlace: async (f, p) => ok(assignments.get(`${f}|${p}`) ?? null), listByForm: async (f) => ok([...assignments.values()].filter((a) => a.formId === f)),
      listForAssignee: async (who, t, st) => ok([...assignments.values()].filter((a) => a.assigneeId === who && (!st || st.includes(a.status)))),
    },
    places: { list: async () => ok(places), findById: async (id) => ok(places.find((p) => p.id === id) ?? null) },
    indicators: { findByProject: async () => ok([]) },
    roster: { activeMembers: async () => ok([{ userId: "off", role: "FIELD_OFFICER" }, { userId: "mgr", role: "PROJECT_MANAGER" }, { userId: "v", role: "VIEWER" }]) },
  };
  w.recorder = new AssessmentRecorder(w.places, w.records, w.drafts, w.assignments, audit);
  w.save = new SaveCollectionFormHandler(ids, w.forms, w.indicators, audit, clock);
  w.status = new SetCollectionFormStatusHandler(w.forms, audit, clock);
  w.submit = new SubmitCollectionRecordHandler(ids, w.forms, w.records, audit, clock, undefined, w.recorder);
  return w;
}

async function published(w, input = formInput) {
  const saved = await w.save.handle(manager, input);
  assert.ok(saved.ok, JSON.stringify(saved.error));
  await w.status.handle(manager, saved.value.id, "PUBLISHED");
  return saved.value.id;
}
const good = { year: 1990, checks: { water: { ok: true }, power: { ok: false } }, gps: { lat: 34.001, lon: 71.5 } };

test("a form keeps its subject, score rules and constraints; a facility form is not offered on a public link", async () => {
  const w = world();
  const formId = await published(w);
  const stored = w.stores.forms.get(formId);
  assert.equal(stored.definition.subject, "FACILITY");
  assert.equal(stored.definition.score.sections.length, 1);
  const link = new CreateCollectionLinkHandler(ids, w.forms, { create: async () => ok() }, audit, clock);
  assert.match((await link.handle(manager, formId, { label: "x", expiresInDays: 5 })).error.message, /filled in by your team/);
  assert.equal((await new PublicCollectionFormHandler(w.forms).handle(tenantId, formId)).ok, false);
  assert.equal((await new PublicSubmitCollectionRecordHandler(ids, w.forms, w.records, audit, clock).handle(tenantId, formId, "l1", { answers: good })).ok, false);
  const bad = await w.save.handle(manager, { ...formInput, score: { ...rules, sections: [{ key: "s", title: "S", items: [{ path: "nope.x", points: { a: 1, b: 0 } }] }] } });
  assert.match(bad.error.message, /not in the form/);
});

test("submitting: the facility is required and must be a live facility; the visit is numbered, scored and flagged; the draft goes and the assignment is done", async () => {
  const w = world();
  const formId = await published(w);
  assert.match((await w.submit.handle(officer, formId, { answers: good })).error.message, /Choose the facility/);
  assert.match((await w.submit.handle(officer, formId, { answers: good, placeId: "v1" })).error.message, /not marked as a facility/);
  assert.match((await w.submit.handle(officer, formId, { answers: good, placeId: "gone" })).error.message, /not in the list/);
  assert.match((await w.submit.handle(officer, formId, { answers: { ...good, checks: { water: { ok: "maybe" } } }, placeId: "f1" })).error.message, /Yes or No/);

  await new AssignFacilitiesHandler(ids, w.forms, w.assignments, w.places, w.roster, notifier, audit, clock).handle(manager, formId, { assignments: [{ placeId: "f1", assigneeId: "off", dueOn: "2026-12-01" }] });
  await new SaveCollectionDraftHandler(ids, w.forms, w.drafts, clock).handle(officer, formId, { placeId: "f1", answers: { year: 1 } });
  assert.equal(w.stores.drafts.size, 1);

  const first = await w.submit.handle(officer, formId, { id: "visit-one-0001", answers: good, placeId: "f1", startedAt: "2026-11-20T09:59:58.000Z" });
  assert.ok(first.ok, JSON.stringify(first.error));
  const r1 = w.stores.records.get("visit-one-0001");
  assert.equal(r1.placeId, "f1");
  assert.equal(r1.visitNo, 1);
  assert.equal(r1.answersVersion, 2);
  assert.equal(r1.score.overall, 50);
  assert.equal(r1.score.band, "Not ready");
  assert.deepEqual(r1.flags.map((f) => f.code), ["TOO_FAST"]);
  assert.equal(w.stores.drafts.size, 0, "the draft is removed once the record exists");
  assert.equal(w.stores.assignments.get(`${formId}|f1`).status, "DONE");
  assert.equal(w.stores.assignments.get(`${formId}|f1`).recordId, "visit-one-0001");

  const second = await w.submit.handle(officer, formId, { id: "visit-two-0002", answers: good, placeId: "f1" });
  assert.ok(second.ok);
  assert.equal(w.stores.records.get("visit-two-0002").visitNo, 2);
  assert.deepEqual(w.stores.records.get("visit-two-0002").flags.map((f) => f.code), ["DUPLICATE_VISIT"]);
  const again = await w.submit.handle(officer, formId, { id: "visit-two-0002", answers: good, placeId: "f1" });
  assert.equal(again.value.duplicate, true);
  const far = await w.submit.handle(officer, formId, { id: "visit-far-0003", answers: { ...good, gps: { lat: 35, lon: 71.5 } }, placeId: "f1" });
  assert.ok(w.stores.records.get("visit-far-0003").flags.some((f) => f.code === "FAR_FROM_FACILITY"));
  assert.ok(far.ok);
});

test("drafts: one per person, form and facility; a stale save is a conflict; nobody reads another's; old ones expire", async () => {
  const w = world();
  const formId = await published(w);
  const save = new SaveCollectionDraftHandler(ids, w.forms, w.drafts, clock);
  const get = new GetCollectionDraftHandler(w.drafts);
  const first = await save.handle(officer, formId, { placeId: "f1", answers: { year: 1 } });
  assert.ok(first.ok);
  now = new Date("2026-11-20T10:05:00Z");
  assert.match((await save.handle(officer, formId, { placeId: "f1", answers: { year: 2 } })).error.message, /saved somewhere else/);
  const second = await save.handle(officer, formId, { placeId: "f1", answers: { year: 2 }, expectedUpdatedAt: first.value.updatedAt });
  assert.ok(second.ok);
  assert.equal((await get.handle(officer, formId, "f1")).value.answers.year, 2);
  assert.equal((await get.handle(manager, formId, "f1")).value, null, "another person has no draft for it");
  assert.equal((await save.handle(viewer, formId, { answers: {} })).ok, false);
  assert.match((await save.handle(officer, formId, { placeId: "f2", answers: { blob: "x".repeat(2_100_000) } })).error.message, /too large/);
  const mine = await new ListMyCollectionDraftsHandler(w.drafts, clock).handle(officer);
  assert.equal(mine.value.length, 1);
  assert.ok(mine.value[0].expiresOn > "2027-01-01");
  now = new Date("2027-02-01T10:00:00Z");
  const swept = await new ExpireCollectionDraftsHandler(w.drafts, audit, clock).handle(tenantId);
  assert.equal(swept.value.removed, 1);
  assert.equal(w.stores.drafts.size, 0);
  now = new Date("2026-11-20T10:00:00Z");
  assert.ok((await new DiscardCollectionDraftHandler(w.drafts).handle(officer, formId, "f1")).ok);
});

test("assigning: only a designer; the person must be a member who can submit; a facility form only; done ones are left; the person is told", async () => {
  const w = world();
  const formId = await published(w);
  const assign = new AssignFacilitiesHandler(ids, w.forms, w.assignments, w.places, w.roster, notifier, audit, clock);
  assert.equal((await assign.handle(officer, formId, { assignments: [{ placeId: "f1", assigneeId: "off" }] })).ok, false);
  assert.match((await assign.handle(manager, formId, { assignments: [{ placeId: "v1", assigneeId: "off" }] })).error.message, /not marked as a facility/);
  assert.match((await assign.handle(manager, formId, { assignments: [{ placeId: "f1", assigneeId: "stranger" }] })).error.message, /active member/);
  assert.match((await assign.handle(manager, formId, { assignments: [{ placeId: "f1", assigneeId: "v" }] })).error.message, /cannot submit records/);
  sent.length = 0;
  const done = await assign.handle(manager, formId, { assignments: [{ placeId: "f1", assigneeId: "off", dueOn: "2026-12-01" }, { placeId: "f2", assigneeId: "off" }] });
  assert.deepEqual(done.value, { assigned: 2, skippedDone: 0 });
  assert.equal(sent.length, 1);
  assert.match(sent[0].message, /2 facilities/);
  const mine = await new ListMyAssignmentsHandler(w.assignments, w.forms, w.places).handle(officer);
  assert.deepEqual(mine.value.map((a) => a.placeName), ["BHU One", "BHU Two"], "soonest due first");

  const move = new MoveAssignmentHandler(w.assignments, audit, clock);
  const id = w.stores.assignments.get(`${formId}|f2`).id;
  assert.match((await move.handle(officer, id, { status: "NOT_VISITED" })).error.message, /Say why/);
  assert.ok((await move.handle(officer, id, { status: "NOT_VISITED", reason: "road closed" })).ok);
  assert.match((await move.handle(officer, id, { status: "DONE" })).error.message, /submitted/);
  assert.equal((await move.handle(viewer, id, { status: "TO_DO" })).ok, false);

  w.stores.assignments.get(`${formId}|f1`).status = "DONE";
  assert.equal((await assign.handle(manager, formId, { assignments: [{ placeId: "f1", assigneeId: "off" }] })).value.skippedDone, 1);
  const list = await new ListFacilityAssignmentsHandler(w.forms, w.assignments, w.places).handle(manager, formId);
  assert.deepEqual(list.value.coverage.map((c) => [c.area, c.assigned, c.done, c.notVisited]), [["Upper Dir", 2, 1, 1]]);
  assert.match(list.value.assignments[0].path, /Upper Dir/);
});

test("prefill carries only marked facts from the last accepted visit; comparison and score read the stored answers", async () => {
  const w = world();
  const formId = await published(w);
  await w.submit.handle(officer, formId, { id: "visit-one-0001", answers: good, placeId: "f1" });
  const pre = new GetAssessmentPrefillHandler(w.forms, w.records);
  assert.deepEqual((await pre.handle(officer, formId, "f1")).value.carried, [], "a pending record is not a source");
  w.stores.records.get("visit-one-0001").status = "ACCEPTED";
  const p = await pre.handle(officer, formId, "f1");
  assert.deepEqual(p.value, { values: { year: 1990 }, carried: ["year"], fromVisit: 1, fromDay: "2026-11-20" });

  now = new Date("2026-12-05T10:00:00Z");
  await w.submit.handle(officer, formId, { id: "visit-two-0002", answers: { ...good, checks: { water: { ok: true }, power: { ok: true } } }, placeId: "f1" });
  const cmp = await new CompareVisitsHandler(w.forms, w.records).handle(manager, "visit-two-0002");
  assert.equal(cmp.value.counts.IMPROVED, 1);
  assert.equal(cmp.value.overall.delta, 50);
  assert.equal(cmp.value.beforeVisit, 1);
  const score = await new GetRecordScoreHandler(w.forms, w.records).handle(manager, "visit-two-0002");
  assert.equal(score.value.overall, 100);
  assert.match((await new CompareVisitsHandler(w.forms, w.records).handle(viewer, "visit-two-0002")).error.message, /cannot see/);
  now = new Date("2026-11-20T10:00:00Z");
});

test("a corrective action goes through the ordinary request and problem handlers, naming the facility and the item", async () => {
  const w = world();
  const formId = await published(w);
  await w.submit.handle(officer, formId, { id: "visit-one-0001", answers: good, placeId: "f1" });
  const calls = [];
  const h = new CreateCorrectiveActionHandler(w.forms, w.records, w.places, { handle: async (c, p, i) => (calls.push(["task", p, i]), ok({ id: "t1" })) }, { handle: async (c, p, i) => (calls.push(["risk", p, i]), ok({ id: "r1" })) });
  assert.equal((await h.handle(officer, "visit-one-0001", { path: "checks.power.ok", label: "Power working", kind: "RISK" })).ok, false);
  const t = await h.handle(manager, "visit-one-0001", { path: "checks.power.ok", label: "Power working", kind: "TASK", assigneeId: "off", dueOn: "2026-12-10" });
  assert.deepEqual(t.value, { kind: "TASK", id: "t1" });
  assert.equal(calls[0][2].title, "BHU One: Power working");
  assert.equal(calls[0][2].dueDate, "2026-12-10");
  assert.match((await h.handle(manager, "visit-one-0001", { path: "x", label: "X", kind: "TASK" })).error.message, /who is asked/);
  const r = await h.handle(manager, "visit-one-0001", { path: "checks.power.ok", label: "Power working", kind: "RISK" });
  assert.equal(r.value.kind, "RISK");
  assert.equal(calls[1][2].kind, "PROBLEM");
});

test("kits: listed, applied as a DRAFT through the ordinary save, with notes and suggested indicators; a viewer cannot", async () => {
  const w = world();
  const kits = new ListFormKitsHandler().handle();
  assert.equal(kits[0].id, "health-facility-assessment");
  assert.equal(kits[0].unreviewed, true);
  const apply = new ApplyFormKitHandler({ handle: (c, i, f) => w.save.handle(c, i, f) });
  assert.equal((await apply.handle(viewer, { kitId: kits[0].id, projectId: "p1" })).ok, false);
  assert.match((await apply.handle(manager, { kitId: "nope", projectId: "p1" })).error.message, /not found|Kit/i);
  const done = await apply.handle(manager, { kitId: kits[0].id, projectId: "p1" });
  assert.ok(done.ok, JSON.stringify(done.error));
  assert.equal(w.stores.forms.get(done.value.id).status, "DRAFT");
  assert.equal(w.stores.forms.get(done.value.id).definition.subject, "FACILITY");
  assert.ok(done.value.notes.length > 0 && done.value.suggestedIndicators.length > 0);
});

test("reading a tool from a file proposes a form, saves nothing, and refuses an unreadable file in words", async () => {
  const parser = { parse: async ({ buffer }) => ({ text: buffer.toString() }) };
  const h = new ProposeFormFromFileHandler(parser);
  const tool = "SECTION 03: ADMINISTRATION\nOffice for MS | Yes | No\nFinance office | Yes | No\nStaff | Number: ________";
  const r = await h.handle(manager, { name: "tool.docx", bytes: Buffer.from(tool) });
  assert.ok(r.ok);
  assert.ok(r.value.fields.some((f) => f.field.type === "YES_NO") && r.value.problems.length === 0);
  assert.match((await h.handle(manager, { name: "scan.pdf", bytes: Buffer.from("  ") })).error.message, /No words could be read|empty/);
  assert.match((await h.handle(manager, { name: "x.txt", bytes: Buffer.from("just words") })).error.message, /No questions were found/);
  assert.equal((await h.handle(viewer, { name: "t.docx", bytes: Buffer.from(tool) })).ok, false);
});

test("export: the file comes from the stored answers; a right-to-left script cannot be a PDF but can be Word or Excel", async () => {
  const w = world();
  const withLabels = { ...formInput, fields: formInput.fields.map((f) => (f.key === "year" ? { ...f, labels: { ur: "قائم ہونے کا سال" } } : f)) };
  const formId = await published(w, withLabels);
  await w.submit.handle(officer, formId, { id: "visit-one-0001", answers: good, placeId: "f1" });
  const seen = [];
  const files = { pdf: async (d) => (seen.push(["pdf", d]), Buffer.from("pdf")), docx: async (d, o) => (seen.push(["docx", d, o]), Buffer.from("docx")), xlsx: async (d) => (seen.push(["xlsx", d]), Buffer.from("xlsx")) };
  const exp = new ExportAssessmentHandler(w.forms, w.records, w.places, files);
  const pdf = await exp.handle(manager, "visit-one-0001", "PDF");
  assert.equal(pdf.value.contentType, "application/pdf");
  assert.match(pdf.value.fileName, /Facility-check---BHU-One\.pdf|Facility-check-BHU-One\.pdf/);
  assert.equal(seen[0][1].facility, "BHU One");
  assert.equal(seen[0][1].score.overall, 50);
  assert.match((await exp.handle(manager, "visit-one-0001", "PDF", "ur")).error.message, /Word or Excel/);
  assert.ok((await exp.handle(manager, "visit-one-0001", "DOCX", "ur")).ok);
  assert.equal(seen.at(-1)[2].rtl, true);
  assert.equal((await exp.handle(viewer, "visit-one-0001", "XLSX")).ok, false);
});

test("pack v4: the person's own facilities, facility flags and carried facts for those facilities only", async () => {
  const w = world();
  const formId = await published(w);
  await w.submit.handle(officer, formId, { id: "visit-one-0001", answers: good, placeId: "f1" });
  w.stores.records.get("visit-one-0001").status = "ACCEPTED";
  const assign = new AssignFacilitiesHandler(ids, w.forms, w.assignments, w.places, w.roster, notifier, audit, clock);
  w.stores.assignments.clear();
  await assign.handle(manager, formId, { assignments: [{ placeId: "f1", assigneeId: "off" }, { placeId: "f2", assigneeId: "mgr" }] });
  const pack = new GetOfflinePackHandler(w.forms, w.places, clock, { assessments: { assignments: w.assignments, records: w.records } });
  const dto = (await pack.handle(officer, "p1")).value;
  assert.deepEqual(dto.assignments.map((a) => a.placeId), ["f1"]);
  assert.deepEqual(dto.prefill, [{ formId, placeId: "f1", values: { year: 1990 } }]);
  assert.equal(dto.forms[0].subject, "FACILITY");
  assert.ok(dto.forms[0].score);
  assert.equal(dto.places.find((p) => p.id === "f1").facility, true);
  assert.equal(dto.places.find((p) => p.id === "v1").facility, undefined);
  const without = (await new GetOfflinePackHandler(w.forms, w.places, clock).handle(officer, "p1")).value;
  assert.equal(without.assignments, undefined, "built without the readers it answers as before");
});
