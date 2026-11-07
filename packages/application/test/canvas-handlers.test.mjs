import test from "node:test";
import assert from "node:assert/strict";
import { TenantId, SAMPLE_FACTS, SAMPLE_SHEET } from "@donordesk/domain";
import { ListCanvasesHandler, GetCanvasHandler, CreateCanvasHandler, SaveCanvasHandler, DeleteCanvasHandler, DuplicateCanvasHandler, ConvertDashboardHandler, ConvertInfographicHandler, ResolveCanvasHandler, ExportCanvasHandler } from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ctxFor = (userId, role) => ({ tenant: { tenantId, userId, role }, requestId: "r" });
const ADMIN = ctxFor("anna", "ADMIN"), VIEWER = ctxFor("vic", "VIEWER"), OTHER_VIEWER = ctxFor("vera", "VIEWER");
const ok = (value) => ({ ok: true, value });

function world(opts = {}) {
  const rows = new Map(); const audit = []; let n = 0; let tick = 0;
  const repo = {
    create: async (c) => {
      if (c.sourceKind && [...rows.values()].some((r) => r.sourceKind === c.sourceKind && r.sourceId === c.sourceId)) return ok(false);
      rows.set(c.id, { ...c, updatedAt: new Date(Date.UTC(2026, 10, 9, 0, 0, ++tick)) }); return ok(true);
    },
    update: async (c, expected) => { const cur = rows.get(c.id); if (!cur || cur.canvas.revision !== expected) return ok(false); rows.set(c.id, { ...c, canvas: { ...c.canvas, revision: expected + 1 } }); return ok(true); },
    delete: async (id) => (rows.delete(id), ok(undefined)),
    findById: async (id) => ok(rows.get(id) ?? null),
    findBySource: async (_t, kind, sid) => ok([...rows.values()].find((r) => r.sourceKind === kind && r.sourceId === sid) ?? null),
    listVisible: async (_t, ownerId) => ok([...rows.values()].filter((r) => r.scope !== "MINE" || r.ownerId === ownerId)),
  };
  const log = { record: async (e) => void audit.push(e) };
  const ids = { generate: () => `c${++n}` }; const clock = { now: () => new Date("2026-11-09T00:00:00Z") };
  const visible = { for: async () => ok([{ id: "p1" }]) };
  const dashboards = new Map(); const infographics = new Map();
  const dashRepo = { findById: async (id) => ok(dashboards.get(id) ?? null) };
  const infoRepo = { findById: async (id) => ok(infographics.get(id) ?? null) };
  return {
    rows, audit, dashboards, infographics, repo,
    list: new ListCanvasesHandler(repo), get: new GetCanvasHandler(repo), create: new CreateCanvasHandler(ids, repo, visible, log, clock), save: new SaveCanvasHandler(repo, log, clock),
    del: new DeleteCanvasHandler(repo, log), dup: new DuplicateCanvasHandler(ids, repo, log, clock),
    convDash: new ConvertDashboardHandler(dashRepo, repo, ids, log, clock), convInfo: new ConvertInfographicHandler(infoRepo, repo, visible, ids, log, clock),
    ...opts,
  };
}
const block = (id, kind, props, bindings = [], x = 0, y = 0) => ({ id, kind, bounds: { x, y, w: kind === "DIVIDER" ? 12 : 6, h: kind === "DIVIDER" ? 1 : 3 }, props, bindings });
const pageOf = (blocks) => [{ id: "p1", title: "One", format: "WEB_FLUID", blocks }];
const saveInput = (c, over = {}) => ({ id: c.id, expectedRevision: c.canvas.revision, title: c.title, pages: c.canvas.pages, profile: c.canvas.profile, language: "en", themeId: "DEFAULT", ...over });

test("anyone makes a personal canvas; a shared one needs someone who manages shared work", async () => {
  const w = world();
  const mine = await w.create.handle(VIEWER, { title: "My view", scope: "MINE" });
  assert.equal(mine.ok, true); assert.equal(mine.value.mine, true); assert.equal(mine.value.canvas.pages[0].blocks.length, 0);
  const shared = await w.create.handle(VIEWER, { title: "Org view", scope: "ORG" });
  assert.equal(shared.ok, false); assert.match(shared.error.message, /manage shared work/);
  assert.equal((await w.create.handle(ADMIN, { title: "Org view", scope: "ORG" })).ok, true);
  assert.ok(w.audit.some((e) => e.eventType === "canvas.created"));
});

