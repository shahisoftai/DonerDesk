import test from "node:test";
import assert from "node:assert/strict";
import { TenantId } from "@donordesk/domain";
import {
  SaveCanvasHandler, ReviewCanvasHandler, ListCanvasVersionsHandler, PublishCanvasHandler, CreateCanvasShareHandler, ResolveCanvasShareHandler, RevokeCanvasShareHandler,
  SetCanvasSnapshotsHandler, RunCanvasSnapshotsHandler, DraftCanvasTextHandler, GetCanvasShareFileHandler,
} from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ctxFor = (userId, role) => ({ tenant: { tenantId, userId, role }, requestId: "r" });
const ADMIN = ctxFor("anna", "ADMIN"), VIEWER = ctxFor("vic", "VIEWER");
const ok = (value) => ({ ok: true, value });
let clockNow = new Date("2026-11-09T00:00:00Z");
const clock = { now: () => clockNow };
const audit = []; const log = { record: async (e) => void audit.push(e) };

function canvasOf(over = {}) {
  return { id: "c1", scope: "PROJECT", mode: "LIVE", profile: "INTERNAL", title: "Water", language: "en", themeId: "DEFAULT", revision: 1, pages: [{ id: "p", title: "One", format: "A4_PORTRAIT", blocks: [{ id: "t", kind: "TEXT", bounds: { x: 0, y: 0, w: 12, h: 2 }, props: { text: "Hello" }, bindings: [] }] }], ...over };
}
function world(over = {}) {
  const rows = new Map();
  const stored = { id: "c1", tenantId, scope: "PROJECT", mode: "LIVE", projectId: "p1", ownerId: "anna", title: "Water", canvas: canvasOf(over.canvas), reviewStatus: "DRAFT", createdAt: clockNow, updatedAt: clockNow, ...over.stored };
  rows.set("c1", stored);
  const repo = {
    findById: async (id) => ok(rows.get(id) ?? null),
    update: async (c, expected) => { const cur = rows.get(c.id); if (!cur || cur.canvas.revision !== expected) return ok(false); rows.set(c.id, { ...c, canvas: { ...c.canvas, revision: expected + 1 } }); return ok(true); },
    setReview: async (id, _t, r) => { const cur = rows.get(id); rows.set(id, { ...cur, reviewStatus: r.status, ...(r.note ? { reviewNote: r.note } : {}) }); return ok(undefined); },
    setSnapshot: async (id, _t, ch) => { const cur = rows.get(id); rows.set(id, { ...cur, ...(ch.every ? { snapshotEvery: ch.every } : {}), ...(ch.lastAt ? { lastSnapshotAt: ch.lastAt } : {}), ...(ch.actor ? { snapshotActor: ch.actor } : {}) }); return ok(undefined); },
    listScheduled: async () => ok([...rows.values()].filter((r) => r.snapshotEvery && r.snapshotEvery !== "NONE")),
  };
  const versions = new Map();
  const versionRepo = { add: async (v) => (versions.has(v.id) || versions.set(v.id, v), ok(undefined)), list: async () => ok([...versions.values()].map(({ canvas: _c, ...v }) => v)), find: async (_c, rev) => ok([...versions.values()].find((v) => v.revision === rev) ?? null) };
  return { rows, repo, versions, versionRepo };
}
const save = (w) => new SaveCanvasHandler(w.repo, log, clock, w.versionRepo);
const input = (w, over = {}) => ({ id: "c1", expectedRevision: w.rows.get("c1").canvas.revision, title: "Water", pages: w.rows.get("c1").canvas.pages, profile: "INTERNAL", language: "en", themeId: "DEFAULT", ...over });

test("a save keeps the document it replaced, and puts a reviewed canvas back to a draft", async () => {
  const w = world({ stored: { reviewStatus: "APPROVED", reviewedById: "rita" } });
  const r = await save(w).handle(ADMIN, input(w, { title: "Water v2" }));
  assert.equal(r.ok, true);
  assert.equal(w.rows.get("c1").reviewStatus, "DRAFT");
  assert.equal(w.rows.get("c1").reviewedById, undefined);
  assert.equal(w.versions.get("c1:1").title, "Water", "the version holds what was replaced");
  const lister = new ListCanvasVersionsHandler(w.repo, w.versionRepo);
  assert.equal((await lister.list(ADMIN, "c1")).value[0].revision, 1);
  assert.equal((await lister.get(ADMIN, "c1", 1)).value.canvas.title, "Water");
  assert.equal((await lister.get(ADMIN, "c1", 9)).error.code, "NOT_FOUND");
});

