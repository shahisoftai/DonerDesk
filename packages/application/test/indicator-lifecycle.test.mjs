import assert from "node:assert/strict";
import test from "node:test";
import { Indicator, IndicatorUpdate, LogframeItem, TenantId } from "@donordesk/domain";
import { ArchiveIndicatorHandler, IndicatorApprovalGuard, MoveIndicatorHandler, RestoreIndicatorHandler, UpdateIndicatorHandler } from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ctx = { tenant: { tenantId, userId: "u-1", role: "ADMIN" }, requestId: "r" };

function indicator(over = {}) {
  return Indicator.create({ id: "i-1", tenantId: "tenant-a", projectId: "p-1", logframeItemId: "item-act", code: "IND1", name: "People", type: "NUMBER", baseline: "0", target: "100", ...over });
}
function item(id, projectId = "p-1") {
  return LogframeItem.create({ id, tenantId: "tenant-a", projectId, level: "OUTPUT", code: id, title: id, sortOrder: 0 });
}
function world({ indicators = [indicator()], items = [item("item-act"), item("item-out")], values = [], approved = false } = {}) {
  const I = new Map(indicators.map((i) => [i.id, i]));
  const deleted = [];
  const audit = { events: [], async record(e) { this.events.push(e); } };
  const repo = {
    async findById(id) { return { ok: true, value: I.get(id) ?? null }; },
    async update(i) { I.set(i.id, i); return { ok: true, value: i }; },
    async delete(id) { deleted.push(id); I.delete(id); return { ok: true, value: undefined }; },
  };
  const updates = { async findByIndicator(id) { return { ok: true, value: values.filter((v) => v.indicatorId === id) }; } };
  const itemsRepo = { async findById(id) { return { ok: true, value: items.find((x) => x.id === id) ?? null }; } };
  const guard = { async isUsedInApprovedReport() { return { ok: true, value: approved }; } };
  return { I, deleted, audit, repo, updates, itemsRepo, guard };
}
const value = () => IndicatorUpdate.create({ id: "u-1", tenantId: "tenant-a", indicatorId: "i-1", reportingPeriodId: "rp-1", periodAchievement: "5", cumulativeAchievement: "5", createdById: "u-1" });

test("update changes only what was sent and audits before and after", async () => {
  const w = world();
  const r = await new UpdateIndicatorHandler(w.repo, w.updates, w.audit).handle(ctx, { indicatorId: "i-1", name: "People with safe water", target: "200" });
  assert.equal(r.ok, true);
  const i = w.I.get("i-1");
  assert.equal(i.name, "People with safe water");
  assert.equal(i.target, "200");
  assert.equal(i.baseline, "0");
  assert.equal(w.audit.events.length, 1);
  assert.equal(w.audit.events[0].eventType, "logframe.indicator.updated");
  assert.match(w.audit.events[0].oldValue, /People/);
});

test("update with nothing to change writes nothing", async () => {
  const w = world();
  const r = await new UpdateIndicatorHandler(w.repo, w.updates, w.audit).handle(ctx, { indicatorId: "i-1" });
  assert.equal(r.ok, true);
  assert.equal(w.audit.events.length, 0);
});

test("the type cannot change once values exist, and can before", async () => {
  const withValues = world({ values: [value()] });
  const refused = await new UpdateIndicatorHandler(withValues.repo, withValues.updates, withValues.audit).handle(ctx, { indicatorId: "i-1", type: "PERCENTAGE" });
  assert.equal(refused.ok, false);
  assert.equal(withValues.I.get("i-1").type, "NUMBER");
  const empty = world();
  const allowed = await new UpdateIndicatorHandler(empty.repo, empty.updates, empty.audit).handle(ctx, { indicatorId: "i-1", type: "PERCENTAGE" });
  assert.equal(allowed.ok, true);
  assert.equal(empty.I.get("i-1").type, "PERCENTAGE");
});

test("update of an unknown indicator is not found", async () => {
  const w = world({ indicators: [] });
  const r = await new UpdateIndicatorHandler(w.repo, w.updates, w.audit).handle(ctx, { indicatorId: "nope", name: "x" });
  assert.equal(r.ok, false);
});

test("move fixes a wrong parent and audits from and to", async () => {
  const w = world();
  const r = await new MoveIndicatorHandler(w.repo, w.itemsRepo, w.guard, w.audit).handle(ctx, { indicatorId: "i-1", logframeItemId: "item-out" });
  assert.deepEqual(r.value, { id: "i-1", moved: true });
  assert.equal(w.I.get("i-1").logframeItemId, "item-out");
  assert.equal(w.audit.events[0].oldValue, "item-act");
  assert.equal(w.audit.events[0].newValue, "item-out");
});