test("a project canvas needs a project the person can see; the other scopes must not name one", async () => {
  const w = world();
  assert.match((await w.create.handle(ADMIN, { title: "P", scope: "PROJECT" })).error.message, /needs a project/);
  assert.match((await w.create.handle(ADMIN, { title: "P", scope: "ORG", projectId: "p1" })).error.message, /Only a project canvas/);
  assert.equal((await w.create.handle(ADMIN, { title: "P", scope: "PROJECT", projectId: "elsewhere" })).error.code, "NOT_FOUND");
  assert.equal((await w.create.handle(ADMIN, { title: "P", scope: "PROJECT", projectId: "p1" })).ok, true);
});

test("a personal canvas does not exist for anyone else; a shared one is seen by all and listed once", async () => {
  const w = world();
  const mine = (await w.create.handle(VIEWER, { title: "Mine", scope: "MINE" })).value;
  const shared = (await w.create.handle(ADMIN, { title: "Shared", scope: "ORG" })).value;
  assert.equal((await w.get.handle(OTHER_VIEWER, mine.id)).error.code, "NOT_FOUND");
  assert.equal((await w.get.handle(OTHER_VIEWER, shared.id)).ok, true);
  assert.deepEqual((await w.list.handle(OTHER_VIEWER)).value.map((c) => c.title), ["Shared"]);
  assert.deepEqual((await w.list.handle(VIEWER)).value.map((c) => c.title).sort(), ["Mine", "Shared"]);
  assert.equal((await w.get.handle(OTHER_VIEWER, shared.id)).value.canEdit, false, "a viewer sees it but cannot change it");
});

test("saving stores the work, reports what is not set up, and bumps the revision", async () => {
  const w = world();
  const c = (await w.create.handle(VIEWER, { title: "Draft", scope: "MINE" })).value;
  const r = await w.save.handle(VIEWER, saveInput(c, { pages: pageOf([block("k", "KPI", { indicatorId: "", includeDraft: false }), block("t", "TEXT", { text: "Hello", role: "body" }, [], 6, 0)]) }));
  assert.equal(r.ok, true);
  assert.equal(r.value.canvas.canvas.revision, 2);
  assert.ok(r.value.problems.some((p) => p.blockId === "k"), "the KPI with no indicator is reported, not refused");
  assert.equal(w.rows.get(c.id).canvas.pages[0].blocks.length, 2);
});

test("a save from an old copy is refused and changes nothing", async () => {
  const w = world();
  const c = (await w.create.handle(VIEWER, { title: "Draft", scope: "MINE" })).value;
  await w.save.handle(VIEWER, saveInput(c, { title: "First" }));
  const stale = await w.save.handle(VIEWER, saveInput(c, { title: "Second" }));
  assert.equal(stale.ok, false); assert.equal(stale.error.code, "CONFLICT");
  assert.equal(w.rows.get(c.id).title, "First");
});

test("a canvas whose shape is broken is refused: unknown block, off the grid, duplicate ids", async () => {
  const w = world();
  const c = (await w.create.handle(VIEWER, { title: "Draft", scope: "MINE" })).value;
  for (const [blocks, pattern] of [
    [[block("a", "NOPE", {})], /not one the product knows/],
    [[{ ...block("a", "TEXT", { text: "x", role: "body" }), bounds: { x: 10, y: 0, w: 6, h: 2 } }], /inside the page/],
    [[block("a", "TEXT", { text: "x", role: "body" }), block("a", "TEXT", { text: "y", role: "body" }, [], 6, 0)], /share an id/],
  ]) {
    const r = await w.save.handle(VIEWER, saveInput(c, { pages: pageOf(blocks) }));
    assert.equal(r.ok, false); assert.match(r.error.message, pattern);
  }
  assert.equal(w.rows.get(c.id).canvas.revision, 1, "nothing was stored");
});

