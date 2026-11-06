// Repository round-trip on a scratch Postgres. Opt-in: set INFOGRAPHIC_VERIFY_DATABASE_URL to a throwaway database that has
// had `prisma migrate deploy` run (see the scratch-DB note). Foreign keys are relaxed inside the transaction (superuser).
import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { TenantId } from "@donordesk/domain";
import { PrismaInfographicRepository, PrismaInfographicAssetRepository, PrismaBrandKitRepository, PrismaInfographicUserTemplateRepository, PrismaInfographicShareRepository } from "../dist/repositories/infographics.js";

const url = process.env.INFOGRAPHIC_VERIFY_DATABASE_URL;
const skip = url ? false : "INFOGRAPHIC_VERIFY_DATABASE_URL not set";
const T = TenantId.create("tenant-ig");
const OTHER = TenantId.create("tenant-other");

async function inRollback(prisma, work) {
  const sentinel = new Error("rollback");
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica");
      await work(tx);
      throw sentinel;
    });
  } catch (e) { if (e !== sentinel) throw e; }
}

const design = (over = {}) => ({ id: "d1", tenantId: "tenant-ig", projectId: "p1", title: "Water", templateId: "CUSTOM", templateVersion: 1, configJson: "{}", createdById: "u1", updatedById: "u1", createdAt: new Date("2026-10-25T00:00:00Z"), updatedAt: new Date("2026-10-25T00:00:00Z"), status: "DRAFT", selfApproved: false, ...over });

test("designs round-trip their review fields, and clearing an approval really clears it", { skip }, async () => {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    await inRollback(prisma, async (tx) => {
      const repo = new PrismaInfographicRepository(tx);
      await repo.create(design({ parentId: "d0" }));
      const approved = design({ status: "APPROVED", reviewRequestedById: "u1", reviewRequestedAt: new Date("2026-10-25T01:00:00Z"), approvedById: "u2", approvedAt: new Date("2026-10-25T02:00:00Z"), selfApproved: true, parentId: "d0" });
      await repo.update(approved);
      const back = (await repo.findById("d1", T)).value;
      assert.equal(back.status, "APPROVED");
      assert.equal(back.approvedById, "u2");
      assert.equal(back.selfApproved, true);
      assert.equal(back.parentId, "d0");
      assert.equal((await repo.findById("d1", OTHER)).value, null, "another organization cannot read it");
      const { approvedById: _a, approvedAt: _b, reviewRequestedById: _c, reviewRequestedAt: _d, ...cleared } = approved;
      await repo.update({ ...cleared, status: "DRAFT", selfApproved: false });
      const after = (await repo.findById("d1", T)).value;
      assert.equal(after.status, "DRAFT");
      assert.equal(after.approvedById, undefined, "an omitted field is written as null, not skipped");
      assert.equal(after.reviewRequestedAt, undefined);
      assert.equal(after.selfApproved, false);
    });
  } finally { await prisma.$disconnect(); }
});

test("exports keep page count, approval, description and waivers", { skip }, async () => {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    await inRollback(prisma, async (tx) => {
      const repo = new PrismaInfographicRepository(tx);
      const rec = { id: "e1", tenantId: "tenant-ig", infographicId: "d1", projectId: "p1", format: "PACK", storageKey: "k", sizeBytes: 10, snapshotJson: "{}", provenanceJson: "{}", generatedById: "u1", createdAt: new Date(), pageCount: 3, approved: true, altText: "A summary", waivedJson: '[{"ruleId":"X","note":"n"}]' };
      await repo.addExport(rec);
      const back = (await repo.findExportById("e1", T)).value;
      assert.deepEqual([back.format, back.pageCount, back.approved, back.altText, back.waivedJson], ["PACK", 3, true, "A summary", rec.waivedJson]);
      await repo.addExport({ ...rec, id: "e2", pageCount: 1, approved: false, altText: undefined, waivedJson: undefined, createdAt: new Date(Date.now() + 1000) });
      const list = (await repo.findExportsByInfographic("d1", T)).value;
      assert.deepEqual(list.map((x) => x.id), ["e2", "e1"], "newest first");
      assert.equal(list[0].altText, undefined);
    });
  } finally { await prisma.$disconnect(); }
});

