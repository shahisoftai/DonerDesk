import test from "node:test";
import assert from "node:assert/strict";
import { TenantId, BUILT_IN_INDICATORS, Indicator, LogframeItem, parseLink, linkOf, libraryIndicator } from "@donordesk/domain";
import {
  EffectiveLibraryService, BrowseSectorLibraryHandler, GetSectorPackHandler, AdoptLibraryIndicatorsHandler, AdoptLibraryLogframeHandler, CheckLibraryUpdatesHandler,
  ApplyLibraryUpdateHandler, SaveOrganisationEntryHandler, SetLibraryEntryHiddenHandler, RecordLibraryReviewHandler, ExportReviewSheetHandler, ImportReviewSheetHandler,
  GetLibraryReviewProgressHandler, AddSetupLibraryHandler, LibraryLinksStep,
} from "../dist/index.js";

const tenantId = TenantId.create("tenant-1");
const ctx = { tenant: { tenantId, userId: "u1", role: "ADMIN" }, requestId: "r" };
const clock = { now: () => new Date("2026-11-08T10:00:00Z") };

function store() {
  const rows = new Map();
  return {
    rows,
    list: async () => ({ ok: true, value: [...rows.values()].map((r) => ({ ...r, updatedAt: new Date(0) })) }),
    upsert: async (_t, rec) => { rows.set(`${rec.entryId}|${rec.kind}`, rec); return { ok: true, value: undefined }; },
    remove: async (_t, entryId, kind) => { rows.delete(`${entryId}|${kind}`); return { ok: true, value: undefined }; },
  };
}
function audits() { const events = []; return { events, record: async (e) => { events.push(e.eventType); } }; }
function logframeRepo(items = []) {
  const list = [...items];
  return { list, findByProject: async () => ({ ok: true, value: list }), findById: async (id) => ({ ok: true, value: list.find((i) => i.id === id) ?? null }) };
}
function node(id, level, title, code) { return LogframeItem.create({ id, tenantId: "tenant-1", projectId: "p1", level, title, ...(code ? { code } : {}) }); }
function indicatorRepo(items = []) {
  const list = [...items];
  return { list, findByProject: async () => ({ ok: true, value: list }), findById: async (id) => ({ ok: true, value: list.find((i) => i.id === id) ?? null }), update: async (i) => ({ ok: true, value: i }), create: async (i) => { list.push(i); return { ok: true, value: i }; } };
}
/** The ordinary create handler, reduced to what matters here: it builds the Indicator exactly as the real one does from the input. */
function creator(repo) {
  const calls = [];
  return { calls, handle: async (_c, input) => {
    calls.push(input);
    if (repo.list.some((i) => i.code === input.code)) return { ok: false, error: { message: "That code is used." } };
    const ind = Indicator.create({ id: `ind-${repo.list.length + 1}`, tenantId: "tenant-1", projectId: input.projectId, logframeItemId: input.logframeItemId, code: input.code, name: input.name, type: input.type, baseline: input.baseline, target: input.target, unit: input.unit, meansOfVerification: input.meansOfVerification, dataSource: input.dataSource, frequency: input.frequency,
      ...(input.semantics ? { semanticsJson: JSON.stringify(input.semantics) } : {}), ...(input.library ? { libraryId: input.library.id, libraryVersion: input.library.version, libraryJson: input.library.linkJson } : {}) });
    repo.list.push(ind);
    return { ok: true, value: { id: ind.id } };
  } };
}