test("a shared canvas is changed by its owner or whoever manages shared work, not by a viewer", async () => {
  const w = world();
  const c = (await w.create.handle(ADMIN, { title: "Shared", scope: "ORG" })).value;
  assert.equal((await w.save.handle(VIEWER, saveInput(c))).error.code, "FORBIDDEN");
  assert.equal((await w.del.handle(VIEWER, c.id)).error.code, "FORBIDDEN");
  assert.equal((await w.save.handle(ctxFor("pam", "PROJECT_MANAGER"), saveInput(c))).ok, true);
  assert.equal((await w.del.handle(ADMIN, c.id)).ok, true);
  assert.equal(w.rows.size, 0);
});

test("a copy is always the caller's own and keeps no source link", async () => {
  const w = world();
  const c = (await w.create.handle(ADMIN, { title: "Shared", scope: "ORG" })).value;
  const copy = await w.dup.handle(VIEWER, c.id);
  assert.equal(copy.ok, true); assert.equal(copy.value.scope, "MINE"); assert.equal(copy.value.title, "Shared (copy)"); assert.equal(copy.value.mine, true);
  assert.equal(w.rows.get(copy.value.id).sourceKind, undefined);
});

const dashboard = (over = {}) => ({ id: "d1", tenantId, scope: "ORG", ownerId: "anna", name: "Management", widgets: [
  { id: "w1", projectId: "p1", kind: "KPI", kpi: { indicatorId: "i1", includeDraft: false }, x: 0, y: 0, w: 3, h: 2 },
  { id: "w2", projectId: "p1", kind: "TEXT", text: "# Note", x: 3, y: 0, w: 6, h: 2 },
  { id: "w3", projectId: "p1", kind: "KPI", x: 9, y: 0, w: 3, h: 2 },
], createdAt: new Date(), updatedAt: new Date(), ...over });

test("a dashboard becomes one canvas, once; unreadable widgets are named; the dashboard stays", async () => {
  const w = world();
  w.dashboards.set("d1", dashboard());
  const first = await w.convDash.handle(ADMIN, "d1");
  assert.equal(first.ok, true); assert.equal(first.value.created, true);
  assert.deepEqual(first.value.unreadable.map((u) => u.widgetId), ["w3"]);
  const blocks = first.value.canvas.canvas.pages[0].blocks;
  assert.deepEqual(blocks.map((b) => b.id), ["w1", "w2"]);
  assert.deepEqual(blocks[0].bindings, [{ type: "PROJECT", slot: "project", projectId: "p1" }]);
  const again = await w.convDash.handle(ADMIN, "d1");
  assert.equal(again.value.created, false); assert.equal(again.value.canvas.id, first.value.canvas.id);
  assert.equal(w.rows.size, 1); assert.ok(w.dashboards.has("d1"));
});

test("converting two at the same moment makes one canvas", async () => {
  const w = world();
  w.dashboards.set("d1", dashboard());
  const [a, b] = await Promise.all([w.convDash.handle(ADMIN, "d1"), w.convDash.handle(ADMIN, "d1")]);
  assert.equal(a.ok && b.ok, true);
  assert.equal(a.value.canvas.id, b.value.canvas.id);
  assert.equal(w.rows.size, 1);
});

test("a personal dashboard converts only for its owner; a shared one needs someone who manages shared work", async () => {
  const w = world();
  w.dashboards.set("mine", dashboard({ id: "mine", scope: "MINE", ownerId: "vic" }));
  w.dashboards.set("org", dashboard({ id: "org" }));
  assert.equal((await w.convDash.handle(OTHER_VIEWER, "mine")).error.code, "NOT_FOUND");
  assert.equal((await w.convDash.handle(VIEWER, "mine")).ok, true);
  assert.equal((await w.convDash.handle(VIEWER, "org")).error.code, "FORBIDDEN");
  assert.equal((await w.convDash.handle(ADMIN, "missing")).error.code, "NOT_FOUND");
});