test("assets: create, find by ids within the organization, archive", { skip }, async () => {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    await inRollback(prisma, async (tx) => {
      const repo = new PrismaInfographicAssetRepository(tx);
      const base = { tenantId: "tenant-ig", kind: "IMAGE", name: "Well", contentType: "image/png", storageKey: "k", width: 1, height: 1, sizeBytes: 3, createdById: "u1", createdAt: new Date() };
      await repo.create({ ...base, id: "a1", credit: "J" });
      await repo.create({ ...base, id: "a2", kind: "LOGO" });
      await repo.create({ ...base, id: "a3", tenantId: "tenant-other" });
      const found = (await repo.findByIds(["a1", "a2", "a3", "ghost"], T)).value;
      assert.deepEqual(found.map((x) => x.id).sort(), ["a1", "a2"], "another organization's image is invisible");
      assert.equal((await repo.findByIds([], T)).value.length, 0);
      await repo.archive("a1", T, new Date("2026-10-25T00:00:00Z"));
      assert.ok((await repo.findById("a1", T)).value.archivedAt);
      await repo.archive("a3", T, new Date());
      assert.equal((await repo.findById("a3", OTHER)).value.archivedAt, undefined, "archiving is scoped to the organization");
    });
  } finally { await prisma.$disconnect(); }
});

test("brand kit: one per organization, saving again replaces it", { skip }, async () => {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    await inRollback(prisma, async (tx) => {
      const repo = new PrismaBrandKitRepository(tx);
      assert.equal((await repo.get(T)).value, null);
      await repo.save(T, { primaryColor: "#0b66b3", footerLine: "a" }, "u1", "b1");
      await repo.save(T, { primaryColor: "#112233" }, "u2", "b2");
      assert.deepEqual((await repo.get(T)).value, { primaryColor: "#112233" });
      assert.equal(await tx.infographicBrandKit.count({ where: { tenantId: "tenant-ig" } }), 1);
      assert.equal((await repo.get(OTHER)).value, null);
    });
  } finally { await prisma.$disconnect(); }
});

test("saved layouts and share links: scoped by organization; the token is found only by its hash, and views count", { skip }, async () => {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    await inRollback(prisma, async (tx) => {
      const templates = new PrismaInfographicUserTemplateRepository(tx);
      await templates.create({ id: "t1", tenantId: "tenant-ig", name: "Mine", baseTemplateId: "CUSTOM", configJson: "{}", createdById: "u1", createdAt: new Date(), updatedAt: new Date() });
      assert.equal((await templates.list(T)).value.length, 1);
      assert.equal((await templates.list(OTHER)).value.length, 0);
      await templates.remove("t1", OTHER);
      assert.equal((await templates.list(T)).value.length, 1, "another organization cannot delete it");
      await templates.remove("t1", T);
      assert.equal((await templates.findById("t1", T)).value, null);

      const shares = new PrismaInfographicShareRepository(tx);
      const link = { id: "s1", tenantId: "tenant-ig", infographicId: "d1", exportId: "e1", tokenHash: "h".repeat(64), expiresAt: new Date("2026-12-01T00:00:00Z"), viewCount: 0, createdById: "u1", createdAt: new Date() };
      await shares.create(link);
      assert.equal((await shares.findByTokenHash("h".repeat(64))).value.id, "s1");
      assert.equal((await shares.findByTokenHash("x".repeat(64))).value, null);
      await shares.recordView("s1");
      await shares.recordView("s1");
      assert.equal((await shares.findByTokenHash("h".repeat(64))).value.viewCount, 2);
      await shares.revoke("s1", OTHER, new Date());
      assert.equal((await shares.findByTokenHash("h".repeat(64))).value.revokedAt, undefined, "another organization cannot revoke it");
      await shares.revoke("s1", T, new Date("2026-10-25T00:00:00Z"));
      assert.ok((await shares.listByInfographic("d1", T)).value[0].revokedAt);
    });
  } finally { await prisma.$disconnect(); }
});
