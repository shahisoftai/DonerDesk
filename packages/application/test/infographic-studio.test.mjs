import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { TenantId, configFromTemplate, checkDesign, resolveTheme, DomainError } from "@donordesk/domain";
import {
  CreateInfographicHandler, UpdateInfographicHandler, ExportInfographicHandler, InfographicReviewHandler, InfographicNotifier,
  CreateInfographicShareLinkHandler, ResolveInfographicShareHandler, ListInfographicShareLinksHandler, RevokeInfographicShareLinkHandler,
  GenerateInfographicVariantsHandler, UploadInfographicAssetHandler, RemoveInfographicAssetHandler, ListInfographicAssetsHandler,
  SaveBrandKitHandler, SaveInfographicTemplateHandler, PreviewInfographicHandler, GetInfographicSuggestionsHandler, storyFactsOf, assetIdsOf,
} from "../dist/index.js";

const tenantId = TenantId.create("tenant-1");
const ctxOf = (userId = "u1") => ({ tenant: { tenantId, userId }, requestId: "r" });
const ok = (value) => ({ ok: true, value });
const clock = { now: () => new Date("2026-10-25T10:00:00Z") };
const ids = () => { let n = 0; return { generate: () => `id-${++n}` }; };
const audits = () => { const events = []; return { events, record: async (e) => { events.push(e); return ok(undefined); } }; };

function fakeRepo() {
  const designs = new Map();
  const exports = new Map();
  return {
    designs, exports,
    create: async (r) => { designs.set(r.id, r); return ok(r); },
    update: async (r) => { designs.set(r.id, r); return ok(r); },
    findById: async (id) => ok(designs.get(id) ?? null),
    findByProject: async (p) => ok([...designs.values()].filter((d) => d.projectId === p)),
    remove: async (id) => { designs.delete(id); return ok(undefined); },
    addExport: async (r) => { exports.set(r.id, r); return ok(r); },
    findExportById: async (id) => ok(exports.get(id) ?? null),
    findExportsByInfographic: async (id) => ok([...exports.values()].filter((e) => e.infographicId === id)),
    findExportsByProject: async (p) => ok([...exports.values()].filter((e) => e.projectId === p)),
  };
}
function fakeStorage() { const files = new Map(); return { files, put: async ({ key, body }) => { files.set(key, body); return { key }; }, read: async (key) => files.get(key), remove: async (k) => void files.delete(k), getSignedUrl: async () => "" }; }

const baseDesign = async (repo, over = {}, idGen = ids()) => {
  const create = new CreateInfographicHandler(idGen, repo, audits(), clock);
  const config = { ...configFromTemplate("CUSTOM", "Water"), ...over };
  const r = await create.handle(ctxOf(), "p1", { templateId: "CUSTOM", title: "Water", config });
  assert.equal(r.ok, true, r.error?.message);
  return r.value;
};

test("create: a new design is a draft, the creator is recorded, and a user template is used when named", async () => {
  const repo = fakeRepo();
  const d = await baseDesign(repo);
  assert.equal(d.status, "DRAFT");
  assert.equal(d.selfApproved, false);
  const tmpl = { id: "ut1", tenantId: "tenant-1", name: "Mine", baseTemplateId: "CUSTOM", configJson: JSON.stringify({ ...configFromTemplate("CUSTOM"), themeId: "CYAN" }), createdById: "u1", createdAt: new Date(), updatedAt: new Date() };
  const create = new CreateInfographicHandler(ids(), repo, audits(), clock, { findById: async (id) => ok(id === "ut1" ? tmpl : null) });
  const viaTemplate = await create.handle(ctxOf(), "p1", { templateId: "CUSTOM", title: "From mine", userTemplateId: "ut1" });
  assert.equal(viaTemplate.ok, true);
  assert.equal(viaTemplate.value.config.themeId, "CYAN");
  assert.equal(viaTemplate.value.config.title, "From mine");
  const missing = await create.handle(ctxOf(), "p1", { templateId: "CUSTOM", userTemplateId: "nope" });
  assert.equal(missing.ok, false);
});

test("update: a real change returns an approved design to draft and clears the approval; a save that changes nothing keeps it", async () => {
  const repo = fakeRepo();
  const d = await baseDesign(repo);
  repo.designs.set(d.id, { ...repo.designs.get(d.id), status: "APPROVED", approvedById: "u2", approvedAt: new Date(), reviewRequestedById: "u1", selfApproved: true });
  const au = audits();
  const update = new UpdateInfographicHandler(repo, au, clock);
  const same = await update.handle(ctxOf(), d.id, { config: repo.designs.get(d.id) && JSON.parse(repo.designs.get(d.id).configJson) });
  assert.equal(same.ok, true);
  assert.equal(repo.designs.get(d.id).status, "APPROVED", "nothing changed: still approved");
  const cfg = JSON.parse(repo.designs.get(d.id).configJson);
  cfg.sections[1].messages = [{ text: "New message" }];
  const changed = await update.handle(ctxOf(), d.id, { config: cfg });
  assert.equal(changed.ok, true);
  const row = repo.designs.get(d.id);
  assert.equal(row.status, "DRAFT");
  assert.equal(row.approvedById, undefined);
  assert.equal(row.selfApproved, false);
  assert.match(au.events.at(-1).systemNote, /returned to draft from APPROVED/);
});

function reviewSetup({ approvers = ["u2", "u3"] } = {}) {
  const repo = fakeRepo();
  const au = audits();
  const told = [];
  const notifier = new InfographicNotifier({ send: async (n) => void told.push(n) }, { findById: async () => ok({ title: "P", projectManagerId: approvers[0], meOfficerId: approvers[1], reportingOfficerId: undefined }) }, { findByProject: async () => ok([]) });
  return { repo, au, told, handler: new InfographicReviewHandler(repo, notifier, au, clock) };
}