const infographic = (over = {}) => ({ id: "i1", tenantId: "tenant-a", projectId: "p1", title: "Snapshot", templateId: "CUSTOM", templateVersion: 1, createdById: "anna", updatedById: "anna", createdAt: new Date(), updatedAt: new Date(), status: "DRAFT", selfApproved: false,
  configJson: JSON.stringify({ templateId: "CUSTOM", templateVersion: 1, periodFromId: "q2", locationKeys: ["gulu"], sections: [{ kind: "KEY_MESSAGES", span: 12, messages: [{ text: "One" }] }, { kind: "KPIS", span: 12, indicatorIds: Array.from({ length: 8 }, (_, i) => `i${i}`) }] }), ...over });

test("an infographic becomes one canvas that keeps its period range and places, and loses no figure", async () => {
  const w = world();
  w.infographics.set("i1", infographic());
  const r = await w.convInfo.handle(ADMIN, "i1");
  assert.equal(r.ok, true); assert.equal(r.value.canvas.scope, "PROJECT"); assert.equal(r.value.canvas.mode, "PUBLISHED_ONLY");
  assert.deepEqual(r.value.canvas.canvas.options, { periodFromId: "q2", locationKeys: ["gulu"] });
  const kinds = r.value.canvas.canvas.pages[0].blocks.map((b) => b.kind);
  assert.deepEqual(kinds, ["KEY_MESSAGES", "BIG_NUMBERS", "BIG_NUMBERS"], "8 indicators fit two rows of figures");
  assert.equal((await w.convInfo.handle(ADMIN, "i1")).value.created, false);
  w.infographics.set("bad", infographic({ id: "bad", configJson: "{nope" }));
  assert.equal((await w.convInfo.handle(ADMIN, "bad")).ok, false);
  w.infographics.set("hidden", infographic({ id: "hidden", projectId: "not-mine" }));
  assert.equal((await w.convInfo.handle(ADMIN, "hidden")).error.code, "NOT_FOUND");
});

// ---- resolve ----

function resolver(w, over = {}) {
  const preview = { handle: async (_c, widgets) => ok({ charts: widgets.map((x) => ({ widgetId: x.id, text: "drawn" })) }) };
  const sheets = { handle: async () => ok(SAMPLE_SHEET) };
  const info = { handle: async () => ok({ project: { title: "Safe Water", donorName: "EU", country: "Kenya" }, reach: SAMPLE_FACTS.reach, activities: SAMPLE_FACTS.activities, finance: SAMPLE_FACTS.finance, indicators: SAMPLE_FACTS.indicators }) };
  const visible = { for: async () => ok([{ id: "p1" }]) };
  return new ResolveCanvasHandler(w.repo, over.preview ?? preview, sheets, over.info ?? info, visible, over.extras);
}

test("resolving draws chart-style blocks through the dashboards' path and the rest through their models", async () => {
  const w = world();
  const c = (await w.create.handle(ADMIN, { title: "Mixed", scope: "PROJECT", projectId: "p1" })).value;
  const pages = pageOf([
    block("k", "KPI", { indicatorId: "a", includeDraft: false }, [{ type: "PROJECT", slot: "project", projectId: "p1" }]),
    block("r", "REACH", {}, [], 6, 0), block("t", "TEXT", { text: "Hello", role: "body" }, [], 0, 3), block("inherits", "KPI", { indicatorId: "a", includeDraft: false }, [], 6, 3),
  ]);
  await w.save.handle(ADMIN, saveInput(c, { pages }));
  const r = await resolver(w).handle(ADMIN, c.id);
  assert.equal(r.ok, true);
  assert.deepEqual(r.value.drawings.map((d) => d.widgetId), ["k", "inherits"], "a project canvas gives its own project to a block that names none");
  assert.equal(r.value.models.r.state, "ready"); assert.equal(r.value.models.r.model.overallUnique, 120);
  assert.equal(r.value.models.t.state, "ready");
  assert.equal(r.value.models.k, undefined);
});

