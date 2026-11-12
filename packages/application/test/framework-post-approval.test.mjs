import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { LogframeVersioner, withLogframeVersioning, UpdateIndicatorHandler, FrameworkApprovalReader, ListLogframeVersionsHandler, GetLogframeChangesHandler, ApproveLogframeVersionHandler } from "../dist/index.js";
import { TenantId, LogframeItem, Indicator } from "@donordesk/domain";

const tenantId = TenantId.create("tenant-a");
const ctx = { tenant: { tenantId, userId: "u1", role: "PROJECT_MANAGER" }, requestId: "r" };
const ok = (value) => ({ ok: true, value });

function world({ usedInApprovedReport = false } = {}) {
  const state = { item: LogframeItem.create({ id: "i1", tenantId: "tenant-a", projectId: "p1", level: "OUTPUT", code: "OUT-1", title: "Trained staff" }), indicator: Indicator.create({ id: "n1", tenantId: "tenant-a", projectId: "p1", logframeItemId: "i1", code: "IND-1", name: "People trained", type: "NUMBER", baseline: "0", target: "100" }), versions: [], audits: [], used: usedInApprovedReport };
  const versions = {
    create: async (r) => { state.versions.push({ ...r }); return ok(r); },
    latest: async () => ok(state.versions.at(-1) ?? null),
    list: async () => ok([...state.versions].reverse()),
    findByNumber: async (_p, v) => ok(state.versions.find((x) => x.version === v) ?? null),
    approve: async (id, by, at) => { Object.assign(state.versions.find((x) => x.id === id), { approvedById: by, approvedAt: at }); return ok(undefined); },
  };
  const indicators = { findById: async () => ok(state.indicator), update: async () => ok(state.indicator), findByProject: async () => ok([state.indicator]) };
  const updates = { findByIndicator: async () => ok([]) };
  let n = 0;
  const versioner = new LogframeVersioner({ findByProject: async () => ok([state.item]) }, indicators, versions, { sha256Hex: (s) => createHash("sha256").update(s).digest("hex") }, { generate: () => `v${++n}` });
  const handler = new UpdateIndicatorHandler(indicators, updates, { record: async (e) => { state.audits.push(e); } }, { reader: new FrameworkApprovalReader(versions), guard: { isUsedInApprovedReport: async () => ok(state.used) } });
  withLogframeVersioning(handler, versioner, { projectOf: () => "p1", reasonOf: (a) => a[1].reason?.trim() || undefined });
  return { state, versioner, handler, versions, approve: () => new ApproveLogframeVersionHandler(versions, versioner, { record: async () => {} }) };
}

const edit = (w, fields) => w.handler.handle(ctx, { indicatorId: "n1", ...fields });

test("52.3: with no approved framework a target edit goes through and is classified as measurement", async () => {
  const w = world({ usedInApprovedReport: true });
  await w.versioner.capture(ctx, "p1");
  assert.equal((await edit(w, { target: "120" })).ok, true);
  assert.equal(w.state.versions.at(-1).changeKinds, "MEASUREMENT");
});

test("52.3: after approval, a target an approved report used cannot change without a reason; with one it changes and the reason is kept", async () => {
  const w = world({ usedInApprovedReport: true });
  await w.versioner.capture(ctx, "p1");
  assert.equal((await w.approve().handle(ctx, "p1", ctx.tenant.role)).ok ?? true, true);
  const refused = await edit(w, { target: "120" });
  assert.equal(refused.ok, false);
  assert.equal(refused.error.details.code, "REASON_REQUIRED");
  assert.equal(w.state.indicator.target, "100", "nothing was written");
  assert.equal(w.state.versions.length, 1, "and no version was made");

  const allowed = await edit(w, { target: "120", reason: "Donor amendment 2 raised the target" });
  assert.equal(allowed.ok, true);
  const latest = w.state.versions.at(-1);
  assert.equal(latest.version, 2);
  assert.match(latest.summary, /target changed from 100 to 120.*reason: Donor amendment 2 raised the target/);
  assert.equal(latest.changeKinds, "MEASUREMENT");
  assert.match(w.state.audits.at(-1).newValue, /revisionReason/);
});

test("52.3: an indicator no approved report used can be corrected after approval without a reason; its code never changes", async () => {
  const w = world({ usedInApprovedReport: false });
  await w.versioner.capture(ctx, "p1");
  await w.approve().handle(ctx, "p1", ctx.tenant.role);
  assert.equal((await edit(w, { target: "150" })).ok, true);
  const code = await edit(w, { code: "IND-9" });
  assert.equal(code.ok, false);
  assert.equal(code.error.details.code, "CODE_LOCKED");
  assert.equal(w.state.indicator.code, "IND-1");
});

test("52.3: the history says which versions touched meaning and which touched measurement", async () => {
  const w = world();
  await w.versioner.capture(ctx, "p1");
  w.state.item = LogframeItem.create({ id: "i1", tenantId: "tenant-a", projectId: "p1", level: "OUTPUT", code: "OUT-1", title: "Trained health staff" });
  await edit(w, { target: "130" });
  const list = await new ListLogframeVersionsHandler(w.versions).handle(ctx, "p1");
  assert.deepEqual(list.value.items.map((v) => v.kinds), [["STRUCTURE", "MEASUREMENT"], []]);
  const changes = await new GetLogframeChangesHandler(w.versions).handle(ctx, "p1", 2);
  assert.deepEqual(changes.value.kinds, ["STRUCTURE", "MEASUREMENT"]);
  assert.deepEqual(changes.value.changes.map((c) => c.group).sort(), ["MEASUREMENT", "STRUCTURE"]);
});
