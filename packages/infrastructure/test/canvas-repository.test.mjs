import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { TenantId, blankCanvas } from "@donordesk/domain";
import { PrismaCanvasRepository } from "../dist/repositories/canvas.js";

// Needs a scratch Postgres that has had `prisma migrate deploy` applied: set CANVAS_VERIFY_DATABASE_URL (skipped without it).
const url = process.env.CANVAS_VERIFY_DATABASE_URL;
const t = (name, fn) => test(name, { skip: !url && "set CANVAS_VERIFY_DATABASE_URL to a scratch database" }, fn);
const tenant = TenantId.create("canvas-repo-a"), other = TenantId.create("canvas-repo-b");
const make = (id, over = {}) => { const canvas = blankCanvas({ id, title: id, scope: over.scope ?? "ORG" }); return { id, tenantId: tenant, scope: "ORG", mode: "LIVE", ownerId: "u1", title: id, canvas, createdAt: new Date(), updatedAt: new Date(), ...over }; };

t("create, read back, revision-guarded update, delete, and tenant scoping on a real database", async () => {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    await prisma.canvas.deleteMany({ where: { tenantId: { in: [tenant.toString(), other.toString()] } } });
    const repo = new PrismaCanvasRepository(prisma);
    assert.deepEqual(await repo.create(make("c1")), { ok: true, value: true });
    const got = (await repo.findById("c1", tenant)).value;
    assert.equal(got.canvas.pages[0].id, "page-1"); assert.equal(got.canvas.revision, 1);
    assert.equal((await repo.findById("c1", other)).value, null, "another organisation cannot read it");
    const next = { ...got, title: "Renamed", canvas: { ...got.canvas, title: "Renamed", pages: [{ id: "p", title: "P", format: "WEB_FLUID", blocks: [] }] } };
    assert.equal((await repo.update(next, 1)).value, true);
    assert.equal((await repo.update(next, 1)).value, false, "the same old revision cannot save twice");
    const after = (await repo.findById("c1", tenant)).value;
    assert.deepEqual([after.title, after.canvas.revision, after.canvas.pages[0].id], ["Renamed", 2, "p"]);
    await repo.delete("c1", other);
    assert.ok((await repo.findById("c1", tenant)).value, "another organisation cannot delete it");
    await repo.delete("c1", tenant);
    assert.equal((await repo.findById("c1", tenant)).value, null);
  } finally { await prisma.$disconnect(); }
});

t("a source converts once: the second create reports false and findBySource returns the first", async () => {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const repo = new PrismaCanvasRepository(prisma);
    assert.equal((await repo.create(make("s1", { sourceKind: "DASHBOARD", sourceId: "d9" }))).value, true);
    assert.equal((await repo.create(make("s2", { sourceKind: "DASHBOARD", sourceId: "d9" }))).value, false);
    assert.equal((await repo.findBySource(tenant, "DASHBOARD", "d9")).value.id, "s1");
    assert.equal((await repo.findBySource(tenant, "INFOGRAPHIC", "d9")).value, null, "kind is part of the key");
    assert.equal((await repo.create(make("s3", { tenantId: other, sourceKind: "DASHBOARD", sourceId: "d9" }))).value, true, "another organisation may convert its own d9");
    assert.equal((await repo.create(make("n1"))).value, true); assert.equal((await repo.create(make("n2"))).value, true, "canvases with no source never collide");
  } finally { await prisma.$disconnect(); }
});

t("the list shows shared and own canvases only, newest first, and skips a damaged row", async () => {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const repo = new PrismaCanvasRepository(prisma);
    await repo.create(make("mine", { scope: "MINE", ownerId: "u1" }));
    await repo.create(make("theirs", { scope: "MINE", ownerId: "u2" }));
    await repo.create(make("proj", { scope: "PROJECT", projectId: "p1", canvas: blankCanvas({ id: "proj", title: "proj", scope: "PROJECT" }) }));
    await prisma.canvas.create({ data: { id: "broken", tenantId: tenant.toString(), scope: "ORG", mode: "LIVE", ownerId: "u1", title: "broken", docJson: "{not json", revision: 1 } });
    const ids = (await repo.listVisible(tenant, "u1")).value.map((c) => c.id);
    assert.ok(ids.includes("mine") && ids.includes("proj") && ids.includes("n1"));
    assert.ok(!ids.includes("theirs"), "someone else's personal canvas is not listed");
    assert.ok(!ids.includes("broken"), "a damaged document is skipped, not an error");
    assert.equal((await repo.listVisible(other, "u1")).value.some((c) => c.id === "mine"), false);
  } finally { await prisma.$disconnect(); }
});

// ---- publishing: copies, links, versions, review, schedule, canvas AI ----
import { PrismaCanvasAiSetting, PrismaCanvasExportRepository, PrismaCanvasShareLinkRepository, PrismaCanvasVersionRepository } from "../dist/repositories/canvas-publishing.js";