test("on a canvas with no project of its own, a block that names none is told so, not drawn from nowhere", async () => {
  const w = world();
  const c = (await w.create.handle(VIEWER, { title: "Loose", scope: "MINE" })).value;
  await w.save.handle(VIEWER, saveInput(c, { pages: pageOf([block("lost", "KPI", { indicatorId: "a", includeDraft: false })]) }));
  const r = await resolver(w).handle(VIEWER, c.id);
  assert.deepEqual(r.value.drawings, []);
  assert.equal(r.value.models.lost.state, "unavailable");
  assert.match(r.value.models.lost.reason, /Choose the project/);
});

test("a canvas whose project the viewer cannot see shows 'unavailable', never that project's figures", async () => {
  const w = world();
  const c = (await w.create.handle(ADMIN, { title: "P", scope: "PROJECT", projectId: "p1" })).value;
  await w.save.handle(ADMIN, saveInput(c, { pages: pageOf([block("r", "REACH", {})]) }));
  const hidden = new ResolveCanvasHandler(w.repo, { handle: async () => ok({ charts: [] }) }, { handle: async () => { throw new Error("must not read"); } }, { handle: async () => { throw new Error("must not read"); } }, { for: async () => ok([]) });
  const r = await hidden.handle(ADMIN, c.id);
  assert.equal(r.ok, true); assert.equal(r.value.models.r.state, "unavailable");
});

test("a personal canvas cannot be resolved by someone else", async () => {
  const w = world();
  const c = (await w.create.handle(VIEWER, { title: "Mine", scope: "MINE" })).value;
  assert.equal((await resolver(w).handle(OTHER_VIEWER, c.id)).error.code, "NOT_FOUND");
});

test("the project list block is built from the viewer's own projects", async () => {
  const w = world();
  const c = (await w.create.handle(VIEWER, { title: "L", scope: "MINE" })).value;
  await w.save.handle(VIEWER, saveInput(c, { pages: pageOf([block("l", "PROJECT_LIST", { affiliation: "ALL" })]) }));
  const extras = { visibleProjects: async () => [{ projectId: "p1", title: "Water", status: "ACTIVE", sector: "WASH", country: "Kenya", donorName: "EU" }], bookmarkedProjectIds: async () => new Set() };
  const r = await resolver(w, { extras }).handle(VIEWER, c.id);
  assert.deepEqual(r.value.models.l.model.rows, [["Water", "Active", "Wash", "Kenya", "EU"]]);
  assert.equal((await resolver(w).handle(VIEWER, c.id)).value.models.l.state, "unavailable", "with no way to read the viewer's projects it says so");
});

test("each infographic-style block reads the project it names, else its canvas's; a project's facts are read once", async () => {
  const w = world();
  const c = (await w.create.handle(VIEWER, { title: "Mixed", scope: "MINE" })).value;
  const bind = (p) => [{ type: "PROJECT", slot: "project", projectId: p }];
  await w.save.handle(VIEWER, saveInput(c, { pages: pageOf([block("a", "REACH", {}, bind("p1")), block("b", "DEMOGRAPHICS", {}, bind("p1"), 6, 0), block("c", "FUNDING", {}, bind("p2"), 0, 3), block("d", "HERO", {}, bind("p1"), 6, 3)]) }));
  const reads = [];
  const sheets = { handle: async (_c, pid) => { reads.push(`sheet:${pid}`); return ok(SAMPLE_SHEET); } };
  const info = { handle: async (_c, pid) => { reads.push(`info:${pid}`); return ok({ project: { title: "Safe Water", donorName: "EU", country: "Kenya" }, reach: SAMPLE_FACTS.reach, activities: SAMPLE_FACTS.activities, finance: SAMPLE_FACTS.finance, indicators: [] }); } };
  const h = new ResolveCanvasHandler(w.repo, { handle: async () => ok({ charts: [] }) }, sheets, info, { for: async () => ok([{ id: "p1" }]) });
  const r = await h.handle(VIEWER, c.id);
  assert.equal(r.value.models.a.state, "ready"); assert.equal(r.value.models.b.state, "ready");
  assert.equal(r.value.models.c.state, "unavailable", "a project the viewer cannot see is unavailable, and is never read");
  assert.deepEqual(reads.sort(), ["info:p1", "sheet:p1"], "p1 read once for three blocks; p2 not at all");
  assert.deepEqual([r.value.models.d.model.title, r.value.models.d.model.kicker], ["Mixed", "EU · Kenya"], "the cover reads the canvas's title and the project");
});

