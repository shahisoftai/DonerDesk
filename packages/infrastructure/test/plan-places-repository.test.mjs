// Places an activity names (Phase 42.1) on a scratch Postgres: replace keeps the order chosen, a second call replaces rather than adds,
// the batch read groups by activity, and one organisation never reads another's links. Opt-in: PLACES_VERIFY_DATABASE_URL.
import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { TenantId } from "@donordesk/domain";
import { PrismaPlannedActivityPlaceRepository } from "../dist/repositories/work-plan/plan-places.js";

const url = process.env.PLACES_VERIFY_DATABASE_URL;
const skip = url ? false : "PLACES_VERIFY_DATABASE_URL not set";
const T = TenantId.create("tenant-pp");
const OTHER = TenantId.create("tenant-pp-other");

// The repository opens its own transaction, so these tests use the real client and remove the rows they made.
const withDb = (fn) => async () => {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const clean = () => prisma.plannedActivityPlace.deleteMany({ where: { tenantId: { in: ["tenant-pp", "tenant-pp-other"] } } });
  try { await clean(); await fn(prisma); } finally { await clean(); await prisma.$disconnect(); }
};
const save = (repo, activity, placeIds, tenantId = "tenant-pp") => repo.replace({ tenantId, projectId: "proj", plannedActivityId: activity, placeIds, userId: "u1", now: new Date("2026-11-04T08:00:00Z") });

test("replace keeps the order chosen and a second call replaces the set", { skip }, withDb(async (tx) => {
  const repo = new PrismaPlannedActivityPlaceRepository(tx);
  await save(repo, "act1", ["c", "a", "b"]);
  assert.deepEqual((await repo.findPlaceIds("act1", T)).value, ["c", "a", "b"]);
  await save(repo, "act1", ["b"]);
  assert.deepEqual((await repo.findPlaceIds("act1", T)).value, ["b"]);
  await save(repo, "act1", []);
  assert.deepEqual((await repo.findPlaceIds("act1", T)).value, []);
}));

test("the batch read groups by activity", { skip }, withDb(async (tx) => {
  const repo = new PrismaPlannedActivityPlaceRepository(tx);
  await save(repo, "act1", ["a", "b"]);
  await save(repo, "act2", ["c"]);
  const m = (await repo.findPlaceIdsFor(["act1", "act2", "act3"], T)).value;
  assert.deepEqual(m.get("act1"), ["a", "b"]);
  assert.deepEqual(m.get("act2"), ["c"]);
  assert.equal(m.has("act3"), false);
  assert.equal((await repo.findPlaceIdsFor([], T)).value.size, 0);
}));

test("another organisation reads nothing of these links", { skip }, withDb(async (tx) => {
  const repo = new PrismaPlannedActivityPlaceRepository(tx);
  await save(repo, "act1", ["a"]);
  assert.deepEqual((await repo.findPlaceIds("act1", OTHER)).value, []);
  assert.equal((await repo.findPlaceIdsFor(["act1"], OTHER)).value.size, 0);
}));
