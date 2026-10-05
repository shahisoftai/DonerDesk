import assert from "node:assert/strict";
import test from "node:test";
import { CreateActivityUpdateHandler, UpdateActivityHandler, ActivityLinkResolver, ListLogframeHandler } from "../dist/index.js";
import { TenantId, ActivityUpdate } from "@donordesk/domain";

const ctx = { tenant: { tenantId: TenantId.create("tenant-a"), userId: "u", role: "ADMIN" }, requestId: "r" };
const items = [
  { id: "oc", level: "OUTCOME", title: "Outcome" },
  { id: "o1", parentId: "oc", level: "OUTPUT", title: "Teachers trained" },
  { id: "o2", parentId: "oc", level: "OUTPUT", title: "Classrooms built" },
  { id: "a1", parentId: "o1", level: "ACTIVITY", title: "Run workshops" },
];
const logframe = { async findByProject() { return { ok: true, value: items }; } };
const audit = { events: [], async record(e) { this.events.push(e); } };
const links = new ActivityLinkResolver(logframe);
const base = { projectId: "p", reportingPeriodId: "rp", activityTitle: "Workshop", activityDate: new Date("2026-02-01").toISOString(), summary: "s", achievements: "", challenges: "", lessonsLearned: "", nextSteps: "", attachedEvidenceIds: [] };

function repo() {
  const rows = new Map();
  return { rows, async create(a) { rows.set(a.id, a); return { ok: true, value: a }; }, async update(a) { rows.set(a.id, a); return { ok: true, value: a }; }, async findById(id) { return { ok: true, value: rows.get(id) ?? null }; }, async findByProject() { return { ok: true, value: [...rows.values()] }; } };
}

test("creating with only the logframe activity derives the output", async () => {
  const r = repo();
  const out = await new CreateActivityUpdateHandler({ generate: () => "act-1" }, r, audit, links).handle(ctx, { ...base, logframeActivityId: "a1" });
  assert.equal(out.ok, true);
  assert.equal(r.rows.get("act-1").logframeActivityId, "a1");
  assert.equal(r.rows.get("act-1").outputId, "o1");
});

test("a node under another output is refused and nothing is saved", async () => {
  const r = repo();
  const out = await new CreateActivityUpdateHandler({ generate: () => "act-1" }, r, audit, links).handle(ctx, { ...base, logframeActivityId: "a1", outputId: "o2" });
  assert.equal(out.ok, false);
  assert.equal(out.error.code, "VALIDATION_FAILED");
  assert.equal(r.rows.size, 0);
});

test("without any logframe item no lookup happens (legacy behaviour unchanged)", async () => {
  let lookups = 0;
  const counting = new ActivityLinkResolver({ async findByProject() { lookups += 1; return { ok: true, value: [] }; } });
  const r = repo();
  const out = await new CreateActivityUpdateHandler({ generate: () => "act-1" }, r, audit, counting).handle(ctx, base);
  assert.equal(out.ok, true);
  assert.equal(lookups, 0);
});

test("editing: changing the output of a linked activity re-checks the pair; linking later derives the output", async () => {
  const r = repo();
  await new CreateActivityUpdateHandler({ generate: () => "act-1" }, r, audit, links).handle(ctx, { ...base, logframeActivityId: "a1" });
  const h = new UpdateActivityHandler(r, { async findById() { return { ok: true, value: null }; } }, audit, links);
  const bad = await h.handle(ctx, { activityId: "act-1", patch: { outputId: "o2" } });
  assert.equal(bad.ok, false);
  const r2 = repo();
  await new CreateActivityUpdateHandler({ generate: () => "act-2" }, r2, audit, links).handle(ctx, base);
  const ok = await new UpdateActivityHandler(r2, {}, audit, links).handle(ctx, { activityId: "act-2", patch: { logframeActivityId: "a1" } });
  assert.equal(ok.ok, true);
  assert.equal(r2.rows.get("act-2").outputId, "o1");
});

test("the logframe read model gives ACTIVITY nodes their delivery and leaves other levels alone", async () => {
  const r = repo();
  const accepted = ActivityUpdate.create({ id: "x", tenantId: "tenant-a", projectId: "p", reportingPeriodId: "rp", activityTitle: "W", activityDate: new Date("2026-02-01"), logframeActivityId: "a1", participantsTotal: 20, summary: "s", achievements: "", challenges: "", lessonsLearned: "", nextSteps: "", submittedById: "u" });
  accepted.submit(); accepted.accept();
  r.rows.set("x", accepted);
  const lf = { async findByProject() { return { ok: true, value: items.map((i, n) => ({ ...i, sortOrder: n, createdAt: new Date(2026, 0, n + 1) })) }; } };
  const res = await new ListLogframeHandler(lf, { async findByProject() { return { ok: true, value: [] }; } }, r).handle(ctx, "p");
  const byId = Object.fromEntries(res.value.items.map((i) => [i.id, i]));
  assert.deepEqual(byId.a1.delivery, { recordedCount: 1, acceptedCount: 1, lastActivityDate: "2026-02-01T00:00:00.000Z", participantsTotal: 20 });
  assert.equal(byId.o1.delivery, undefined);
});
