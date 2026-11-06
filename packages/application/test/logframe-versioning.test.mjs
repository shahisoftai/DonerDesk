import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { LogframeVersioner, withLogframeVersioning, ListLogframeVersionsHandler, GetLogframeChangesHandler, ApproveLogframeVersionHandler } from "../dist/index.js";
import { TenantId, LogframeItem, Indicator } from "@donordesk/domain";

const tenantId = TenantId.create("tenant-a");
const ctx = { tenant: { tenantId, userId: "u1", role: "PROJECT_MANAGER" }, requestId: "r" };
const ok = (value) => ({ ok: true, value });

function world() {
  const state = { items: [LogframeItem.create({ id: "i1", tenantId: "tenant-a", projectId: "p1", level: "OUTPUT", code: "OUT-1", title: "Trained staff" })], indicators: [], versions: [], audits: [] };
  const indicator = (target) => Indicator.create({ id: "n1", tenantId: "tenant-a", projectId: "p1", logframeItemId: "i1", code: "IND-1", name: "People trained", type: "NUMBER", baseline: "0", target });
  state.indicators = [indicator("100")];
  const repos = {
    items: { findByProject: async () => ok(state.items) },
    indicators: { findByProject: async () => ok(state.indicators) },
    versions: {
      create: async (r) => { state.versions.push({ ...r }); return ok(r); },
      latest: async () => ok(state.versions.at(-1) ?? null),
      list: async () => ok([...state.versions].reverse()),
      findByNumber: async (_p, v) => ok(state.versions.find((x) => x.version === v) ?? null),
      approve: async (id, by, at) => { Object.assign(state.versions.find((x) => x.id === id), { approvedById: by, approvedAt: at }); return ok(undefined); },
    },
  };
  let n = 0;
  const versioner = new LogframeVersioner(repos.items, repos.indicators, repos.versions, { sha256Hex: (s) => createHash("sha256").update(s).digest("hex") }, { generate: () => `v${++n}` });
  return { state, repos, versioner, setTarget: (t) => { state.indicators = [indicator(t)]; } };
}

test("H-1: the first capture writes version 1, an unchanged framework writes nothing, a changed target writes version 2 with a plain summary", async () => {
  const w = world();
  assert.equal((await w.versioner.capture(ctx, "p1")).value.version, 1);
  assert.equal((await w.versioner.capture(ctx, "p1")).value, null);
  w.setTarget("120");
  const v2 = (await w.versioner.capture(ctx, "p1")).value;
  assert.equal(v2.version, 2);
  assert.equal(v2.summary, "1 change: Indicator IND-1: target changed from 100 to 120");
  assert.equal(w.state.versions.length, 2);
});

test("H-1: an empty framework has no history to keep", async () => {
  const w = world();
  w.state.items = []; w.state.indicators = [];
  assert.equal((await w.versioner.capture(ctx, "p1")).value, null);
});

test("H-1: the decorator versions after a successful change, finds the project before the call, and never fails the change", async () => {
  const w = world();
  const errors = [];
  const handler = { handle: async (_ctx, input) => (input.fail ? { ok: false, error: new Error("no") } : ok({ id: "x" })) };
  withLogframeVersioning(handler, w.versioner, { projectOf: (args) => args[1].projectId, onError: (e) => errors.push(e) });
  assert.equal((await handler.handle(ctx, { projectId: "p1", fail: true })).ok, false);
  assert.equal(w.state.versions.length, 0, "a failed change leaves no version");
  assert.equal((await handler.handle(ctx, { projectId: "p1" })).ok, true);
  assert.equal(w.state.versions.length, 1);

  const broken = { handle: async () => ok(1) };
  withLogframeVersioning(broken, { capture: async () => { throw new Error("db down"); } }, { projectOf: () => "p1", onError: (e) => errors.push(e) });
  assert.equal((await broken.handle(ctx)).ok, true);
  assert.equal(errors.length, 1);
});

test("H-1: history, changes between versions, and sign-off", async () => {
  const w = world();
  await w.versioner.capture(ctx, "p1");
  w.setTarget("120");
  await w.versioner.capture(ctx, "p1");
  const list = (await new ListLogframeVersionsHandler(w.repos.versions).handle(ctx, "p1")).value.items;
  assert.deepEqual(list.map((v) => v.version), [2, 1]);
  const changes = (await new GetLogframeChangesHandler(w.repos.versions).handle(ctx, "p1", 2)).value;
  assert.equal(changes.from, 1);
  assert.equal(changes.changes[0].text, "Indicator IND-1: target changed from 100 to 120");
  assert.equal((await new GetLogframeChangesHandler(w.repos.versions).handle(ctx, "p1", 9)).ok, false);

  const approve = new ApproveLogframeVersionHandler(w.repos.versions, w.versioner, { record: async (e) => w.state.audits.push(e.eventType) });
  assert.equal((await approve.handle(ctx, "p1")).value.version, 2);
  assert.equal(w.state.versions[1].approvedById, "u1");
  assert.deepEqual(w.state.audits, ["logframe.version.approved"]);
  const viewer = { ...ctx, tenant: { ...ctx.tenant, role: "VIEWER" } };
  await assert.rejects(approve.handle(viewer, "p1"));
});