test("the library an organisation sees: its additions, rewordings, hidden entries and review decisions lie over the built-in entries", async () => {
  const s = store();
  const svc = new EffectiveLibraryService(s);
  const hide = new SetLibraryEntryHiddenHandler(s, audits());
  await hide.handle(ctx, { entryId: "WASH-H-01", hidden: true });
  const save = new SaveOrganisationEntryHandler(s, audits());
  assert.ok((await save.handle(ctx, { kind: "OVERRIDE", entryId: "WASH-H-02", patch: { name: "Households with soap and a handwashing place" } })).ok);
  const lib = await svc.forTenant(tenantId);
  assert.equal(lib.value.byId.has("WASH-H-01"), false);
  assert.equal(lib.value.byId.get("WASH-H-02").name, "Households with soap and a handwashing place");
  assert.ok(lib.value.overridden.has("WASH-H-02"));
  assert.equal(BUILT_IN_INDICATORS.find((e) => e.id === "WASH-H-02").name, "Households with soap (or ash) and a handwashing station seen", "the built-in entry is never changed");
  assert.ok((await hide.handle(ctx, { entryId: "WASH-H-01", hidden: false })).ok);
  assert.equal((await svc.forTenant(tenantId)).value.byId.has("WASH-H-01"), true);
  assert.equal((await hide.handle(ctx, { entryId: "NOPE-1", hidden: true })).ok, false);
});

test("an organisation's own entry must pass the library's check and cannot take a built-in id", async () => {
  const s = store();
  const save = new SaveOrganisationEntryHandler(s, audits());
  const base = { ...libraryIndicator("WASH-S-02"), id: "ORG-WASH-1", name: "Our latrine users" };
  assert.ok((await save.handle(ctx, { kind: "ADDED", entry: base })).ok);
  assert.equal((await save.handle(ctx, { kind: "ADDED", entry: { ...base, id: "WASH-S-02" } })).ok, false);
  assert.equal((await save.handle(ctx, { kind: "ADDED", entry: { ...base, id: "ORG-BAD-1", aggregation: "SUM", kind: "RATE", unit: "%" } })).ok, false);
  assert.equal((await save.handle(ctx, { kind: "OVERRIDE", entryId: "WASH-S-02", patch: { kind: "RATE" } })).ok, false, "the kind is the library's");
  assert.equal((await save.handle(ctx, { kind: "OVERRIDE", entryId: "WASH-S-02", patch: { unit: "" } })).ok, false);
  const lib = await new EffectiveLibraryService(s).forTenant(tenantId);
  assert.ok(lib.value.added.has("ORG-WASH-1"));
  assert.ok((await save.handle(ctx, { kind: "CLEAR", entryId: "ORG-WASH-1" })).ok);
  assert.equal((await new EffectiveLibraryService(s).forTenant(tenantId)).value.added.size, 0);
});

test("browse: sectors with counts, filters, groups, and what the project already has", async () => {
  const s = store();
  const repo = indicatorRepo();
  const handler = new BrowseSectorLibraryHandler(new EffectiveLibraryService(s), repo);
  const r = await handler.handle(ctx, { sectors: ["WASH"] });
  assert.ok(r.ok);
  assert.ok(r.value.sectors.length >= 34);
  assert.ok(r.value.total >= 20);
  assert.ok(r.value.groups.length >= 5);
  const withStd = await handler.handle(ctx, { sectors: ["WASH"], withStandard: true });
  assert.ok(withStd.value.groups.flatMap((g) => g.entries).every((e) => e.standardText));
  assert.equal((await handler.handle(ctx, { sectors: ["WASH"], reviewedOnly: true })).value.total, 0, "nothing is reviewed yet");
  repo.list.push(Indicator.create({ id: "i1", tenantId: "tenant-1", projectId: "p1", logframeItemId: "n1", code: "WASH-W-01", name: "x", type: "RATIO", baseline: "", target: "", libraryId: "WASH-W-01", libraryVersion: 1 }));
  const inProject = await handler.handle(ctx, { projectId: "p1", sectors: ["WASH"], includeAdopted: true });
  assert.ok(inProject.value.groups.flatMap((g) => g.entries).find((e) => e.id === "WASH-W-01").adopted);
  const left = await handler.handle(ctx, { projectId: "p1", sectors: ["WASH"] });
  assert.equal(left.value.groups.flatMap((g) => g.entries).some((e) => e.id === "WASH-W-01"), false);
  const pack = await new GetSectorPackHandler().handle(ctx, "GBV");
  assert.equal(pack.value.parts.length, 11);
  assert.equal((await new GetSectorPackHandler().handle(ctx, "NOPE")).ok, false);
});

