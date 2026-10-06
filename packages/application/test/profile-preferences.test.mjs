import assert from "node:assert/strict";
import test from "node:test";
import { SetStandingStatementHandler, SetTemplateDefaultForTypeHandler, SetRequireSecondApproverHandler } from "../dist/index.js";
import { ReportingProfile, TenantId } from "@donordesk/domain";

const ctx = { tenant: { tenantId: TenantId.create("tenant-a"), userId: "u1" }, requestId: "r" };
const ok = (value) => ({ ok: true, value });

function world(existing) {
  let stored = existing ?? null;
  const created = [];
  const audits = [];
  return {
    created, audits, get: () => stored,
    ids: { generate: () => "prof-1" },
    profiles: { findByProject: async () => ok(stored), create: async (p) => (stored = p, created.push(p), ok(p)), update: async (p) => (stored = p, ok(p)) },
    audit: { record: async (e) => { audits.push(e); } },
    templates: { findById: async (id) => ok(id === "t-final" ? { id, projectId: "p", reportType: "FINAL" } : id === "t-month" ? { id, projectId: "p", reportType: "MONTHLY" } : null) },
  };
}
const profile = () => ReportingProfile.create({ id: "prof-0", tenantId: "tenant-a", projectId: "p", createdById: "u0" });

test("a standing statement is saved (creating the profile when there is none), replaced and removed, audited", async () => {
  const w = world();
  const h = new SetStandingStatementHandler(w.ids, w.profiles, w.audit);
  assert.equal((await h.handle(ctx, "p", { key: "env", text: "  Waste is sorted.  " })).ok, true);
  assert.equal(w.created.length, 1);
  assert.deepEqual(w.get().standingStatements, { env: "Waste is sorted." });
  await h.handle(ctx, "p", { key: "env", text: "" });
  assert.deepEqual(w.get().standingStatements, {});
  assert.equal(w.audits.length, 2);
  assert.equal((await h.handle(ctx, "p", { key: "", text: "x" })).ok, false);
});

test("a template becomes the default for ONE type only, must be able to structure it, and clearing a non-default is a no-op (25.5)", async () => {
  const w = world(profile());
  const h = new SetTemplateDefaultForTypeHandler(w.ids, w.profiles, w.templates, w.audit);
  assert.equal((await h.handle(ctx, "t-final", { reportType: "FINAL", isDefault: true })).ok, true);
  assert.equal((await h.handle(ctx, "t-month", { reportType: "MONTHLY", isDefault: true })).ok, true);
  assert.deepEqual(w.get().defaultTemplateByType, { FINAL: "t-final", MONTHLY: "t-month" });
  const wrong = await h.handle(ctx, "t-month", { reportType: "ACTIVITY", isDefault: true });
  assert.equal(wrong.ok, false);
  const before = w.audits.length;
  await h.handle(ctx, "t-final", { reportType: "MONTHLY", isDefault: false });
  assert.equal(w.audits.length, before, "nothing changed, nothing audited");
  await h.handle(ctx, "t-final", { reportType: "FINAL", isDefault: false });
  assert.deepEqual(w.get().defaultTemplateByType, { MONTHLY: "t-month" });
  assert.equal((await h.handle(ctx, "t-nope", { reportType: "FINAL", isDefault: true })).ok, false);
  assert.equal((await h.handle(ctx, "t-final", { reportType: "WEEKLY", isDefault: true })).ok, false);
});

test("the second-approver rule is off by default, set and audited only when it changes", async () => {
  const w = world(profile());
  const h = new SetRequireSecondApproverHandler(w.ids, w.profiles, w.audit);
  assert.equal(w.get().requireSecondApprover, false);
  await h.handle(ctx, "p", true);
  assert.equal(w.get().requireSecondApprover, true);
  await h.handle(ctx, "p", true);
  assert.equal(w.audits.length, 1);
});
