import assert from "node:assert/strict";
import test from "node:test";
import { validateSubmission, type FormDefinition, type FormField } from "@donordesk/domain/contexts/collection/index.js";
import { askable, formLevelProblems, problemsByPath, sectionProgress, sectionsOf, withAnswer, withRows } from "../../src/features/collection/domain/filler-state.ts";
import { offerFacilities, placesForSubject } from "../../src/features/collection/domain/assessment-flow.ts";
import { blankDraft, fieldOf, freshKey, newChild, newColumn, toDraft } from "../../src/features/collection/domain/designer-model.ts";
import { replaceToken, createCollectionRecordSender, collectionRecordEntry } from "../../src/features/offline/domain/collection-outbox.ts";
import { createMemoryDraftStore } from "../../src/features/collection/adapters/memory-draft-store.ts";

const form: FormDefinition = { fields: [
  { key: "intro", label: "Intro", type: "NOTE" },
  { key: "sec_a", label: "Section A", type: "SECTION" },
  { key: "has_lab", label: "Has a lab", type: "YES_NO", required: true },
  { key: "sec_lab", label: "Lab", type: "SECTION", relevantWhen: { field: "has_lab", op: "EQ", value: "yes" } },
  { key: "benches", label: "Benches", type: "NUMBER", min: 0 },
  { key: "sec_b", label: "Section B", type: "SECTION" },
  { key: "beds", label: "Beds", type: "NUMBER" }, { key: "area", label: "Area", type: "CALCULATED", formula: "beds * 2" },
] };

test("a long form splits at each heading, a section that is not asked disappears with its questions, and progress counts answers", () => {
  const no = sectionsOf(form, { has_lab: "no" }, "General");
  assert.deepEqual(no.map((s) => s.title), ["General", "Section A", "Section B"]);
  assert.deepEqual(no[0]!.fields.map((f) => f.key), ["intro"]);
  const yes = sectionsOf(form, { has_lab: "yes" }, "General");
  assert.deepEqual(yes.map((s) => s.title), ["General", "Section A", "Lab", "Section B"]);
  const answers = { has_lab: "yes", benches: 3 };
  const checked = validateSubmission(form, answers);
  const byPath = problemsByPath(checked.problems, (p) => p.message);
  const progress = yes.map((s) => sectionProgress(s, answers, byPath));
  assert.deepEqual(progress.map((p) => [p.asked, p.answered]), [[0, 0], [1, 1], [1, 1], [1, 0]]);
  assert.equal(askable(form.fields.find((f) => f.key === "area")!), false, "a calculated figure is not asked");
  assert.equal(askable(form.fields.find((f) => f.key === "intro")!), false);
});

test("problems find their question by path, and rules across answers are form-level", () => {
  const f: FormDefinition = { fields: [
    { key: "rows", label: "Rows", type: "REPEAT", fields: [{ key: "name", label: "Name", type: "TEXT", required: true }, { key: "n", label: "Count", type: "NUMBER" }] },
    { key: "a", label: "A", type: "NUMBER" }, { key: "b", label: "B", type: "NUMBER" },
  ], constraints: [{ kind: "LTE", fields: ["a", "b"] }] };
  const r = validateSubmission(f, { rows: [{ n: 3 }], a: 1, b: 2 });
  assert.ok(problemsByPath(r.problems, (p) => p.message).has("rows[0].name"));
  const c = validateSubmission(f, { rows: [{ name: "x" }], a: 5, b: 2 });
  assert.equal(formLevelProblems(c.problems).length, 1);
  assert.deepEqual(withAnswer({ a: 1 }, "b", 2), { a: 1, b: 2 });
  assert.deepEqual(withAnswer({ a: 1 }, "a", undefined), {});
  assert.deepEqual(withRows([{ a: 1 }, { a: 2 }], 1, { a: 9 }), [{ a: 1 }, { a: 9 }]);
});

test("facilities: the ones given to the person first by due day, then the rest by name; typing narrows by name or place; a facility form offers only facilities", () => {
  const places = [
    { id: "1", name: "Zeta BHU", path: "Upper Dir", facility: true }, { id: "2", name: "Alpha BHU", path: "Mardan", facility: true },
    { id: "3", name: "Village", path: "Mardan", facility: false }, { id: "4", name: "Beta RHC", path: "Upper Dir", facility: true },
  ];
  const facilities = placesForSubject(places, "FACILITY");
  assert.deepEqual(facilities.map((p) => p.id), ["1", "2", "4"]);
  assert.equal(placesForSubject(places, "PLACE").length, 4);
  const offered = offerFacilities(facilities, [{ placeId: "4", status: "TO_DO", dueOn: "2026-12-01" }, { placeId: "1", status: "IN_PROGRESS", dueOn: "2026-11-25" }, { placeId: "2", status: "DONE" }], "");
  assert.deepEqual(offered.map((o) => o.id), ["1", "4", "2"]);
  assert.deepEqual(offered.map((o) => o.assigned), [true, true, false], "a finished one is no longer given");
  assert.deepEqual(offerFacilities(facilities, [], "mardan").map((o) => o.id), ["2"]);
  assert.deepEqual(offerFacilities(facilities, [], "ÁLPHA").map((o) => o.id), ["2"], "case and accents do not matter");
});

