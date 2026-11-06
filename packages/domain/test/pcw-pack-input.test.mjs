import test from "node:test";
import assert from "node:assert/strict";
import { checkPackInput, applyPack, resolvePack, BUILT_IN_PACKS, emptyDraft, packKey } from "../dist/index.js";

const good = { sector: "health", label: "Our health starting answers", cadence: "monthly", reportRules: [{ reportType: "monthly", dueDaysAfterEnd: 7 }], reviewMode: "SIMPLE", windowRule: { opensDaysBefore: 5, closesDaysAfter: 10 }, risks: [{ title: "Stock-outs", seriousness: "HIGH", mitigation: "Reorder early" }], dashboardTemplate: "tpl-health-mnch" };

test("a good pack is accepted, tidied, and always names the standard layout (never a donor's)", () => {
  const r = checkPackInput(good);
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(r.pack.sector, "HEALTH");
  assert.equal(r.pack.source, "ORGANISATION");
  assert.equal(r.pack.cadence, "MONTHLY");
  assert.deepEqual(r.pack.reportRules, [{ reportType: "MONTHLY", template: "BUILT_IN", dueDaysAfterEnd: 7 }]);
  assert.equal(packKey(r.pack.sector), "HEALTH");
});

test("each fault is named by a code, and nothing is saved partly", () => {
  const codes = (input) => { const r = checkPackInput(input); return r.ok ? [] : r.problems.map((p) => p.code); };
  assert.deepEqual(codes({ ...good, sector: "ROCKETS" }), ["SECTOR_UNKNOWN"]);
  assert.deepEqual(codes({ ...good, label: "  " }), ["LABEL_MISSING"]);
  assert.deepEqual(codes({ ...good, cadence: "FORTNIGHTLY" }), ["CADENCE_UNKNOWN"]);
  assert.deepEqual(codes({ ...good, reportRules: [{ reportType: "", dueDaysAfterEnd: 3 }] }), ["RULE_INCOMPLETE"]);
  assert.deepEqual(codes({ ...good, reportRules: [{ reportType: "ANNUAL", dueDaysAfterEnd: -1 }] }), ["RULE_DAYS"]);
  assert.deepEqual(codes({ ...good, reviewMode: "WILD" }), ["REVIEW_MODE_UNKNOWN"]);
  assert.deepEqual(codes({ ...good, windowRule: { opensDaysBefore: 500, closesDaysAfter: 1 } }), ["WINDOW_DAYS"]);
  assert.deepEqual(codes({ ...good, risks: [{ title: "", seriousness: "HIGH" }] }), ["RISK_TITLE_MISSING"]);
  assert.deepEqual(codes({ ...good, risks: [{ title: "x", seriousness: "SEVERE" }] }), ["RISK_SERIOUSNESS"]);
  assert.deepEqual(codes({ ...good, dashboardTemplate: "tpl-nope" }), ["TEMPLATE_UNKNOWN"]);
  assert.deepEqual(codes({ ...good, risks: Array.from({ length: 16 }, () => ({ title: "x", seriousness: "LOW" })) }), ["TOO_MANY_RISKS"]);
});

test("a pack with no sector is the organisation's general pack and is used when a sector has none", () => {
  const r = checkPackInput({ label: "General", risks: [] });
  assert.ok(r.ok);
  assert.equal(r.pack.sector, null);
  assert.equal(r.pack.id, "org:GENERAL");
  assert.equal(resolvePack([...BUILT_IN_PACKS, r.pack], "WASH").id, "builtin:wash", "a built-in sector pack still beats the organisation's general one");
  assert.equal(resolvePack([...BUILT_IN_PACKS, r.pack], "EDUCATION").id, "org:GENERAL", "with no sector pack the organisation's general pack applies");
});

test("the organisation's pack for a sector replaces the built-in one, and still only fills what is empty", () => {
  const own = checkPackInput(good).pack;
  const picked = resolvePack([...BUILT_IN_PACKS, own], "HEALTH");
  assert.equal(picked.id, "org:HEALTH");
  const draft = emptyDraft(false);
  draft.extras.schedule.cadence = "QUARTERLY";
  const applied = applyPack(draft, picked);
  assert.equal(applied.draft.extras.schedule.cadence, "QUARTERLY", "an answer already given is kept");
  assert.equal(applied.draft.extras.collection.reviewMode, "SIMPLE");
  assert.equal(applied.draft.proposal.risks.length, 1);
  assert.equal(applied.draft.proposal.risks[0].status, "PROPOSED", "suggested risks arrive undecided");
});