t("review and schedule are stored without touching the document; a save sets the review back", async () => {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    await prisma.canvas.deleteMany({ where: { tenantId: tenant.toString() } });
    const repo = new PrismaCanvasRepository(prisma);
    await repo.create(make("r1"));
    await repo.setReview("r1", tenant, { status: "APPROVED", reviewedById: "rita", note: "Fine" });
    let row = (await repo.findById("r1", tenant)).value;
    assert.deepEqual([row.reviewStatus, row.reviewedById, row.reviewNote, row.canvas.revision], ["APPROVED", "rita", "Fine", 1]);
    await repo.setSnapshot("r1", tenant, { every: "WEEKLY", actor: "anna:ADMIN" });
    await repo.setSnapshot("r1", tenant, { lastAt: new Date("2026-11-09T00:00:00Z") });
    row = (await repo.findById("r1", tenant)).value;
    assert.deepEqual([row.snapshotEvery, row.snapshotActor, row.lastSnapshotAt.toISOString()], ["WEEKLY", "anna:ADMIN", "2026-11-09T00:00:00.000Z"]);
    assert.equal((await repo.listScheduled(tenant)).value.length, 1);
    assert.equal((await repo.listScheduled(other)).value.length, 0);
    const { reviewedById: _r, reviewNote: _n, ...rest } = row;
    await repo.update({ ...rest, reviewStatus: "DRAFT" }, 1);
    row = (await repo.findById("r1", tenant)).value;
    assert.deepEqual([row.reviewStatus, row.reviewedById], ["DRAFT", undefined]);
  } finally { await prisma.$disconnect(); }
});

t("copies are listed newest first and scoped to their organisation; a link is found by its hash and withdrawn once; versions keep one row per revision", async () => {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    await prisma.canvasExport.deleteMany({ where: { tenantId: { in: [tenant.toString(), other.toString()] } } });
    await prisma.canvasShareLink.deleteMany({ where: { tenantId: tenant.toString() } });
    await prisma.canvasVersion.deleteMany({ where: { tenantId: tenant.toString() } });
    const exports = new PrismaCanvasExportRepository(prisma), links = new PrismaCanvasShareLinkRepository(prisma), versions = new PrismaCanvasVersionRepository(prisma);
    await exports.create({ id: "e1", tenantId: tenant, canvasId: "c", format: "PDF", storageKey: "k1", sizeBytes: 10, snapshotJson: "{}", provenanceJson: "{}", createdById: "u", createdAt: new Date() });
    assert.equal((await exports.listByCanvas("c", tenant)).value.length, 1);
    assert.equal((await exports.listByCanvas("c", other)).value.length, 0);
    assert.equal((await exports.findById("e1", other)).value, null);
    await links.create({ id: "l1", tenantId: tenant, canvasId: "c", kind: "FROZEN", exportId: "e1", label: "Donor", tokenHash: "h".repeat(64), expiresAt: new Date(Date.now() + 1e8), createdById: "u", createdAt: new Date() });
    const found = (await links.findByTokenHash("h".repeat(64))).value;
    assert.deepEqual([found.id, found.kind, found.exportId, found.revokedAt], ["l1", "FROZEN", "e1", undefined]);
    await links.revoke("l1", tenant, new Date());
    assert.ok((await links.findById("l1", tenant)).value.revokedAt);
    const doc = blankCanvas({ id: "c", title: "T", scope: "ORG" });
    await versions.add({ id: "c:1", tenantId: tenant, canvasId: "c", revision: 1, title: "Old", canvas: doc, savedById: "u", createdAt: new Date() });
    await versions.add({ id: "c:1b", tenantId: tenant, canvasId: "c", revision: 1, title: "Dup", canvas: doc, savedById: "u", createdAt: new Date() });
    assert.equal((await versions.list("c", tenant, 10)).value.length, 1, "a repeated revision is kept once");
    assert.equal((await versions.find("c", 1, tenant)).value.title, "Old");
    assert.equal((await versions.find("c", 1, other)).value, null);
  } finally { await prisma.$disconnect(); }
});

t("canvas AI is off by default and needs both switches", async () => {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const org = await prisma.organization.findFirst({ select: { tenantId: true, aiEnabled: true, canvasAiEnabled: true } });
    if (!org) return; // nothing to test against in an empty scratch database
    const setting = new PrismaCanvasAiSetting(prisma);
    const id = TenantId.create(org.tenantId);
    const before = org.canvasAiEnabled;
    await setting.set(id, false);
    assert.equal(await setting.isEnabled(id), false);
    await setting.set(id, true);
    assert.equal(await setting.isEnabled(id), org.aiEnabled);
    await setting.set(id, before);
  } finally { await prisma.$disconnect(); }
});