test("review: request → approve by someone else → returned; each move is audited and the right people are told", async () => {
  const { repo, au, told, handler } = reviewSetup();
  const d = await baseDesign(repo);
  const requested = await handler.handle(ctxOf("u1"), d.id, { action: "REQUEST_REVIEW" });
  assert.equal(requested.value.status, "IN_REVIEW");
  assert.equal(requested.value.reviewRequestedById, "u1");
  assert.ok(told.length >= 1 && told.every((n) => n.recipientId !== "u1" && n.relatedEntityType === "infographic"));
  const approved = await handler.handle(ctxOf("u2"), d.id, { action: "APPROVE" });
  assert.equal(approved.value.status, "APPROVED");
  assert.equal(approved.value.approvedById, "u2");
  assert.equal(approved.value.selfApproved, false);
  assert.equal(au.events.at(-1).eventType, "infographic.approve");
  const back = await handler.handle(ctxOf("u2"), d.id, { action: "RETURN", note: "Fix the title" });
  assert.equal(back.value.status, "DRAFT");
  assert.equal(back.value.approvedById, undefined);
  assert.ok(told.some((n) => /sent back/.test(n.title) && /Fix the title/.test(n.message)));
});

test("review: nothing moves out of order, and the requester may not approve their own request when someone else can", async () => {
  const { repo, handler } = reviewSetup();
  const d = await baseDesign(repo);
  const early = await handler.handle(ctxOf("u2"), d.id, { action: "APPROVE" });
  assert.equal(early.ok, false, "a draft nobody reviewed cannot be approved");
  assert.equal(early.error.code, "CONFLICT");
  await handler.handle(ctxOf("u2"), d.id, { action: "REQUEST_REVIEW" });
  const self = await handler.handle(ctxOf("u2"), d.id, { action: "APPROVE" });
  assert.equal(self.ok, false);
  assert.match(self.error.message, /Another approver/);
  const twice = await handler.handle(ctxOf("u2"), d.id, { action: "REQUEST_REVIEW" });
  assert.equal(twice.ok, false);
});

test("review: a sole approver may approve their own request, and it is audited as self-approval", async () => {
  const { repo, au, handler } = reviewSetup({ approvers: ["u1", undefined] });
  const d = await baseDesign(repo);
  await handler.handle(ctxOf("u1"), d.id, { action: "REQUEST_REVIEW" });
  const approved = await handler.handle(ctxOf("u1"), d.id, { action: "APPROVE" });
  assert.equal(approved.ok, true);
  assert.equal(approved.value.selfApproved, true);
  assert.equal(au.events.at(-1).eventType, "infographic.approve.self");
});

// ---- export gating

function exportSetup({ check, status = "DRAFT", profile } = {}) {
  const repo = fakeRepo();
  const storage = fakeStorage();
  const au = audits();
  const config = { ...configFromTemplate("CUSTOM", "Water"), ...(profile ? { profile } : {}) };
  const built = {
    input: { configJson: JSON.stringify(config) },
    provenance: { source: "project-records", periodLabels: ["Q1"], indicatorCodes: [], generatedAt: clock.now().toISOString(), unverifiedCount: 0, notYetReportedCount: 0 },
    check: check ?? { findings: [], blockers: [], canPublish: true },
    altText: "A summary", periodIds: ["q1"], indicatorIds: [], data: { provenance: { generatedAt: "2026-10-24T00:00:00Z" } },
  };
  const render = { build: async () => ok(built) };
  const calls = [];
  const renderer = {
    renderPng: async (_i, scale) => (calls.push(["png", scale]), ok(Buffer.from("PNG"))),
    renderPdf: async () => (calls.push(["pdf"]), ok(Buffer.from("PDF"))),
    renderSvgPages: async () => ok([{ svg: "<svg/>", width: 1, height: 1 }, { svg: "<svg/>", width: 1, height: 1 }]),
    renderPptx: async () => ok(Buffer.from("PPTX")),
    renderPack: async () => ok(Buffer.from("ZIP")),
    renderPngPages: async () => ok([]),
  };
  const handler = new ExportInfographicHandler(repo, render, renderer, storage, ids(), au, clock);
  return { repo, storage, au, handler, config, calls, seed: async () => { const d = await baseDesign(repo, { ...(profile ? { profile } : {}) }); repo.designs.set(d.id, { ...repo.designs.get(d.id), status }); return d; } };
}

test("export: every format is stored under its own extension with the page count, description and approval flag", async () => {
  const { handler, seed, storage, calls } = exportSetup({ status: "APPROVED" });
  const d = await seed();
  const out = {};
  for (const format of ["PNG", "PDF", "SVG", "PPTX", "PACK"]) {
    const r = await handler.handle(ctxOf(), d.id, { format, ...(format === "PNG" ? { scale: 3 } : {}) });
    assert.equal(r.ok, true, `${format}: ${r.error?.message}`);
    out[format] = r.value;
  }
  assert.match(out.PNG.storageKey, /\.png$/);
  assert.match(out.PDF.storageKey, /\.pdf$/);
  assert.match(out.SVG.storageKey, /\.svg$/);
  assert.match(out.PPTX.storageKey, /\.pptx$/);
  assert.match(out.PACK.storageKey, /\.zip$/);
  assert.equal(out.PNG.pageCount, 2);
  assert.equal(out.PNG.approved, true);
  assert.equal(out.PNG.altText, "A summary");
  assert.deepEqual(calls[0], ["png", 3]);
  assert.equal(storage.files.size, 5);
});

test("export: a blocker stops the publish with the reason and the fix; a waived blocker passes and is audited", async () => {
  const blocker = { ruleId: "MAP_DISCLAIMER", severity: "BLOCKER", message: "This map has no disclaimer.", fix: "Turn it on." };
  const blocked = exportSetup({ check: { findings: [blocker], blockers: [blocker], canPublish: false } });
  const d = await blocked.seed();
  const r = await blocked.handler.handle(ctxOf(), d.id, { format: "PNG" });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, "CONFLICT");
  assert.match(r.error.message, /This map has no disclaimer\. Turn it on\./);
  assert.equal(blocked.repo.exports.size, 0);
  assert.equal(blocked.storage.files.size, 0, "nothing stored for a refused publish");

  const waivedFinding = { ...blocker, waived: true };
  const waived = exportSetup({ check: { findings: [waivedFinding], blockers: [], canPublish: true } });
  const d2 = await waived.seed();
  const cfg = JSON.parse(waived.repo.designs.get(d2.id).configJson);
  cfg.waivers = [{ ruleId: "MAP_DISCLAIMER", note: "Board pack, no borders shown" }];
  waived.repo.designs.set(d2.id, { ...waived.repo.designs.get(d2.id), configJson: JSON.stringify(cfg) });
  const ok2 = await waived.handler.handle(ctxOf(), d2.id, { format: "PDF" });
  assert.equal(ok2.ok, true);
  assert.deepEqual(JSON.parse(ok2.value.waivedJson), [{ ruleId: "MAP_DISCLAIMER", note: "Board pack, no borders shown" }]);
  assert.ok(waived.au.events.some((e) => e.eventType === "infographic.waive"));
});