test("adopt copies an entry into a project through the ordinary create handler, with its link and how it is read, and sets no target", async () => {
  const s = store(); const au = audits();
  const lf = logframeRepo([node("g1", "GOAL", "Goal"), node("o1", "OUTCOME", "Outcome", "OC1"), node("out1", "OUTPUT", "Output", "OP1")]);
  const repo = indicatorRepo();
  const make = creator(repo);
  const handler = new AdoptLibraryIndicatorsHandler(new EffectiveLibraryService(s), repo, lf, make, au, clock);
  const r = await handler.handle(ctx, { projectId: "p1", items: [{ libraryId: "WASH-W-01" }, { libraryId: "WASH-S-02", logframeItemId: "out1" }, { libraryId: "NOPE-1" }] });
  assert.ok(r.ok);
  assert.equal(r.value.created.length, 2);
  assert.equal(r.value.skipped[0].libraryId, "NOPE-1");
  const call = make.calls[0];
  assert.equal(call.baseline, "");
  assert.equal(call.target, "", "the library never sets a target");
  assert.equal(call.type, "RATIO");
  assert.equal(call.semantics.direction, "HIGHER_IS_BETTER");
  assert.equal(call.semantics.status, "REQUIRES_REVIEW", "a person still confirms how it is read");
  assert.equal(call.logframeItemId, "o1", "an outcome-level entry goes to the outcome");
  assert.equal(parseLink(call.library.linkJson).snapshot.referenceStandard.value, 15);
  assert.equal(make.calls[1].logframeItemId, "out1");
  assert.deepEqual(au.events, ["sector_library.adopted"]);
  const again = await handler.handle(ctx, { projectId: "p1", items: [{ libraryId: "WASH-W-01" }] });
  assert.match(again.value.skipped[0].reason, /already/);
  const elsewhere = await handler.handle(ctx, { projectId: "p1", items: [{ libraryId: "WASH-H-01", logframeItemId: "other-project-node" }] });
  assert.match(elsewhere.value.skipped[0].reason, /not in this project/);
  const empty = await new AdoptLibraryIndicatorsHandler(new EffectiveLibraryService(s), indicatorRepo(), logframeRepo(), creator(indicatorRepo()), au, clock).handle(ctx, { projectId: "p2", items: [{ libraryId: "WASH-W-01" }] });
  assert.match(empty.value.skipped[0].reason, /no results/);
});

test("a code the project already uses is never reused", async () => {
  const s = store();
  const lf = logframeRepo([node("out1", "OUTPUT", "Output", "OP1")]);
  const repo = indicatorRepo([Indicator.create({ id: "x", tenantId: "tenant-1", projectId: "p1", logframeItemId: "out1", code: "WASH-S-02", name: "mine", type: "NUMBER", baseline: "", target: "" })]);
  const make = creator(repo);
  const r = await new AdoptLibraryIndicatorsHandler(new EffectiveLibraryService(s), repo, lf, make, audits(), clock).handle(ctx, { projectId: "p1", items: [{ libraryId: "WASH-S-02" }] });
  assert.equal(r.value.created[0].code, "WASH-S-02-2");
});

test("the suggested results are added parents first, reused when already there, and never a second goal", async () => {
  const lf = logframeRepo([node("g1", "GOAL", "Our own goal")]);
  const made = [];
  const creatorItems = { handle: async (_c, input) => { made.push(input); const n = node(`n${made.length}`, input.level, input.title); lf.list.push(n); return { ok: true, value: { id: n.id } }; } };
  const au = audits();
  const h = new AdoptLibraryLogframeHandler(lf, creatorItems, au);
  const r = await h.handle(ctx, { projectId: "p1", sectorId: "WASH" });
  assert.ok(r.ok);
  assert.equal(r.value.created.length, 19, "the goal is not added again; everything else is, activities included");
  assert.ok(r.value.skipped.some((s) => /already has a goal/.test(s.reason)));
  assert.equal(made[0].level, "OUTCOME");
  assert.ok(made.find((m) => m.level === "OUTPUT").parentId, "an output is placed under its outcome");
  const again = await h.handle(ctx, { projectId: "p1", sectorId: "WASH" });
  assert.equal(again.value.created.length, 0);
  assert.ok(again.value.reused.length >= 19);
  const few = await h.handle(ctx, { projectId: "p1", sectorId: "NUTRITION", nodeKeys: ["out-screen"] });
  assert.ok(few.value.created.some((c) => c.key === "o-treat"), "choosing an output brings the outcome above it");
  assert.equal((await h.handle(ctx, { projectId: "p1", sectorId: "NOPE" })).ok, false);
});

