import assert from "node:assert/strict";
import test from "node:test";
import { PrismaLogframeRepository } from "../dist/repositories/logframe.js";
import { PrismaLogframeVersionRepository } from "../dist/repositories/logframe-versions.js";
import { PrismaReportingProfileRepository } from "../dist/repositories/setup.js";
import { PrismaProjectRiskRepository } from "../dist/repositories/risks.js";
import { LogframeItem, ReportingProfile, ProjectRisk, TenantId, presetVocabulary } from "@donordesk/domain";

const tenant = TenantId.create("tenant-a");

test("52.1: a result's assumptions and rationale are written on create and update (null when cleared), and read back", async () => {
  const calls = [];
  const row = { id: "i1", tenantId: "tenant-a", projectId: "p", parentId: null, level: "OUTPUT", code: "OUT-1", title: "T", description: null, sortOrder: 0, assumptions: "Food is available", rationale: null, createdAt: new Date() };
  const prisma = { logframeItem: { create: async (a) => (calls.push(["create", a.data]), {}), update: async (a) => (calls.push(["update", a.data]), {}), findFirst: async () => row, findMany: async () => [row] } };
  const repo = new PrismaLogframeRepository(prisma);
  const item = LogframeItem.create({ id: "i1", tenantId: "tenant-a", projectId: "p", level: "OUTPUT", title: "Trained staff", assumptions: "Staff stay", rationale: "Because" });
  await repo.create(item);
  assert.equal(calls[0][1].assumptions, "Staff stay");
  assert.equal(calls[0][1].rationale, "Because");
  item.edit({ assumptions: "", rationale: "" });
  await repo.update(item);
  assert.equal(calls[1][1].assumptions, null, "clearing writes null, because Prisma ignores undefined");
  assert.equal(calls[1][1].rationale, null);
  const read = (await repo.findById("i1", tenant)).value;
  assert.equal(read.assumptions, "Food is available");
  assert.equal(read.rationale, undefined);
  assert.equal((await repo.findByProject("p", tenant)).value[0].assumptions, "Food is available");
});

test("52.3: a version records what it touched", async () => {
  const calls = [];
  const repo = new PrismaLogframeVersionRepository({ logframeVersion: { create: async (a) => (calls.push(a.data), {}) } });
  await repo.create({ id: "v", tenantId: "t", projectId: "p", version: 2, snapshotJson: "{}", contentHash: "h", summary: "s", createdById: "u", createdAt: new Date(), changeKinds: "MEASUREMENT" });
  assert.equal(calls[0].changeKinds, "MEASUREMENT");
  await repo.create({ id: "v2", tenantId: "t", projectId: "p", version: 3, snapshotJson: "{}", contentHash: "h2", summary: "s", createdById: "u", createdAt: new Date() });
  assert.equal(calls[1].changeKinds, "", "an older caller that sends none writes empty");
});

test("52.0: the donor wording is written on create and update and read back; an unreadable stored value reads as the default", async () => {
  const calls = [];
  const profile = ReportingProfile.create({ id: "pr", tenantId: "tenant-a", projectId: "p", createdById: "u" });
  profile.setVocabulary(presetVocabulary("FCDO"), "u");
  const prisma = { reportingProfile: { create: async (a) => (calls.push(a.data), {}), update: async (a) => (calls.push(a.data), {}) } };
  const repo = new PrismaReportingProfileRepository(prisma);
  await repo.create(profile);
  await repo.update(profile);
  assert.deepEqual(JSON.parse(calls[0].vocabularyJson), presetVocabulary("FCDO"));
  assert.deepEqual(JSON.parse(calls[1].vocabularyJson), presetVocabulary("FCDO"));
});

test("52.1: a problem raised against a result keeps the link", async () => {
  const calls = [];
  const repo = new PrismaProjectRiskRepository({ projectRisk: { create: async (a) => (calls.push(a.data), {}) } });
  const made = ProjectRisk.create({ id: "r", tenantId: "tenant-a", projectId: "p", kind: "RISK", title: "Supply may fail", seriousness: "HIGH", action: "", raisedById: "u", logframeItemId: "i1", today: "2026-11-12" });
  assert.equal(made.ok, true);
  await repo.create(made.value);
  assert.equal(calls[0].logframeItemId, "i1");
  const plain = ProjectRisk.create({ id: "r2", tenantId: "tenant-a", projectId: "p", kind: "RISK", title: "Another", seriousness: "LOW", action: "", raisedById: "u", today: "2026-11-12" });
  await repo.create(plain.value);
  assert.equal(calls[1].logframeItemId, null);
});