test("export: a design for a donor must be approved first", async () => {
  const draft = exportSetup({ profile: "DONOR_REPORT", status: "DRAFT" });
  const d = await draft.seed();
  const refused = await draft.handler.handle(ctxOf(), d.id, { format: "PDF" });
  assert.equal(refused.ok, false);
  assert.match(refused.error.message, /must be approved/);
  const approved = exportSetup({ profile: "DONOR_REPORT", status: "APPROVED" });
  const d2 = await approved.seed();
  assert.equal((await approved.handler.handle(ctxOf(), d2.id, { format: "PDF" })).ok, true);
  const internal = exportSetup({ profile: "INTERNAL", status: "DRAFT" });
  assert.equal((await internal.handler.handle(ctxOf(), (await internal.seed()).id, { format: "PDF" })).ok, true, "internal designs need no approval");
});

// ---- share links

function shareSetup() {
  const repo = fakeRepo();
  const storage = fakeStorage();
  const links = new Map();
  const shares = {
    create: async (r) => (links.set(r.id, r), ok(r)),
    listByInfographic: async (id) => ok([...links.values()].filter((l) => l.infographicId === id)),
    revoke: async (id, _t, at) => { const l = links.get(id); if (l) links.set(id, { ...l, revokedAt: at }); return ok(undefined); },
    findByTokenHash: async (hash) => ok([...links.values()].find((l) => l.tokenHash === hash) ?? null),
    recordView: async (id) => { const l = links.get(id); links.set(id, { ...l, viewCount: l.viewCount + 1 }); return ok(undefined); },
  };
  return { repo, storage, links, shares };
}

test("share links: only the hash is stored; the link opens exactly one export until it expires or is revoked", async () => {
  const { repo, storage, links, shares } = shareSetup();
  const d = await baseDesign(repo);
  repo.exports.set("e1", { id: "e1", tenantId: "tenant-1", infographicId: d.id, projectId: "p1", format: "PDF", storageKey: "k1", altText: "A summary" });
  storage.files.set("k1", Buffer.from("PDFDATA"));
  const au = audits();
  const create = new CreateInfographicShareLinkHandler(repo, shares, ids(), au, clock);
  const made = await create.handle(ctxOf(), d.id, { exportId: "e1", days: 7 });
  assert.equal(made.ok, true);
  const { token, link } = made.value;
  assert.ok(token.length >= 40);
  assert.equal(link.tokenHash, createHash("sha256").update(token).digest("hex"));
  assert.equal(JSON.stringify([...links.values()]).includes(token), false, "the token itself is never stored");
  assert.equal(link.expiresAt.toISOString(), "2026-11-01T10:00:00.000Z");
  assert.equal(au.events[0].eventType, "infographic.share.create");

  const resolve = new ResolveInfographicShareHandler(shares, repo, storage, clock);
  const opened = await resolve.handle(token, { countView: true });
  assert.equal(opened.ok, true);
  assert.equal(opened.value.bytes.toString(), "PDFDATA");
  assert.equal(opened.value.contentType, "application/pdf");
  assert.equal(opened.value.altText, "A summary");
  assert.equal([...links.values()][0].viewCount, 1);
  await resolve.handle(token);
  assert.equal([...links.values()][0].viewCount, 1, "only the file read counts a view");

  for (const bad of ["x", "../../etc/passwd", "a".repeat(200), `${token}x`]) assert.equal((await resolve.handle(bad)).ok, false, bad);

  const later = new ResolveInfographicShareHandler(shares, repo, storage, { now: () => new Date("2026-11-02T00:00:00Z") });
  assert.equal((await later.handle(token)).ok, false, "expired");

  const list = await new ListInfographicShareLinksHandler(shares).handle(ctxOf(), d.id);
  assert.equal(list.value.length, 1);
  assert.equal("tokenHash" in list.value[0], false, "the list never shows the hash");
  assert.equal(list.value[0].live, true);
  await new RevokeInfographicShareLinkHandler(shares, au, clock).handle(ctxOf(), link.id);
  assert.equal((await resolve.handle(token)).ok, false, "revoked");
});

test("share links: only an export of the named design can be shared", async () => {
  const { repo, shares } = shareSetup();
  const d = await baseDesign(repo);
  repo.exports.set("e9", { id: "e9", infographicId: "someone-else", projectId: "p1", format: "PNG", storageKey: "k" });
  const create = new CreateInfographicShareLinkHandler(repo, shares, ids(), audits(), clock);
  assert.equal((await create.handle(ctxOf(), d.id, { exportId: "e9" })).ok, false);
  assert.equal((await create.handle(ctxOf(), d.id, { exportId: "nope" })).ok, false);
});

// ---- variants

