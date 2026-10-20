import assert from "node:assert/strict";
import test from "node:test";
import { requirementsFromTemplate } from "@donordesk/domain";
import { DeterministicRequirementResolver } from "../dist/llm/requirement-resolver.js";

const template = (annexes) => ({ id: "tpl1", version: 3, templateName: "USAID quarterly", requirements: { annexes } });

test("H-10: only required, named annexes become blocking requirements, once each", () => {
  const reqs = requirementsFromTemplate(template([
    { name: "Annex 1: Indicator Table", required: true },
    { name: "annex 1: indicator table", required: true },
    { name: "Success stories", required: false },
    { name: "  ", required: true },
  ]));
  assert.equal(reqs.length, 1);
  assert.equal(reqs[0].key, "ANNEX:annex-1-indicator-table");
  assert.equal(reqs[0].severity, "BLOCKING");
  assert.equal(reqs[0].sourceReference.sourceType, "TEMPLATE");
  assert.equal(reqs[0].sourceReference.version, 3);
});

function snapshot(annexes) {
  return JSON.stringify({ id: "tpl1", version: 3, templateName: "USAID quarterly", donorName: "USAID", reportType: "QUARTERLY", language: "en", sections: [], requirements: { annexes } });
}
function repos(snapshotJson, sectionTitles) {
  return {
    periods: { findById: async () => ({ ok: true, value: { projectId: "p1", reportType: "QUARTERLY", templateSnapshotJson: snapshotJson } }) },
    packs: { findActiveByMechanism: async () => ({ ok: true, value: null }) },
    overrides: { findActiveForProject: async () => ({ ok: true, value: [] }) },
    plans: { findByReportingPeriod: async () => ({ ok: true, value: [{ sections: sectionTitles.map((title) => ({ title })) }] }) },
    resolved: { create: async () => ({ ok: true, value: undefined }) },
  };
}
const resolve = (snapshotJson, titles) => {
  const r = repos(snapshotJson, titles);
  return new DeterministicRequirementResolver({ generate: () => "r1" }, r.periods, r.packs, r.overrides, r.plans, r.resolved)
    .resolve({ tenantId: { toString: () => "t" }, reportingPeriodId: "per1", effectiveDate: new Date() });
};

test("H-10: a required annex of the pinned template reaches the gate: unmet when the report has no such section", async () => {
  const r = await resolve(snapshot([{ id: "a1", name: "Indicator table", required: true }]), ["Executive summary"]);
  assert.ok(r.ok);
  assert.deepEqual(r.value.coverage.unmet, ["ANNEX:indicator-table"]);
  assert.equal(r.value.sourceTrace[0].sourceReference.sourceType, "TEMPLATE");
});

test("H-10: ...and satisfied once the report has the annex as a section", async () => {
  const r = await resolve(snapshot([{ id: "a1", name: "Indicator table", required: true }]), ["Executive summary", "Annex: Indicator table"]);
  assert.ok(r.ok);
  assert.deepEqual(r.value.coverage.unmet, []);
  assert.deepEqual(r.value.coverage.satisfied, ["ANNEX:indicator-table"]);
});

test("H-10: a period with no pinned template adds nothing", async () => {
  const r = await resolve("{}", ["Executive summary"]);
  assert.ok(r.ok);
  assert.equal(r.value.snapshot.length, 0);
});
