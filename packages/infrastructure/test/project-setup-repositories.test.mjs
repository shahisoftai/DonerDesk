// The setup wizard's repositories on a scratch Postgres (Phase 36.1). Opt-in: SETUP_VERIFY_DATABASE_URL
// (a throwaway database that has had `prisma migrate deploy` and `infra/postgres/rls.sql` run).
import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { TenantId } from "@donordesk/domain";
import { PrismaSetupProposalRepository, PrismaSetupRunRepository } from "../dist/repositories/project-setup.js";

const url = process.env.SETUP_VERIFY_DATABASE_URL;
const skip = url ? false : "SETUP_VERIFY_DATABASE_URL not set";
const T = TenantId.create("tenant-setup");
const NOW = new Date("2026-10-30T08:00:00Z");
const LATER = new Date("2026-10-30T08:05:00Z");

const emptyFacts = () => ({
  name: { value: null, sourceQuote: null, sourceRef: null, confidence: "HIGH", status: "PROPOSED" },
  code: { value: null, sourceQuote: null, sourceRef: null, confidence: "HIGH", status: "PROPOSED" },
  donor: { value: null, sourceQuote: null, sourceRef: null, confidence: "HIGH", status: "PROPOSED" },
  countries: { value: null, sourceQuote: null, sourceRef: null, confidence: "HIGH", status: "PROPOSED" },
  sectors: { value: null, sourceQuote: null, sourceRef: null, confidence: "HIGH", status: "PROPOSED" },
  startDate: { value: null, sourceQuote: null, sourceRef: null, confidence: "HIGH", status: "PROPOSED" },
  endDate: { value: null, sourceQuote: null, sourceRef: null, confidence: "HIGH", status: "PROPOSED" },
  currency: { value: null, sourceQuote: null, sourceRef: null, confidence: "HIGH", status: "PROPOSED" },
  summary: { value: null, sourceQuote: null, sourceRef: null, confidence: "HIGH", status: "PROPOSED" },
});
const makeProposal = (id, extra = {}) => ({
  id,
  tenantId: T,
  createdById: "u1",
  status: "EXTRACTING",
  sourceName: "proposal.pdf",
  sourceStorageKey: `project-setup/${T.toString()}/${id}`,
  sourceHash: `hash-${id}`,
  sourceLength: 1234,
  proposal: { facts: emptyFacts(), logframe: [], indicators: [], periods: [], plan: [], places: [], funding: [], budget: [], risks: [] },
  problems: [],
  createdAt: NOW,
  updatedAt: NOW,
  expiresAt: new Date(NOW.getTime() + 30 * 24 * 60 * 60 * 1000),
  ...extra,
});

const withDb = (fn) => async () => {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const sentinel = new Error("rollback");
    try {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL "app.current_tenant" = '${T.toString()}'`);
        await fn(tx);
        throw sentinel;
      });
    } catch (e) { if (e !== sentinel) throw e; }
  } finally { await prisma.$disconnect(); }
};

test("a proposal round-trips: create, read, update with expected version, count, delete", { skip }, withDb(async (tx) => {
  const repo = new PrismaSetupProposalRepository(tx);
  const runs = new PrismaSetupRunRepository(tx);
  const p = makeProposal("psp-1");
  await repo.create(p);
  const read = await repo.findById("psp-1", T);
  assert.ok(read.value);
  assert.equal(read.value.status, "EXTRACTING");
  assert.equal(read.value.tenantId.toString(), T.toString());
  assert.equal(read.value.proposal.facts.name.value, null);
  assert.equal(read.value.expiresAt.getTime(), p.expiresAt.getTime());

  const ready = { ...p, status: "READY", model: "m-1", promptVersion: "v1", appliedProjectId: "proj-1", updatedAt: LATER };
  assert.equal((await repo.update(ready, NOW)).value, true, "the update lands against the expected version");
  const after = await repo.findById("psp-1", T);
  assert.equal(after.value.status, "READY");
  assert.equal(after.value.model, "m-1");
  assert.equal(after.value.appliedProjectId, "proj-1");
  assert.equal((await repo.update(ready, NOW)).value, false, "a stale version refuses the write");

  await runs.start({ id: "run-1", tenantId: T, proposalId: "psp-1", kind: "EXTRACT", area: "FACTS", status: "RUNNING", detail: {}, startedAt: NOW });
  await runs.finish("run-1", T, { checked: 2, dropped: 1 }, LATER);
  const listed = await runs.listByProposal("psp-1", T);
  assert.equal(listed.value.length, 1);
  assert.equal(listed.value[0].status, "FINISHED");
  assert.equal(listed.value[0].area, "FACTS");
  assert.deepEqual(listed.value[0].detail, { checked: 2, dropped: 1 });
  assert.equal(listed.value[0].finishedAt.getTime(), LATER.getTime());
  assert.equal((await runs.deleteByProposal("psp-1", T)).ok, true);
  assert.equal((await runs.listByProposal("psp-1", T)).value.length, 0);

  assert.equal((await repo.countStartedSince(T, new Date(NOW.getTime() - 1000))).value, 1);
  assert.equal((await repo.countStartedSince(T, new Date(NOW.getTime() + 60_000))).value, 0);
  await repo.delete("psp-1", T);
  assert.equal((await repo.findById("psp-1", T)).value, null);
}));

test("row-level security: another tenant's session sees nothing", { skip }, withDb(async (tx) => {
  const repo = new PrismaSetupProposalRepository(tx);
  await repo.create(makeProposal("psp-2"));
  await tx.$executeRawUnsafe(`SET LOCAL "app.current_tenant" = 'tenant-setup-other'`);
  assert.equal((await repo.findById("psp-2", TenantId.create("tenant-setup-other"))).value, null);
  assert.equal((await repo.countStartedSince(TenantId.create("tenant-setup-other"), new Date(0))).value, 0);
}));