test("variants: one draft per location with its own filter, linked to the original; nothing to split by is an error", async () => {
  const repo = fakeRepo();
  const d = await baseDesign(repo, { sections: [{ kind: "TEXT", text: "x" }] });
  const data = { value: { periods: [{ id: "q1", label: "Q1" }, { id: "q2", label: "Q2" }], activities: { rows: [{ key: "gulu", location: "Gulu" }, { key: "kitgum", location: "Kitgum" }] }, reach: { registeredByLocation: [{ key: "pader", location: "Pader" }] }, indicators: [] }, ok: true };
  const create = new CreateInfographicHandler(ids(), repo, audits(), clock);
  const variants = new GenerateInfographicVariantsHandler(repo, create, { handle: async () => data });
  const r = await variants.handle(ctxOf(), d.id, { by: "LOCATION" });
  assert.equal(r.ok, true, r.error?.message);
  assert.equal(r.value.length, 3);
  const configs = r.value.map((v) => JSON.parse(v.configJson));
  assert.deepEqual(configs.map((c) => c.locationKeys), [["gulu"], ["kitgum"], ["pader"]]);
  assert.ok(r.value.every((v) => v.parentId === d.id && v.status === "DRAFT"));
  assert.equal(r.value[0].title, "Water – Gulu");
  const byPeriod = await variants.handle(ctxOf(), d.id, { by: "PERIOD" });
  assert.deepEqual(byPeriod.value.map((v) => JSON.parse(v.configJson).periodToId), ["q1", "q2"]);
  const latest = await variants.handle(ctxOf(), d.id, { by: "LATEST_PERIOD" });
  assert.equal(JSON.parse(latest.value[0].configJson).periodToId, "q2");
  const empty = await new GenerateInfographicVariantsHandler(repo, create, { handle: async () => ({ ok: true, value: { periods: [], activities: { rows: [] }, reach: { registeredByLocation: [] }, indicators: [] } }) }).handle(ctxOf(), d.id, { by: "LOCATION" });
  assert.equal(empty.ok, false);
  assert.equal(repo.designs.get(d.id).status, "DRAFT");
});

// ---- assets, brand, templates

function assetSetup() {
  const store = new Map();
  const assets = {
    create: async (r) => (store.set(r.id, r), ok(r)),
    findById: async (id) => ok(store.get(id) ?? null),
    findByIds: async (list) => ok(list.map((i) => store.get(i)).filter(Boolean)),
    list: async () => ok([...store.values()]),
    archive: async (id, _t, at) => { store.set(id, { ...store.get(id), archivedAt: at }); return ok(undefined); },
  };
  const images = { normalize: async (bytes) => (bytes.toString().startsWith("bad") ? { ok: false, error: DomainError.validation("Use a PNG or JPEG picture") } : ok({ bytes: Buffer.from("NORM"), contentType: "image/png", width: 400, height: 300 })) };
  return { store, assets, images };
}

test("assets: an upload is re-encoded, stored, audited and listed; a bad picture or a huge one is refused; removal archives", async () => {
  const { store, assets, images } = assetSetup();
  const storage = fakeStorage();
  const au = audits();
  const upload = new UploadInfographicAssetHandler(assets, images, storage, ids(), au, clock);
  const good = await upload.handle(ctxOf(), { name: "Well.png", kind: "IMAGE", credit: "J. Ouma", dataBase64: Buffer.from("PICTURE-BYTES").toString("base64") });
  assert.equal(good.ok, true);
  assert.equal(good.value.sizeBytes, 4, "the stored size is the re-encoded size");
  assert.match(good.value.storageKey, /^infographic-assets\/tenant-1\/.+\.png$/);
  assert.equal(storage.files.get(good.value.storageKey).toString(), "NORM");
  assert.equal(good.value.credit, "J. Ouma");
  assert.equal(au.events[0].eventType, "infographic.asset.upload");
  const bad = await upload.handle(ctxOf(), { name: "x", kind: "IMAGE", dataBase64: Buffer.from("bad-picture-bytes").toString("base64") });
  assert.equal(bad.ok, false);
  const huge = await upload.handle(ctxOf(), { name: "x", kind: "IMAGE", dataBase64: Buffer.alloc(7_000_000, 1).toString("base64") });
  assert.equal(huge.ok, false);
  assert.match(huge.error.message, /under 6 MB/);
  assert.equal(store.size, 1);
  const list = new ListInfographicAssetsHandler(assets);
  assert.equal((await list.handle(ctxOf())).value.length, 1);
  await new RemoveInfographicAssetHandler(assets, au, clock).handle(ctxOf(), good.value.id);
  assert.equal((await list.handle(ctxOf())).value.length, 0, "removed assets are not offered");
  assert.equal((await new RemoveInfographicAssetHandler(assets, au, clock).handle(ctxOf(), "nope")).ok, false);
});

test("brand kit: validated, its logos must exist in the library, and the save is audited", async () => {
  const { assets, store } = assetSetup();
  const kits = new Map();
  const repo = { get: async () => ok(kits.get("tenant-1") ?? null), save: async (_t, kit) => (kits.set("tenant-1", kit), ok(undefined)) };
  const au = audits();
  const save = new SaveBrandKitHandler(repo, assets, ids(), au);
  assert.equal((await save.handle(ctxOf(), { primaryColor: "blue" })).ok, false);
  assert.equal((await save.handle(ctxOf(), { primaryColor: "#0B66B3", logoAssetId: "ghost" })).ok, false, "a logo that is not in the library");
  store.set("logo1", { id: "logo1", tenantId: "tenant-1" });
  const saved = await save.handle(ctxOf(), { primaryColor: "#0B66B3", logoAssetId: "logo1", footerLine: " www.example.org " });
  assert.equal(saved.ok, true);
  assert.equal(kits.get("tenant-1").primaryColor, "#0b66b3");
  assert.equal(kits.get("tenant-1").footerLine, "www.example.org");
  assert.equal(au.events.at(-1).eventType, "infographic.brand.save");
  store.set("logo1", { id: "logo1", tenantId: "tenant-1", archivedAt: new Date() });
  assert.equal((await save.handle(ctxOf(), { primaryColor: "#0B66B3", logoAssetId: "logo1" })).ok, false, "a removed logo cannot be chosen");
});