test("a changed library entry is shown as a difference; applying carries over only the ticked fields and remembers the version", async () => {
  const s = store(); const au = audits();
  const entry = libraryIndicator("WASH-W-01");
  const old = { ...entry, unit: "litres", version: 1 };
  const repo = indicatorRepo([Indicator.create({ id: "i1", tenantId: "tenant-1", projectId: "p1", logframeItemId: "n1", code: "WASH-W-01", name: "My own wording", type: "RATIO", baseline: "", target: "20", unit: "litres", libraryId: "WASH-W-01", libraryVersion: 1, libraryJson: JSON.stringify(linkOf(old, "2026-11-01")) })]);
  const svc = new EffectiveLibraryService(s);
  const check = await new CheckLibraryUpdatesHandler(svc, repo).handle(ctx, "p1");
  assert.equal(check.value[0].update.state, "CHANGED");
  assert.deepEqual(check.value[0].update.changes.map((c) => c.field), ["unit"]);
  const apply = new ApplyLibraryUpdateHandler(svc, repo, au, clock);
  assert.equal((await apply.handle(ctx, { indicatorId: "x", fields: [] })).ok, false);
  const done = await apply.handle(ctx, { indicatorId: "i1", fields: ["unit"] });
  assert.deepEqual(done.value.applied, ["unit"]);
  const ind = repo.list[0];
  assert.equal(ind.unit, entry.unit);
  assert.equal(ind.name, "My own wording", "a field that was not ticked stays the person's");
  assert.equal(ind.target, "20");
  assert.equal(parseLink(ind.libraryJson).snapshot.unit, entry.unit);
});

test("review: a decision belongs to the organisation and the version; the sheet goes out and comes back; bad rows block it", async () => {
  const s = store(); const au = audits();
  const svc = new EffectiveLibraryService(s);
  const rec = new RecordLibraryReviewHandler(svc, s, au, clock);
  assert.equal((await rec.handle(ctx, { entryIds: ["WASH-W-01"], status: "REVIEWED", reviewer: "" })).ok, false, "a reviewed entry names who");
  assert.equal((await rec.handle(ctx, { entryIds: ["WASH-W-01", "WASH-W-02"], status: "REVIEWED", reviewer: "Ada" })).value.recorded, 2);
  const browse = new BrowseSectorLibraryHandler(svc, indicatorRepo());
  const reviewed = await browse.handle(ctx, { sectors: ["WASH"], reviewedOnly: true });
  assert.deepEqual(reviewed.value.groups.flatMap((g) => g.entries).map((e) => e.id).sort(), ["WASH-W-01", "WASH-W-02"]);
  const sheet = await new ExportReviewSheetHandler(svc).handle(ctx, { sectors: ["WASH"] });
  const lines = sheet.value.text.split("\n");
  assert.equal(lines.length, sheet.value.rows + 1);
  const imp = new ImportReviewSheetHandler(svc, s, au, clock);
  const row = lines.findIndex((l) => l.startsWith("WASH-H-01\t"));
  const cols = lines[row].split("\t"); cols[11] = "REVIEWED"; cols[12] = "Bo"; lines[row] = cols.join("\t");
  const check = await imp.handle(ctx, { text: lines.join("\n"), reviewer: "Bo", apply: false });
  assert.equal(check.value.decisions, 1);
  assert.equal(check.value.applied, false);
  assert.equal((await browse.handle(ctx, { sectors: ["WASH"], reviewedOnly: true })).value.total, 2, "checking stores nothing");
  assert.equal((await imp.handle(ctx, { text: lines.join("\n"), reviewer: "Bo", apply: true })).value.applied, true);
  assert.equal((await browse.handle(ctx, { sectors: ["WASH"], reviewedOnly: true })).value.total, 3);
  const bad = lines.slice(); const bcols = bad[2].split("\t"); bcols[11] = "NONSENSE"; bad[2] = bcols.join("\t");
  const blocked = await imp.handle(ctx, { text: bad.join("\n"), reviewer: "Bo", apply: true });
  assert.equal(blocked.value.problems.length, 1);
  assert.equal(blocked.value.applied, false);
  assert.equal((await imp.handle(ctx, { text: "Id\tNope\n1\t2", reviewer: "", apply: false })).ok, false, "not a reviewer sheet");
  const progress = await new GetLibraryReviewProgressHandler(svc).handle(ctx);
  assert.equal(progress.value.reviewed, 3);
  assert.equal(progress.value.sectors.find((x) => x.sectorId === "WASH").byStatus.REVIEWED, 3);
});