test("the designer keeps what it does not show: a save starts from the original question", () => {
  const original: FormField = { key: "q1", label: "Beds", type: "NUMBER", min: 0, labels: { ur: "بستر" }, helpLabels: { ur: "گنیں" }, verify: { evidenceField: "photo", evidenceWhen: ["RECORD_CHECKED"] }, relevantWhen: { all: [{ field: "a", op: "EQ", value: "1" }, { field: "b", op: "FILLED" }] } };
  const d = toDraft(original);
  const saved = fieldOf({ ...d, label: " Beds in the ward ", max: "100" });
  assert.equal(saved.label, "Beds in the ward");
  assert.equal(saved.max, 100);
  assert.deepEqual(saved.labels, { ur: "بستر" });
  assert.deepEqual(saved.verify, original.verify);
  assert.deepEqual(saved.relevantWhen, original.relevantWhen, "a combined rule is kept as it was");
  const changed = fieldOf({ ...d, type: "TEXT" });
  assert.equal(changed.min, undefined, "a range belongs to a number only");
});

test("tables and repeats: rows keep their key when the label is unchanged, new rows get a new one, columns and children are rebuilt from the draft", () => {
  const grid: FormField = { key: "t", label: "Offices", type: "GRID", rows: [{ key: "ms", label: "MS office" }, { key: "hr", label: "HR office" }], columns: [{ key: "ok", label: "Adequate", type: "YES_NO", allowNotApplicable: true }] };
  const d = toDraft(grid);
  const saved = fieldOf({ ...d, rowsText: "MS office\nFinance office\nHR office", columns: [...d.columns, { ...newColumn(["ok"]), label: "Remarks", type: "TEXT" }] });
  assert.deepEqual(saved.rows!.map((r) => [r.key, r.label]), [["ms", "MS office"], ["finance_office", "Finance office"], ["hr", "HR office"]]);
  assert.equal(saved.columns![0]!.allowNotApplicable, true);
  assert.equal(saved.columns![1]!.type, "TEXT");
  const repeat = fieldOf({ ...blankDraft("blocks", "REPEAT"), label: "Blocks", rowLabel: "Block", minRows: "1", maxRows: "5", children: [{ ...newChild([]), label: "Name", type: "TEXT", required: true }] });
  assert.equal(repeat.maxRows, 5);
  assert.equal(repeat.fields![0]!.required, true);
  assert.equal(freshKey(["q1", "q2"]), "q3");
});

test("a file taken offline inside a table or a repeat is found by its placeholder and replaced by the id the server gives", async () => {
  assert.deepEqual(replaceToken({ a: "tok", b: [{ f: "tok" }, { f: "other" }], c: { d: { e: "tok" } } }, "tok", "REAL"), { a: "REAL", b: [{ f: "REAL" }, { f: "other" }], c: { d: { e: "REAL" } } });
  const sent: unknown[] = [];
  const sender = createCollectionRecordSender({
    uploadFile: async () => ({ ok: true, value: { id: "server-id-1" } }) as never,
    submit: async (_formId, input) => { sent.push(input); return { ok: true, value: {} } as never; },
  });
  const entry = collectionRecordEntry({ id: "entry-0001", title: "Assessment", now: 1, payload: {
    formId: "f", answers: { photo: "tok00001", rows: [{ pic: "tok00002" }], year: 1990 }, placeId: "p1", how: { year: "OBSERVED" }, startedAt: "2026-11-20T09:00:00.000Z",
    files: [
      { fieldKey: "photo", placeholder: "tok00001", name: "a.png", type: "image/png", blob: new Blob(["a"]) },
      { fieldKey: "pic", placeholder: "tok00002", name: "b.png", type: "image/png", blob: new Blob(["b"]) },
    ],
  } });
  const outcome = await sender(entry, async () => undefined);
  assert.equal(outcome.kind, "sent");
  const body = sent[0] as { answers: { photo: string; rows: Array<{ pic: string }> }; placeId: string; how: Record<string, string>; startedAt: string };
  assert.equal(body.answers.photo, "server-id-1");
  assert.equal(body.answers.rows[0]!.pic, "server-id-1");
  assert.equal(body.placeId, "p1");
  assert.deepEqual(body.how, { year: "OBSERVED" });
  // An entry made before Phase 62 names the question instead of a placeholder and still works.
  const old = collectionRecordEntry({ id: "entry-0002", title: "Old", now: 1, payload: { formId: "f", answers: {}, files: [{ fieldKey: "photo", name: "a.png", type: "image/png", blob: new Blob(["a"]) }] } });
  sent.length = 0;
  await sender(old, async () => undefined);
  assert.equal((sent[0] as { answers: { photo: string } }).answers.photo, "server-id-1");
});

test("a draft is kept per form and facility; a stale save is a conflict; removing it forgets it", async () => {
  let n = 0;
  const store = createMemoryDraftStore(() => new Date(2026, 10, 20, 10, 0, n++));
  assert.equal(await store.load("f", "p1"), null);
  const first = await store.save("f", "p1", { answers: { a: 1 }, how: {}, startedAt: "x" }, undefined);
  assert.ok(first.ok);
  const stale = await store.save("f", "p1", { answers: { a: 2 }, how: {}, startedAt: "x" }, "older");
  assert.equal(stale.ok, false);
  const second = await store.save("f", "p1", { answers: { a: 2 }, how: {}, startedAt: "x" }, first.ok ? first.updatedAt : undefined);
  assert.ok(second.ok);
  assert.equal((await store.load("f", "p1"))?.answers.a, 2);
  assert.equal(await store.load("f", "p2"), null, "another facility has its own draft");
  await store.remove("f", "p1");
  assert.equal(await store.load("f", "p1"), null);
});