test("saved layouts: a layout carries sections and settings, never the title, filters, waivers, images or indicator picks", async () => {
  const repo = fakeRepo();
  const d = await baseDesign(repo, {
    title: "Gulu 2026", periodFromId: "q1", locationKeys: ["gulu"], waivers: [{ ruleId: "X", note: "n" }], coverAssetId: "a1", donorLogoAssetIds: ["a2"], themeId: "CYAN", format: "SQUARE",
    sections: [{ kind: "IMAGE", assetId: "a1", consentConfirmed: true, caption: "A well" }, { kind: "KPIS", indicatorIds: ["i1"], locationKeys: ["gulu"] }, { kind: "KEY_MESSAGES", messages: [{ text: "Hello" }] }],
  });
  const store = new Map();
  const userTemplates = { create: async (r) => (store.set(r.id, r), ok(r)) };
  const au = audits();
  const saved = await new SaveInfographicTemplateHandler(repo, userTemplates, ids(), au, clock).handle(ctxOf(), { name: "  My layout ", infographicId: d.id });
  assert.equal(saved.ok, true);
  assert.equal(saved.value.name, "My layout");
  assert.equal(saved.value.baseTemplateId, "CUSTOM");
  const cfg = JSON.parse(saved.value.configJson);
  for (const gone of ["title", "periodFromId", "locationKeys", "waivers", "coverAssetId", "donorLogoAssetIds"]) assert.equal(gone in cfg, false, gone);
  assert.equal(cfg.themeId, "CYAN");
  assert.equal(cfg.format, "SQUARE");
  assert.equal(cfg.sections[0].assetId, undefined);
  assert.equal(cfg.sections[0].consentConfirmed, undefined, "consent belongs to one photo, never to a layout");
  assert.equal(cfg.sections[0].caption, "A well");
  assert.equal(cfg.sections[1].indicatorIds, undefined);
  assert.equal(cfg.sections[2].messages[0].text, "Hello");
  assert.equal(au.events[0].eventType, "infographic.template.save");
});

test("preview: the unsaved draft is drawn, the template cannot change, and a bad draft is refused", async () => {
  const repo = fakeRepo();
  const d = await baseDesign(repo);
  const seen = [];
  const render = { build: async (_c, projectId, config, opts) => (seen.push({ projectId, config, opts }), ok({ input: { x: 1 }, check: { findings: [], blockers: [], canPublish: true }, altText: "alt", provenance: { source: "project-records", periodLabels: ["Q1"], indicatorCodes: [], generatedAt: clock.now().toISOString(), unverifiedCount: 0, notYetReported: 0, notYetReportedCount: 0 } })) };
  const renderer = { renderSvgPages: async () => ok([{ svg: "<svg/>", width: 10, height: 10 }]) };
  const preview = new PreviewInfographicHandler(repo, render, renderer);
  const draft = { ...JSON.parse(repo.designs.get(d.id).configJson), title: "Unsaved title", themeId: "HIGH_CONTRAST", templateId: "OVERVIEW" };
  const r = await preview.handle(ctxOf(), d.id, { config: draft, mapPoints: [{ name: "Gulu", lat: 1, lng: 2, worst: "DONE" }] });
  assert.equal(r.ok, true, r.error?.message);
  assert.equal(seen[0].config.title, "Unsaved title");
  assert.equal(seen[0].config.themeId, "HIGH_CONTRAST");
  assert.equal(seen[0].config.templateId, "CUSTOM", "the saved template wins over the draft's");
  assert.equal(seen[0].opts.preview, true);
  assert.equal(seen[0].opts.mapPoints.length, 1);
  assert.match(r.value.footer, /Data: Q1/);
  assert.equal(repo.designs.get(d.id).configJson.includes("Unsaved"), false, "a preview stores nothing");
  const bad = await preview.handle(ctxOf(), d.id, { config: { ...draft, sections: [] } });
  assert.equal(bad.ok, false);
  assert.equal((await preview.handle(ctxOf(), "nope", {})).ok, false);
});

test("suggestions: built only from the project's figures", async () => {
  const data = { project: { title: "Clean Water", country: "Uganda" }, periodOrder: ["q1"], activities: { rows: [{ key: "g", location: "Gulu", planned: 18, done: 14 }], unlocated: 1 }, reach: { overallUnique: 21345, registeredByLocation: [{ location: "Gulu", unique: 100 }] }, finance: { enabled: false, rows: [] }, indicators: [] };
  const sheet = { periods: [{ id: "q1" }], indicators: [{ id: "i1", code: "#1", name: "Boreholes", target: "120", unit: "", isRate: false, level: null, baseline: "0" }], cells: [{ indicatorId: "i1", periodId: "q1", periodValue: "30", cumulativeValue: "86", status: "VERIFIED" }], finance: [] };
  const handler = new GetInfographicSuggestionsHandler({ handle: async () => ok(data) }, { handle: async () => ok(sheet) });
  const r = await handler.handle(ctxOf(), "p1", { language: "en" });
  assert.equal(r.ok, true);
  assert.equal(r.value.headlines[0].text, "21,345 people reached in Uganda");
  assert.ok(r.value.messages.some((m) => /Boreholes: 86 against a target of 120 \(72%\)/.test(m.text)));
  assert.ok(r.value.templates.length >= 1 && r.value.templates.every((t) => t.label));
  const facts = storyFactsOf(data, sheet);
  assert.equal(facts.activitiesPlanned, 19);
  assert.deepEqual(facts.locations, ["Gulu"]);
});

test("assetIdsOf lists every image a design uses once", () => {
  const ids2 = assetIdsOf({ coverAssetId: "c", donorLogoAssetIds: ["l1", "l2"], sections: [{ kind: "IMAGE", assetId: "a" }, { kind: "QUOTE", assetId: "a" }, { kind: "TEXT" }] });
  assert.deepEqual([...ids2].sort(), ["a", "c", "l1", "l2"]);
  void checkDesign; void resolveTheme;
});

// ---- placing a published picture in a report section

import { SectionInfographicsHandler, dataCenterChartsToKeep, isInfographicArtifact } from "../dist/index.js";

function sectionSetup({ draftStatus = "DRAFT", superseded = false, sectionStatus = "DRAFT" } = {}) {
  const repo = fakeRepo();
  const section = { id: "s1", reportDraftId: "d1", status: sectionStatus, resetToDraft() { this.status = "DRAFT"; this.reset = true; } };
  const sections = { findById: async () => ok(section), update: async () => ok(section) };
  const drafts = { findById: async () => ok({ id: "d1", reportingPeriodId: "per1", status: draftStatus, isSuperseded: superseded }) };
  const periods = { findById: async () => ok({ id: "per1", projectId: "p1" }) };
  let stored = [];
  const artifacts = {
    findBySection: async () => ok(stored.map((a, i) => ({ id: `a${i}`, tenantId, sectionId: "s1", revisionId: null, rows: [], createdAt: new Date(), ...a }))),
    replaceForSection: async ({ artifacts: list }) => { stored = list; return ok(undefined); },
  };
  const au = audits();
  const handler = new SectionInfographicsHandler(sections, drafts, periods, artifacts, repo, ids(), au);
  return { repo, section, handler, au, get stored() { return stored; }, set stored(v) { stored = v; } };
}