// ---- preview of an unsaved canvas ----

test("previewing reads an edited canvas without saving it, under the viewer's own access", async () => {
  const w = world();
  const c = (await w.create.handle(ADMIN, { title: "Draft", scope: "PROJECT", projectId: "p1" })).value;
  const edited = { ...c.canvas, pages: pageOf([block("r", "REACH", {}), block("k", "KPI", { indicatorId: "a", includeDraft: false })]) };
  const before = JSON.stringify(w.rows.get(c.id));
  const r = await resolver(w).preview(ADMIN, { canvas: edited, projectId: "p1", title: "Draft" });
  assert.equal(r.ok, true);
  assert.deepEqual(r.value.drawings.map((d) => d.widgetId), ["k"]);
  assert.equal(r.value.models.r.state, "ready");
  assert.equal(JSON.stringify(w.rows.get(c.id)), before, "nothing was stored");
  const hidden = new ResolveCanvasHandler(w.repo, { handle: async () => ok({ charts: [] }) }, { handle: async () => { throw new Error("must not read"); } }, { handle: async () => { throw new Error("must not read"); } }, { for: async () => ok([]) });
  assert.equal((await hidden.preview(VIEWER, { canvas: edited, projectId: "p1", title: "x" })).value.models.r.state, "unavailable", "a project the viewer cannot see gives no figures");
});

test("a portfolio block reads the portfolio the person can see, and nothing else", async () => {
  const w = world();
  const c = (await w.create.handle(ADMIN, { title: "All", scope: "ORG" })).value;
  const portfolio = { handle: async () => ok({ asAt: "2026-03-31", totals: { projects: 1, countries: 1, behind: 0, needAttention: 0, openRisks: 0, reportsOverdue: 0, onTrack: 1, noPlan: 0 }, rows: [{ title: "A", donorName: "D", country: "K", band: "ON_TRACK" }], countries: [{ country: "K", projects: 1, onTrack: 1, atRisk: 0, offTrack: 0, noPlan: 0 }] }) };
  const sheets = { handle: async () => { throw new Error("a portfolio block reads no project"); } };
  const h = new ResolveCanvasHandler(w.repo, { handle: async () => ok({ charts: [] }) }, sheets, sheets, { for: async () => ok([{ id: "p1" }]) }, undefined, portfolio);
  const edited = { ...c.canvas, pages: pageOf([block("s", "PORTFOLIO_SUMMARY", {}), block("t", "PORTFOLIO_TABLE", {}, [], 6, 0)]) };
  const r = await h.preview(ADMIN, { canvas: edited, projectId: undefined, title: "All" });
  assert.equal(r.value.models.s.state, "ready");
  assert.equal(r.value.models.s.model.cards[0].value, 1);
  assert.equal(r.value.models.t.model.rows[0].title, "A");
});

// ---- export ----