test("move is refused for another project's item, an unknown item and after approval; onto itself is a quiet no-op", async () => {
  const other = world({ items: [item("item-act"), item("foreign", "p-2")] });
  assert.equal((await new MoveIndicatorHandler(other.repo, other.itemsRepo, other.guard, other.audit).handle(ctx, { indicatorId: "i-1", logframeItemId: "foreign" })).ok, false);
  assert.equal((await new MoveIndicatorHandler(other.repo, other.itemsRepo, other.guard, other.audit).handle(ctx, { indicatorId: "i-1", logframeItemId: "missing" })).ok, false);
  const approved = world({ approved: true });
  assert.equal((await new MoveIndicatorHandler(approved.repo, approved.itemsRepo, approved.guard, approved.audit).handle(ctx, { indicatorId: "i-1", logframeItemId: "item-out" })).ok, false);
  assert.equal(approved.I.get("i-1").logframeItemId, "item-act");
  const same = world();
  const noop = await new MoveIndicatorHandler(same.repo, same.itemsRepo, same.guard, same.audit).handle(ctx, { indicatorId: "i-1", logframeItemId: "item-act" });
  assert.deepEqual(noop.value, { id: "i-1", moved: false });
  assert.equal(same.audit.events.length, 0);
});

test("archive deletes a value-less indicator and archives one with values", async () => {
  const empty = world();
  const deleted = await new ArchiveIndicatorHandler(empty.repo, empty.updates, empty.guard, empty.audit).handle(ctx, "i-1");
  assert.deepEqual(deleted.value, { outcome: "DELETED" });
  assert.deepEqual(empty.deleted, ["i-1"]);
  assert.equal(empty.audit.events[0].eventType, "logframe.indicator.deleted");

  const withValues = world({ values: [value()] });
  const now = new Date("2026-10-07T00:00:00Z");
  const archived = await new ArchiveIndicatorHandler(withValues.repo, withValues.updates, withValues.guard, withValues.audit, () => now).handle(ctx, "i-1");
  assert.deepEqual(archived.value, { outcome: "ARCHIVED" });
  assert.equal(withValues.I.get("i-1").archivedAt.getTime(), now.getTime());
  assert.deepEqual(withValues.deleted, []);
  assert.equal(withValues.audit.events[0].eventType, "logframe.indicator.archived");
});

test("archive is refused after approval and is idempotent", async () => {
  const approved = world({ values: [value()], approved: true });
  assert.equal((await new ArchiveIndicatorHandler(approved.repo, approved.updates, approved.guard, approved.audit).handle(ctx, "i-1")).ok, false);
  assert.equal(approved.I.get("i-1").isArchived, false);

  const w = world({ values: [value()] });
  const h = new ArchiveIndicatorHandler(w.repo, w.updates, w.guard, w.audit);
  await h.handle(ctx, "i-1");
  const again = await h.handle(ctx, "i-1");
  assert.deepEqual(again.value, { outcome: "ARCHIVED" });
  assert.equal(w.audit.events.length, 1);
});

test("restore brings an archived indicator back and is idempotent", async () => {
  const archived = indicator();
  archived.archive(new Date());
  const w = world({ indicators: [archived] });
  const h = new RestoreIndicatorHandler(w.repo, w.audit);
  await h.handle(ctx, "i-1");
  await h.handle(ctx, "i-1");
  assert.equal(w.I.get("i-1").isArchived, false);
  assert.equal(w.audit.events.length, 1);
});

test("the approval guard is true only when a period with a value has an approved-or-later draft", async () => {
  const values = [{ reportingPeriodId: "rp-1" }, { reportingPeriodId: "rp-2" }];
  const updates = { async findByIndicator() { return { ok: true, value: values }; } };
  const draftsBy = (map) => ({ async findByReportingPeriod(id) { return { ok: true, value: map[id] ?? [] }; } });
  assert.equal((await new IndicatorApprovalGuard(updates, draftsBy({ "rp-1": [{ status: "DRAFT" }], "rp-2": [{ status: "IN_REVIEW" }] })).isUsedInApprovedReport(tenantId, "i-1")).value, false);
  for (const status of ["APPROVED", "EXPORTED", "SUBMITTED"]) {
    assert.equal((await new IndicatorApprovalGuard(updates, draftsBy({ "rp-2": [{ status }] })).isUsedInApprovedReport(tenantId, "i-1")).value, true, status);
  }
  assert.equal((await new IndicatorApprovalGuard({ async findByIndicator() { return { ok: true, value: [] }; } }, draftsBy({})).isUsedInApprovedReport(tenantId, "i-1")).value, false);
  const failing = await new IndicatorApprovalGuard(updates, { async findByReportingPeriod() { return { ok: false, error: new Error("db") }; } }).isUsedInApprovedReport(tenantId, "i-1");
  assert.equal(failing.ok, false);
});