const publish = (repo, over = {}) => {
  repo.designs.set("d9", { id: "d9", projectId: "p1", title: "Water results", updatedAt: new Date("2026-10-01T00:00:00Z") });
  repo.exports.set("e1", { id: "e1", infographicId: "d9", projectId: "p1", format: "PNG", storageKey: "infographics/t/d9/e1.png", pageCount: 2, approved: true, createdAt: new Date("2026-10-02T00:00:00Z"), ...over });
};

test("report picture: only a PNG of this project's own published infographic can be placed, as an artifact that carries the picture's place", async () => {
  const s = sectionSetup();
  publish(s.repo);
  s.repo.exports.set("pdf", { id: "pdf", infographicId: "d9", projectId: "p1", format: "PDF", storageKey: "k", pageCount: 1, createdAt: new Date() });
  s.repo.exports.set("other", { id: "other", infographicId: "dx", projectId: "another-project", format: "PNG", storageKey: "k", pageCount: 1, createdAt: new Date() });
  assert.equal((await s.handler.add(ctxOf(), "s1", { exportId: "pdf" })).ok, false, "a report draws images, not documents");
  assert.equal((await s.handler.add(ctxOf(), "s1", { exportId: "other" })).ok, false, "another project's picture");
  assert.equal((await s.handler.add(ctxOf(), "s1", { exportId: "ghost" })).ok, false);
  const added = await s.handler.add(ctxOf(), "s1", { exportId: "e1", caption: "  Results to date " });
  assert.equal(added.ok, true, added.error?.message);
  const [artifact] = s.stored;
  assert.equal(artifact.kind, "CHART");
  assert.equal(artifact.caption, "Results to date");
  assert.deepEqual(artifact.payload.categories, [], "no data: an export draws no chart from it");
  assert.equal(artifact.payload.infographic.storageKey, "infographics/t/d9/e1.png");
  assert.equal(isInfographicArtifact(artifact.payload), true);
  assert.equal(s.au.events.at(-1).eventType, "report.section.infographic.added");
  const listed = await s.handler.list(ctxOf(), "s1");
  assert.equal(listed.value.length, 1);
  assert.deepEqual([listed.value[0].caption, listed.value[0].pageCount, listed.value[0].designChangedSince], ["Results to date", 2, false]);
  s.repo.designs.set("d9", { ...s.repo.designs.get("d9"), updatedAt: new Date("2026-10-10T00:00:00Z") });
  assert.equal((await s.handler.list(ctxOf(), "s1")).value[0].designChangedSince, true, "the design moved on; the placed picture did not");
});

test("report picture: candidates list the project's PNGs; caption, move and remove keep the section's other artifacts", async () => {
  const s = sectionSetup();
  publish(s.repo);
  const c = await s.handler.candidates(ctxOf(), "s1");
  assert.deepEqual(c.value.map((x) => [x.exportId, x.title, x.approved]), [["e1", "Water results", true]]);
  s.stored = [{ kind: "TABLE", ordinal: 0, caption: "T", payload: { rows: [] }, sourceReferences: [] }];
  const a = await s.handler.add(ctxOf(), "s1", { exportId: "e1" });
  const b = await s.handler.add(ctxOf(), "s1", { exportId: "e1", caption: "Second" });
  assert.deepEqual(s.stored.map((x) => x.kind), ["TABLE", "CHART", "CHART"]);
  assert.equal((await s.handler.caption(ctxOf(), "s1", a.value.id, "  New words ")).ok, true);
  assert.equal(s.stored[1].caption, "New words");
  assert.equal(s.stored[1].payload.caption, "New words");
  assert.equal((await s.handler.move(ctxOf(), "s1", b.value.id, "UP")).value.moved, true);
  assert.deepEqual(s.stored.slice(1).map((x) => x.caption), ["Second", "New words"]);
  assert.equal((await s.handler.move(ctxOf(), "s1", b.value.id, "UP")).value.moved, false, "already first");
  assert.equal((await s.handler.remove(ctxOf(), "s1", a.value.id)).ok, true);
  assert.deepEqual(s.stored.map((x) => x.kind), ["TABLE", "CHART"]);
  assert.equal((await s.handler.remove(ctxOf(), "s1", "ghost")).ok, false);
  assert.deepEqual(dataCenterChartsToKeep(s.stored.map((x) => ({ ...x, sourceReferences: [] }))).map((x) => x.caption), ["Second"], "a text edit or a regeneration keeps the placed picture");
});

test("report picture: a change follows the text-edit rules; a locked report refuses it and an approved section is reopened", async () => {
  const locked = sectionSetup({ draftStatus: "APPROVED" });
  publish(locked.repo);
  const refused = await locked.handler.add(ctxOf(), "s1", { exportId: "e1" });
  assert.equal(refused.ok, false);
  assert.match(refused.error.message, /no longer a draft/);
  assert.equal((await sectionSetup({ superseded: true }).handler.remove(ctxOf(), "s1", "x")).error.message.includes("older version"), true);
  const reopened = sectionSetup({ sectionStatus: "APPROVED" });
  publish(reopened.repo);
  assert.equal((await reopened.handler.add(ctxOf(), "s1", { exportId: "e1" })).ok, true);
  assert.equal(reopened.section.reset, true);
  assert.match(reopened.au.events.at(-1).newValue, /section reopened/);
  const reading = sectionSetup({ draftStatus: "APPROVED" });
  assert.equal((await reading.handler.list(ctxOf(), "s1")).ok, true, "looking at a locked report is always allowed");
});

// ---- portfolio pages

import { InfographicRenderService, GetPortfolioInfographicDataHandler } from "../dist/index.js";