test("the wizard: chosen entries become the person's own indicators in the draft, through the ordinary results handler", async () => {
  const s = store();
  const seen = [];
  const results = { handle: async (_c, _id, op) => { seen.push(op); return { ok: true, value: { id: "d1" } }; } };
  const h = new AddSetupLibraryHandler(new EffectiveLibraryService(s), results, clock);
  assert.ok((await h.handle(ctx, "d1", { kind: "ADD_FROM_LIBRARY", ids: ["WASH-W-01", "WASH-W-01", "NOPE"], logframeCode: "OP1" })).ok);
  assert.equal(seen[0].kind, "ADD_FROM_LIBRARY");
  assert.deepEqual(seen[0].entries.map((e) => e.id), ["WASH-W-01"]);
  assert.equal(seen[0].today, "2026-11-08");
  assert.equal((await h.handle(ctx, "d1", { kind: "ADD_FROM_LIBRARY", ids: ["NOPE"] })).ok, false);
  assert.ok((await h.handle(ctx, "d1", { kind: "ADD_FROM_SKELETON", sectorId: "NUTRITION", nodeKeys: ["g"] })).ok);
  assert.equal(seen[1].skeleton.length > 0, true);
  assert.equal((await h.handle(ctx, "d1", { kind: "ADD_FROM_SKELETON", sectorId: "NOPE" })).ok, false);
});

test("launch links the indicators the wizard created to their library entries, and only those", async () => {
  const calls = [];
  const writer = { link: async (_c, projectId, items) => { calls.push({ projectId, items }); return { ok: true, value: { linked: items.length, notes: [] } }; } };
  const step = new LibraryLinksStep(writer);
  const entry = libraryIndicator("WASH-W-01");
  const mk = (code, extra = {}) => ({ value: { code, title: code, logframeCode: "G", ...extra }, sourceQuote: null, sourceRef: null, confidence: "HIGH", status: "EDITED" });
  const draft = { proposal: { indicators: [mk("A", { libraryId: entry.id, libraryVersion: 1, libraryLinkJson: JSON.stringify(linkOf(entry, "2026-11-08")) }), mk("B"), { ...mk("C", { libraryId: entry.id, libraryVersion: 1, libraryLinkJson: "{}" }), status: "REJECTED" }] }, extras: {} };
  const r = await step.run(ctx, "p1", draft);
  assert.deepEqual(calls[0].items.map((i) => i.code), ["A"]);
  assert.equal(r.value.done, 1);
  const none = await step.run(ctx, "p1", { proposal: { indicators: [mk("B")] }, extras: {} });
  assert.equal(none.value.done, 0);
  assert.equal(calls.length, 1, "nothing is written when nothing was chosen from the library");
});