test("review: anyone submits, only an approver approves or sends back with a reason", async () => {
  const w = world();
  const h = new ReviewCanvasHandler(w.repo, log);
  assert.equal((await h.handle(ADMIN, "c1", { action: "APPROVE" })).error.code, "CONFLICT", "not in review yet");
  assert.equal((await h.handle(VIEWER, "c1", { action: "SUBMIT" })).value.status, "IN_REVIEW");
  assert.match((await h.handle(VIEWER, "c1", { action: "APPROVE" })).error.message, /Only someone who may approve/);
  assert.match((await h.handle(ADMIN, "c1", { action: "REQUEST_CHANGES" })).error.message, /Say what needs to change/);
  assert.equal((await h.handle(ADMIN, "c1", { action: "REQUEST_CHANGES", note: "Add the source" })).value.status, "CHANGES_REQUESTED");
  assert.equal(w.rows.get("c1").reviewNote, "Add the source");
  await h.handle(ADMIN, "c1", { action: "SUBMIT" });
  assert.equal((await h.handle(ADMIN, "c1", { action: "APPROVE" })).value.status, "APPROVED");
});

function publishing(w) {
  const exports = new Map(); const files = new Map();
  const exportRepo = { create: async (e) => (exports.set(e.id, e), ok(undefined)), findById: async (id) => ok(exports.get(id) ?? null) };
  const storage = { put: async (i) => void files.set(i.key, i.body), read: async (k) => files.get(k) };
  const render = { build: async () => ok({ input: {}, provenance: { source: "project-records", periodLabels: [], indicatorCodes: [], generatedAt: "2026-11-09T00:00:00.000Z", unverifiedCount: 0, notYetReportedCount: 0 }, altText: "alt" }) };
  const renderer = { renderPdf: async () => ok(Buffer.from("%PDF-1")), renderPng: async () => ok(Buffer.from("png")), renderSvgPages: async () => ok([{ svg: "<svg/>" }]), renderPptx: async () => ok(Buffer.from("p")), renderPack: async () => ok(Buffer.from("z")) };
  let n = 0; const ids = { generate: () => `x${++n}` };
  const publish = new PublishCanvasHandler(w.repo, exportRepo, { render, renderer }, storage, ids, log, clock);
  return { publish, exports, files, exportRepo, ids };
}

test("publishing keeps an immutable copy; a canvas for a donor must be approved first", async () => {
  const w = world({ canvas: { profile: "DONOR_REPORT" } });
  const p = publishing(w);
  const blocked = await p.publish.handle(ADMIN, "c1", { format: "PDF" });
  assert.match(blocked.error.message, /approved before it is published|Design check/);
  const w2 = world();
  const p2 = publishing(w2);
  assert.equal((await p2.publish.handle(VIEWER, "c1", { format: "PDF" })).error.code, "FORBIDDEN", "needs report.export");
  const made = await p2.publish.handle(ADMIN, "c1", { format: "PDF" });
  assert.equal(made.ok, true, made.ok ? "" : made.error.message);
  assert.equal(p2.exports.size, 1); assert.ok([...p2.files.keys()][0].startsWith("canvases/tenant-a/c1/"));
});

test("a share link: LIVE or FROZEN, token shown once, expired and revoked links are unavailable, FROZEN needs a copy of this canvas", async () => {
  const w = world();
  const p = publishing(w);
  const links = new Map();
  const linkRepo = {
    create: async (l) => (links.set(l.id, l), ok(undefined)), findById: async (id) => ok(links.get(id) ?? null),
    findByTokenHash: async (h) => ok([...links.values()].find((l) => l.tokenHash === h) ?? null),
    revoke: async (id, _t, at) => (links.set(id, { ...links.get(id), revokedAt: at }), ok(undefined)),
  };
  const create = new CreateCanvasShareHandler(w.repo, p.exportRepo, linkRepo, p.ids, log, clock);
  assert.match((await create.handle(ADMIN, "c1", { kind: "FROZEN", label: "x", expiresInDays: 7 })).error.message, /published copy/);
  const copy = (await p.publish.handle(ADMIN, "c1", { format: "PDF" })).value;
  const live = await create.handle(ADMIN, "c1", { kind: "LIVE", label: "Team", expiresInDays: 7 });
  const frozen = await create.handle(ADMIN, "c1", { kind: "FROZEN", label: "Donor", expiresInDays: 7, exportId: copy.id });
  assert.ok(live.value.token.length > 20); assert.ok(![...links.values()].some((l) => l.tokenHash === live.value.token), "only a hash is kept");
  const resolve = new ResolveCanvasShareHandler(linkRepo, clock);
  assert.equal((await resolve.handle(live.value.token)).value.kind, "LIVE");
  const f = (await resolve.handle(frozen.value.token)).value;
  assert.equal(f.exportId, copy.id);
  const file = await new GetCanvasShareFileHandler(p.exportRepo, { read: async (k) => p.files.get(k) }).handle(f.tenantId, f.canvasId, f.exportId);
  assert.equal(file.value.contentType, "application/pdf");
  assert.equal((await resolve.handle("nope")).error.code, "NOT_FOUND");
  await new RevokeCanvasShareHandler(w.repo, linkRepo, log, clock).handle(ADMIN, "c1", live.value.id);
  assert.equal((await resolve.handle(live.value.token)).error.code, "NOT_FOUND", "revoked");
  const before = clockNow; clockNow = new Date("2026-12-30T00:00:00Z");
  assert.equal((await resolve.handle(frozen.value.token)).error.code, "NOT_FOUND", "expired");
  clockNow = before;
});