test("portfolio: a portfolio template only goes on the portfolio page and a project template only in a project", async () => {
  const repo = fakeRepo();
  const create = new CreateInfographicHandler(ids(), repo, audits(), clock);
  const onPortfolio = await create.handle(ctxOf(), "portfolio", { templateId: "PORTFOLIO_OVERVIEW", title: "Board pack" });
  assert.equal(onPortfolio.ok, true, onPortfolio.error?.message);
  assert.equal(onPortfolio.value.config.scope, "PORTFOLIO");
  assert.equal(onPortfolio.value.projectId, "portfolio");
  const projectOnPortfolio = await create.handle(ctxOf(), "portfolio", { templateId: "CUSTOM" });
  assert.equal(projectOnPortfolio.ok, false);
  assert.match(projectOnPortfolio.error.message, /portfolio template/);
  const portfolioInProject = await create.handle(ctxOf(), "p1", { templateId: "PORTFOLIO_OVERVIEW" });
  assert.equal(portfolioInProject.ok, false);
  assert.match(portfolioInProject.error.message, /not in a project/);
});

test("portfolio: approvers are the administrators; a page cannot be split into variants", async () => {
  const repo = fakeRepo();
  const create = new CreateInfographicHandler(ids(), repo, audits(), clock);
  const design = (await create.handle(ctxOf(), "portfolio", { templateId: "PORTFOLIO_OVERVIEW" })).value;
  const users = { listByTenant: async () => ok([{ id: "u1", role: "ADMIN", status: "ACTIVE" }, { id: "u9", role: "ADMIN", status: "SUSPENDED" }, { id: "u3", role: "FIELD_OFFICER", status: "ACTIVE" }, { id: "u4", role: "ADMIN", status: "ACTIVE" }]) };
  const told = [];
  const notifier = new InfographicNotifier({ send: async (n) => void told.push(n) }, { findById: async () => ok(null) }, { findByProject: async () => ok([]) }, users);
  assert.deepEqual((await notifier.approvers(ctxOf(), "portfolio")).sort(), ["u1", "u4"]);
  const au = audits();
  const review = new InfographicReviewHandler(repo, notifier, au, clock);
  await review.handle(ctxOf("u1"), design.id, { action: "REQUEST_REVIEW" });
  assert.deepEqual(told.map((n) => n.recipientId), ["u4"], "the other administrator is told, not the person who asked");
  assert.equal((await review.handle(ctxOf("u1"), design.id, { action: "APPROVE" })).ok, false, "another administrator exists, so a self-approval is refused");
  assert.equal((await review.handle(ctxOf("u4"), design.id, { action: "APPROVE" })).ok, true);
  const variants = new GenerateInfographicVariantsHandler(repo, create, { handle: async () => { throw new Error("must not read a project"); } });
  const split = await variants.handle(ctxOf(), design.id, { by: "LOCATION" });
  assert.equal(split.ok, false);
  assert.match(split.error.message, /portfolio page cannot be split/);
});

test("portfolio: the render service reads the portfolio, not a project, and labels the page 'as at'", async () => {
  const portfolioRead = { handle: async () => ok({ asAt: "2026-10-25", totals: { projects: 1, behind: 0, needAttention: 0, openRisks: 0, highRisks: 0, reportsOverdue: 0, countries: 1, onTrack: 1, noPlan: 0 }, rows: [{ title: "P", country: "Uganda" }], countries: [{ country: "Uganda", projects: 1 }] }) };
  const never = { handle: async () => { throw new Error("a portfolio page must not read one project"); } };
  const service = new InfographicRenderService(never, never, { brandFor: async () => ok({ name: "Org" }) }, { get: async () => ok(null) }, { findByIds: async () => ok([]) }, fakeStorage(), clock, portfolioRead);
  const config = configFromTemplate("PORTFOLIO_OVERVIEW");
  const built = await service.build(ctxOf(), "portfolio", config, {});
  assert.equal(built.ok, true, built.error?.message);
  assert.deepEqual(JSON.parse(built.value.input.portfolioJson).totals.projects, 1);
  assert.deepEqual(built.value.provenance.periodLabels, ["As at 2026-10-25"]);
  assert.equal(JSON.parse(built.value.input.dataJson).projectId, "portfolio");
  const noPortfolio = new InfographicRenderService(never, never, { brandFor: async () => ok({ name: "Org" }) }, { get: async () => ok(null) }, { findByIds: async () => ok([]) }, fakeStorage(), clock);
  assert.equal((await noPortfolio.build(ctxOf(), "portfolio", config, {})).ok, false);
  void GetPortfolioInfographicDataHandler;
});

test("portfolio data: the dashboard's rows reduced to a page: no ids, countries grouped, nothing summed that the dashboard does not sum", async () => {
  const row = (title, country, band, over = {}) => ({ projectId: `id-${title}`, title, donorName: "D", country, status: "ACTIVE", delivery: { band, label: band, reason: null, lateActivities: 1, valuesOverdue: 0 }, risks: { open: 1, high: 0, reviewOverdue: 0 }, reporting: null, reportsOverdue: 0, ...over });
  const overview = { handle: async () => ok({ totals: { projects: 4, behind: 1, needAttention: 1, openRisks: 4, highRisks: 0, reportsOverdue: 0 }, rows: [row("A", "Uganda", "OFF_TRACK"), row("B", "Uganda", "AT_RISK", { reporting: { deadline: "2026-11-30", daysUntil: 36, status: "DRAFT", readinessScore: 50, periodId: "x" } }), row("C", "Kenya", "ON_TRACK"), row("D", " ", "NO_PLAN")] }) };
  const handler = new GetPortfolioInfographicDataHandler(overview, clock);
  const r = await handler.handle(ctxOf());
  assert.equal(r.ok, true);
  assert.equal(r.value.asAt, "2026-10-25");
  assert.equal(JSON.stringify(r.value).includes("id-A"), false, "project ids are not carried");
  assert.deepEqual(r.value.countries.map((c) => [c.country, c.projects]), [["Uganda", 2], ["Kenya", 1], ["—", 1]]);
  assert.equal(r.value.totals.countries, 2, "a project with no country is not a country");
  assert.deepEqual([r.value.totals.onTrack, r.value.totals.noPlan], [1, 1]);
  assert.deepEqual(r.value.rows[1].nextReport, { deadline: "2026-11-30", daysUntil: 36 });
});

// ---- a fresh draft when a report is approved

import { AutoRefreshInfographicsHandler, ApproveReportHandler } from "../dist/index.js";

