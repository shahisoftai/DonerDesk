// The setup wizard's repositories on a scratch Postgres (Phase 36.1). Opt-in: SETUP_VERIFY_DATABASE_URL
// (a throwaway database that has had `prisma migrate deploy` and `infra/postgres/rls.sql` run).
import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { TenantId } from "@donordesk/domain";
import { PrismaSetupProposalRepository, PrismaSetupRunRepository, PrismaPendingMemberRepository } from "../dist/repositories/project-setup.js";
import { emptyExtras } from "@donordesk/domain";

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

// ---------- the wizard's decisions (Phase 38) ----------

test("the decisions are stored beside the proposal; update never writes them; updateExtras writes only them, and only against the version read", { skip }, withDb(async (tx) => {
  const repo = new PrismaSetupProposalRepository(tx);
  await repo.create(makeProposal("psp-x1", { status: "READY" }));
  const legacy = await repo.findById("psp-x1", T);
  assert.equal(legacy.value.extras, undefined, "a proposal made before the wizard has no decisions, not a half-empty object");

  const extras = { ...emptyExtras(false), start: { withDocuments: false, donor: "EU", sector: "WASH", country: "Uganda" } };
  assert.equal((await repo.updateExtras("psp-x1", T, extras, NOW)).value, true);
  const read = await repo.findById("psp-x1", T);
  assert.deepEqual(read.value.extras.start, { withDocuments: false, donor: "EU", sector: "WASH", country: "Uganda" });
  assert.equal(read.value.status, "READY", "only the decisions changed");

  // A running extraction saves the proposal it read earlier: it must not undo the decisions made meanwhile.
  const stale = { ...read.value, status: "EXTRACTING", extras: undefined };
  assert.equal((await repo.update(stale)).value, true);
  const after = await repo.findById("psp-x1", T);
  assert.equal(after.value.status, "EXTRACTING");
  assert.equal(after.value.extras.start.donor, "EU", "update left the decisions alone");

  // Saving the decisions against an old version is refused, so two tabs cannot overwrite each other.
  assert.equal((await repo.updateExtras("psp-x1", T, { ...extras, projectArea: "x" }, NOW)).value, false);
  assert.equal((await repo.updateExtras("psp-x1", T, { ...extras, projectArea: "x" }, after.value.updatedAt)).value, true);
  assert.equal((await repo.findById("psp-x1", T)).value.extras.projectArea, "x");
  assert.equal((await repo.updateExtras("psp-x1", TenantId.create("tenant-setup-other"), extras, after.value.updatedAt)).value, false, "another tenant cannot write them");
}));

// ---------- people named before they have an account (Phase 38.9c) ----------

const pm = (extra = {}) => ({ id: "pm-1", tenantId: T.toString(), projectId: "proj-1", email: "pat@x.org", name: "Pat", role: "PROJECT_MANAGER", createdById: "u1", responsibilitiesJson: '[{"kind":"INDICATOR_OWNER","indicatorCode":"I1"}]', createdAt: NOW, ...extra });

test("a pending member is stored once per project and email, found by email across projects, and removed", { skip }, withDb(async (tx) => {
  const repo = new PrismaPendingMemberRepository(tx);
  assert.equal((await repo.create(pm())).ok, true);
  assert.equal((await repo.create(pm({ id: "pm-2", projectId: "proj-2" }))).ok, true);
  assert.equal((await repo.find(T.toString(), "proj-1", "pat@x.org")).value.name, "Pat");
  assert.equal((await repo.find(T.toString(), "proj-9", "pat@x.org")).value, null);
  const byEmail = (await repo.listByEmail(T.toString(), "pat@x.org")).value;
  assert.deepEqual(byEmail.map((m) => m.projectId), ["proj-1", "proj-2"]);
  assert.equal(byEmail[0].responsibilitiesJson, pm().responsibilitiesJson);
  assert.equal((await repo.listByEmail("other-tenant", "pat@x.org")).value.length, 0, "never across organisations");
  await repo.delete("pm-1", "other-tenant");
  assert.equal((await repo.listByEmail(T.toString(), "pat@x.org")).value.length, 2, "another tenant cannot delete it");
  await repo.delete("pm-1", T.toString());
  assert.deepEqual((await repo.listByEmail(T.toString(), "pat@x.org")).value.map((m) => m.id), ["pm-2"]);
  // Last, because a refused duplicate aborts the surrounding transaction.
  assert.equal((await repo.create(pm({ id: "pm-dup", projectId: "proj-2" }))).ok, false, "the same person is not stored twice for one project");
}));

test("only setups that read documents count towards the daily cap: a draft started with no documents does not", { skip }, withDb(async (tx) => {
  const repo = new PrismaSetupProposalRepository(tx);
  await repo.create(makeProposal("psp-cap-doc"));
  await repo.create(makeProposal("psp-cap-blank-1", { sourceName: "", sourceStorageKey: "", sourceHash: "", sourceLength: 0, status: "READY" }));
  await repo.create(makeProposal("psp-cap-blank-2", { sourceName: "", sourceStorageKey: "", sourceHash: "", sourceLength: 0, status: "READY" }));
  assert.equal((await repo.countStartedSince(T, new Date(NOW.getTime() - 1000))).value, 1);
}));