test("scheduled snapshots are made when due, as the person who set them, and skipped with a reason when the canvas may not be published", async () => {
  const w = world();
  const p = publishing(w);
  const set = new SetCanvasSnapshotsHandler(w.repo, log);
  assert.equal((await set.handle(VIEWER, "c1", "WEEKLY")).error.code, "FORBIDDEN");
  assert.equal((await set.handle(ADMIN, "c1", "WEEKLY")).value.every, "WEEKLY");
  const run = new RunCanvasSnapshotsHandler(w.repo, p.publish, clock);
  let r = (await run.handle(tenantId)).value;
  assert.equal(r.made, 1); assert.equal(p.exports.size, 1);
  assert.equal([...p.exports.values()][0].createdById, "anna");
  r = (await run.handle(tenantId)).value;
  assert.equal(r.checked, 0, "not due again yet");
  clockNow = new Date("2026-11-17T00:00:00Z");
  w.rows.set("c1", { ...w.rows.get("c1"), canvas: canvasOf({ profile: "DONOR_REPORT" }) });
  r = (await run.handle(tenantId)).value;
  assert.equal(r.made, 0); assert.match(r.skipped[0].reason, /approved|Design check/);
  clockNow = new Date("2026-11-09T00:00:00Z");
});

test("drafting text is off unless the organisation switched canvas AI on, and never for partners", async () => {
  const writer = { handle: async () => ok({ available: true, model: "m", headlines: [{ text: "Two boreholes opened.", basis: "AI" }], messages: [{ text: "Rains delayed two sites.", basis: "AI" }], droppedUngrounded: 1 }) };
  const ask = { handle: async () => ok({ available: true, status: "ANSWERED", answer: ["120 people were reached [S1]."], sentences: [], missing: [], dropped: { uncited: 0, ungrounded: 1 }, looked: {} }) };
  const off = new DraftCanvasTextHandler({ isEnabled: async () => false, set: async () => ok(undefined) }, writer, ask);
  assert.equal((await off.handle(ADMIN, { style: "SUMMARY", projectId: "p1" })).value.available, false);
  const on = new DraftCanvasTextHandler({ isEnabled: async () => true, set: async () => ok(undefined) }, writer, ask);
  const s = (await on.handle(ADMIN, { style: "SUMMARY", projectId: "p1" })).value;
  assert.equal(s.available, true); assert.match(s.text, /Two boreholes opened/); assert.equal(s.dropped, 1);
  assert.equal((await on.handle(ADMIN, { style: "QUESTION", projectId: "p1" })).value.available, false, "a question is needed");
  assert.match((await on.handle(ADMIN, { style: "QUESTION", projectId: "p1", instruction: "How many people?" })).value.text, /120 people/);
  const partner = { tenant: { tenantId, userId: "pat", role: "VIEWER", external: true }, requestId: "r" };
  assert.match((await on.handle(partner, { style: "SUMMARY", projectId: "p1" })).value.reason, /outside partners/);
});

test("a review request tells the people who can approve; a decision tells the person who made the canvas; never the person acting", async () => {
  const w = world();
  const told = [];
  const notifier = { approvers: async () => ["rita", "anna"], tell: async (ctx, to, title) => void told.push({ to: to.filter((x) => x !== ctx.tenant.userId), title }) };
  const h = new ReviewCanvasHandler(w.repo, log, notifier);
  await h.handle(VIEWER, "c1", { action: "SUBMIT" });
  assert.deepEqual(told[0].to, ["rita", "anna"]); assert.match(told[0].title, /waiting for review/);
  await h.handle(ADMIN, "c1", { action: "APPROVE" });
  assert.deepEqual(told[1].to, []); assert.match(told[1].title, /approved/, "the owner is the one acting here, so nobody else is told");
  await h.handle(VIEWER, "c1", { action: "REOPEN" }); await h.handle(VIEWER, "c1", { action: "SUBMIT" });
  await h.handle(ctxFor("rita", "ADMIN"), "c1", { action: "REQUEST_CHANGES", note: "Add the source" });
  assert.deepEqual(told.at(-1).to, ["anna"]); assert.match(told.at(-1).title, /Changes/);
});
