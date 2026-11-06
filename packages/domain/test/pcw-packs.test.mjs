import test from "node:test";
import assert from "node:assert/strict";
import { BUILT_IN_PACKS, SECTOR_TEMPLATES, resolvePack, applyPack, emptyDraft, evaluateRequirements, SETUP_REQUIREMENTS, gapInbox } from "../dist/index.js";

const org = (sector, extra = {}) => ({ id: `org:${sector}`, sector, source: "ORGANISATION", label: "Ours", reportRules: [], risks: [], ...extra });

test("a pack is chosen by sector only: the organisation's own, then the built-in, then the generic", () => {
  assert.equal(resolvePack(BUILT_IN_PACKS, "WASH").id, "builtin:wash");
  assert.equal(resolvePack(BUILT_IN_PACKS, "wash").id, "builtin:wash");
  assert.equal(resolvePack(BUILT_IN_PACKS, "EDUCATION").id, "builtin:generic");
  assert.equal(resolvePack(BUILT_IN_PACKS, undefined).id, "builtin:generic");
  assert.equal(resolvePack([...BUILT_IN_PACKS, org("WASH")], "WASH").id, "org:WASH");
  assert.equal(resolvePack([...BUILT_IN_PACKS, org(null)], "EDUCATION").id, "org:null");
  assert.equal(resolvePack([], "WASH"), null);
});

test("no built-in pack names a donor, and every dashboard it points at exists", () => {
  const ids = new Set(SECTOR_TEMPLATES.map((t) => t.id));
  for (const pack of BUILT_IN_PACKS) {
    assert.equal(JSON.stringify(pack).match(/USAID|UNICEF|\bEU\b|European|DFID|FCDO/i), null, pack.id);
    if (pack.dashboardTemplate) assert.ok(ids.has(pack.dashboardTemplate), `${pack.id} -> ${pack.dashboardTemplate}`);
    assert.ok(pack.risks.length > 0 && pack.reportRules.length > 0);
    assert.equal("checklist" in pack || "evidenceDefault" in pack, false, "a pack carries nothing the product has no place for");
  }
});

test("a pack fills an empty draft and says what it filled", () => {
  const { draft, filled } = applyPack(emptyDraft(), BUILT_IN_PACKS.find((p) => p.sector === "WASH"));
  assert.equal(draft.extras.schedule.cadence, "QUARTERLY");
  assert.ok(draft.extras.schedule.rules.length >= 3);
  assert.ok(draft.extras.schedule.rules.every((r) => Object.keys(r).sort().join() === "dueDaysAfterEnd,reportType,template"), "a pack holds no people");
  assert.equal(draft.extras.collection.reviewMode, "FULL");
  assert.equal(draft.extras.dashboardTemplate, "tpl-wash-access-hygiene");
  assert.equal(draft.extras.start.packId, "builtin:wash");
  assert.ok(draft.proposal.risks.every((r) => r.status === "PROPOSED" && r.sourceQuote === null), "suggested risks wait for a decision");
  assert.deepEqual(filled.slice(0, 2), ["Reporting cadence", "Report rules"]);
});

test("a pack never overwrites an answer, and applying twice adds nothing", () => {
  const base = emptyDraft();
  base.extras.schedule.cadence = "MONTHLY";
  base.extras.collection.reviewMode = "SIMPLE";
  base.extras.dashboardTemplate = "mine";
  const pack = BUILT_IN_PACKS.find((p) => p.sector === "HEALTH");
  const once = applyPack(base, pack).draft;
  assert.equal(once.extras.schedule.cadence, "MONTHLY");
  assert.equal(once.extras.collection.reviewMode, "SIMPLE");
  assert.equal(once.extras.dashboardTemplate, "mine");
  const twice = applyPack(once, pack);
  assert.equal(twice.draft.proposal.risks.length, once.proposal.risks.length);
  assert.deepEqual(twice.filled, []);
});

test("applying a pack does not change the input draft and closes some requirements without closing the rest", () => {
  const base = emptyDraft();
  const before = JSON.stringify(base);
  const { draft } = applyPack(base, BUILT_IN_PACKS[0]);
  assert.equal(JSON.stringify(base), before);
  const open = (d) => gapInbox(evaluateRequirements(d, SETUP_REQUIREMENTS)).map((r) => r.key);
  assert.ok(!open(draft).includes("reporting.rules"), "a pack's report rules (layout and due date) are all that is asked");
  assert.ok(open(draft).includes("reporting.cadence") === false);
  assert.ok(open(draft).includes("launch.risks"), "suggested risks still need a decision");
});