test("a file is made from the saved canvas; blocks a file cannot hold are named, and a canvas with nothing to print is refused", async () => {
  const w = world();
  const c = (await w.create.handle(ADMIN, { title: "Water update", scope: "PROJECT", projectId: "p1" })).value;
  const seen = [];
  const render = { build: async (_c, projectId, config) => { seen.push({ projectId, config }); return ok({ input: { marker: 1 }, provenance: { generatedAt: "2026-03-01T00:00:00.000Z", source: "project-records", periodLabels: [], indicatorCodes: [], unverifiedCount: 0, notYetReportedCount: 0 }, altText: "alt" }); } };
  const renderer = { renderPdf: async () => ok(Buffer.from("%PDF-")), renderPng: async () => ok(Buffer.from("png")), renderSvgPages: async () => ok([{ svg: "<svg/>" }]), renderPptx: async () => ok(Buffer.from("pptx")), renderPack: async () => ok(Buffer.from("zip")) };
  const exporter = new ExportCanvasHandler(w.repo, render, renderer);
  const empty = await exporter.handle(ADMIN, c.id, { format: "PDF" });
  assert.equal(empty.ok, false); assert.match(empty.error.message, /Nothing on this canvas/);
  await w.save.handle(ADMIN, saveInput(c, { pages: pageOf([block("t", "TEXT", { text: "Hello" }), block("m", "METRIC", { metric: "FIN_SPENT" }, [], 6, 0), block("ai", "AI_SUMMARY", { text: "Draft", accepted: false }, [], 0, 3)]) }));
  const done = await exporter.handle(ADMIN, c.id, { format: "PDF" });
  assert.equal(done.ok, true, done.ok ? "" : done.error.message);
  assert.equal(done.value.contentType, "application/pdf"); assert.equal(done.value.fileName, "water-update.pdf");
  assert.deepEqual(done.value.skipped.map((s) => s.kind).sort(), ["AI_SUMMARY", "METRIC"], "a tile and an unaccepted draft stay on screen only");
  assert.equal(seen[0].projectId, "p1"); assert.equal(seen[0].config.sections.length, 1);
  assert.equal((await exporter.handle(OTHER_VIEWER, c.id, { format: "PNG" })).ok, true, "a shared project canvas is seen by all");
  const mine = (await w.create.handle(VIEWER, { title: "Mine", scope: "MINE" })).value;
  assert.equal((await exporter.handle(OTHER_VIEWER, mine.id, { format: "PNG" })).error.code, "NOT_FOUND");
});

// ---- containers: a repeater repeats what it holds, once per project the viewer can see ----

test("a project repeater resolves its blocks once per visible project, and a place repeater narrows to one place; held blocks are not resolved on their own", async () => {
  const w = world();
  const c = (await w.create.handle(ADMIN, { title: "Each", scope: "ORG" })).value;
  const held = (id, kind, props, container) => ({ ...block(id, kind, props), container });
  const pages = pageOf([
    block("rep", "REPEATER", { over: "PROJECT", limit: 2 }), held("reach", "REACH", {}, { id: "rep" }), held("kpi", "KPI", { indicatorId: "a", includeDraft: false }, { id: "rep" }),
    block("rep2", "REPEATER", { over: "PLACE", limit: 5 }, [], 0, 3), held("r2", "REACH", {}, { id: "rep2" }),
  ]);
  await w.save.handle(ADMIN, saveInput(c, { pages }));
  const seen = [];
  const preview = { handle: async (_c, widgets) => (seen.push(...widgets.map((x) => [x.id, x.projectId])), ok({ charts: widgets.map((x) => ({ widgetId: x.id })) })) };
  const sheets = { handle: async (_c, pid) => ok({ ...SAMPLE_SHEET, projectId: pid }) };
  const info = { handle: async () => ok({ project: { title: "P", donorName: "D", country: "K" }, reach: SAMPLE_FACTS.reach, activities: SAMPLE_FACTS.activities, finance: SAMPLE_FACTS.finance, indicators: SAMPLE_FACTS.indicators }) };
  const visible = { for: async () => ok([{ id: "p1", title: "One" }, { id: "p2", title: "Two" }, { id: "p3", title: "Three" }]) };
  const r = await new ResolveCanvasHandler(w.repo, preview, sheets, info, visible).handle(ADMIN, c.id);
  assert.equal(r.ok, true);
  assert.deepEqual(r.value.repeats.rep.map((x) => x.label), ["One", "Two"], "limited to the number asked for");
  assert.deepEqual(seen.filter(([id]) => id.startsWith("kpi::")), [["kpi::p1", "p1"], ["kpi::p2", "p2"]], "a chart-style block is drawn once per project");
  assert.equal(r.value.models["reach::p1"].state, "ready"); assert.equal(r.value.models["reach::p2"].state, "ready");
  assert.equal(r.value.models.reach, undefined, "a held block has no model of its own");
  assert.ok(r.value.repeats.rep2.length === 0 || r.value.models[`r2::${r.value.repeats.rep2[0].key}`], "a place repeater resolves per place when the project names places");
});