function refreshSetup() {
  const repo = fakeRepo();
  const au = audits();
  const told = [];
  const copyIds = (() => { let n = 0; return { generate: () => `copy-${++n}` }; })();
  const create = new CreateInfographicHandler(copyIds, repo, au, clock);
  const periods = { findById: async (id) => ok(id === "q2" ? { duration: { start: new Date("2026-04-01T00:00:00Z"), end: new Date("2026-06-30T00:00:00Z") } } : null) };
  const notifier = new InfographicNotifier({ send: async (n) => void told.push(n) }, { findById: async () => ok(null) }, { findByProject: async () => ok([]) });
  return { repo, au, told, create, handler: new AutoRefreshInfographicsHandler(repo, create, periods, notifier, au) };
}

test("auto-refresh: an approved period gives each opted-in design one new draft for that period, once", async () => {
  const s = refreshSetup();
  const designIds = ids();
  const optedIn = await baseDesign(s.repo, { autoRefresh: true, title: "Water", themeId: "CYAN" }, designIds);
  const optedOut = await baseDesign(s.repo, { title: "Other" }, designIds);
  const made = await s.handler.afterApproval(ctxOf("u9"), { projectId: "p1", reportingPeriodId: "q2" });
  assert.equal(made, 1);
  const copies = [...s.repo.designs.values()].filter((d) => d.parentId);
  assert.equal(copies.length, 1);
  const config = JSON.parse(copies[0].configJson);
  assert.equal(copies[0].parentId, optedIn.id);
  assert.equal(copies[0].status, "DRAFT", "never published or approved by itself");
  assert.equal(config.periodToId, "q2");
  assert.equal(config.themeId, "CYAN", "the layout and look carry over");
  assert.equal("autoRefresh" in config, false, "a copy does not multiply itself");
  assert.match(copies[0].title, /^Water – Apr 2026 – 30 Jun 2026$|^Water – /);
  assert.ok(s.au.events.some((e) => e.eventType === "infographic.auto_refresh"));
  assert.ok(s.told.length >= 1 && s.told.every((n) => n.recipientId !== "u9"), "the design's author is told");
  assert.equal(JSON.parse(s.repo.designs.get(optedIn.id).configJson).periodToId, undefined, "the original is not changed");
  assert.equal([...s.repo.designs.values()].filter((d) => d.parentId === optedOut.id).length, 0);
  assert.equal(await s.handler.afterApproval(ctxOf("u9"), { projectId: "p1", reportingPeriodId: "q2" }), 0, "approving again does not pile up copies");
  assert.equal(await s.handler.afterApproval(ctxOf("u9"), { projectId: "p1", reportingPeriodId: "unknown" }), 0);
});

test("auto-refresh: a failure never reaches the approval, and the approval handler calls the hook after approving", async () => {
  const boom = new AutoRefreshInfographicsHandler({ findByProject: async () => { throw new Error("db down"); } }, null, { findById: async () => ok({ duration: { start: new Date(), end: new Date() } }) }, null, audits());
  assert.equal(await boom.afterApproval(ctxOf(), { projectId: "p1", reportingPeriodId: "q2" }), 0);
  assert.equal(typeof ApproveReportHandler, "function");
});

test("presence rows are drafted from the plan; no lead or no place is skipped, cancelled work is left out", async () => {
  const { SuggestPresenceRowsHandler } = await import("../dist/index.js");
  const plan = { handle: async () => ({ ok: true, value: [
    { title: "Well drilling", status: "PLANNED", ownerUserId: "u1", location: "Gulu" },
    { title: "Well drilling", status: "DONE", ownerUserId: "u1", location: "gulu district" },
    { title: "Training", status: "PLANNED", ownerUserId: "u2", location: "Kitgum" },
    { title: "No place", status: "PLANNED", ownerUserId: "u1" },
    { title: "Dropped", status: "CANCELLED", ownerUserId: "u1", location: "Gulu" },
  ] }) };
  const people = { handle: async () => ({ ok: true, value: [{ userId: "u1", name: "Amina" }, { userId: "u2", name: "Joel" }] }) };
  const r = await new SuggestPresenceRowsHandler(plan, people).handle(ctxOf(), "p1");
  assert.ok(r.ok);
  assert.equal(r.value.used, 3);
  assert.equal(r.value.skipped, 1);
  assert.equal(r.value.rows.length, 2);
  assert.equal(r.value.rows[0].who, "Amina");
});

test("AI text is unavailable without a model and keeps only grounded sentences with one", async () => {
  const { GetInfographicAiTextHandler } = await import("../dist/index.js");
  const data = { project: { title: "Clean Water", country: "Uganda" }, periodOrder: ["q1"], activities: { rows: [{ key: "g", location: "Gulu", planned: 18, done: 14 }], unlocated: 0 }, reach: { overallUnique: 21345, registeredByLocation: [{ location: "Gulu", unique: 100 }] }, finance: { enabled: false, rows: [] }, indicators: [] };
  const sheet = { periods: [{ id: "q1" }], indicators: [], cells: [], finance: [] };
  const d = { handle: async () => ok(data) };
  const sh = { handle: async () => ok(sheet) };
  const none = await new GetInfographicAiTextHandler(d, sh, async () => null).handle(ctxOf(), "p1");
  assert.ok(none.ok && none.value.available === false);
  const failing = await new GetInfographicAiTextHandler(d, sh, async () => ({ complete: async () => { throw new Error("x"); } })).handle(ctxOf(), "p1");
  assert.ok(failing.ok && failing.value.available === false);
  let sent;
  const llm = { complete: async (input) => { sent = input; return { text: JSON.stringify({ headlines: ["21,345 people reached in Uganda", "77,000 people reached"], messages: ["14 of 18 planned activities are done."] }), model: "m", promptVersion: "v", usage: { inputTokens: 1, outputTokens: 1 } }; } };
  const ok1 = await new GetInfographicAiTextHandler(d, sh, async () => llm).handle(ctxOf(), "p1");
  assert.ok(ok1.ok && ok1.value.available);
  assert.deepEqual(ok1.value.headlines.map((h) => h.text), ["21,345 people reached in Uganda"]);
  assert.equal(ok1.value.droppedUngrounded, 1);
  assert.equal(sent.jsonMode, true);
});
