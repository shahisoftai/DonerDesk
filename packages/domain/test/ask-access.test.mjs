import test from "node:test";
import assert from "node:assert/strict";
import { askAccess, resolvePlanLimits, PLAN_CODES } from "../dist/index.js";

const base = { askEnabled: true, aiEnabled: true, external: false };

test("Ask is in Team, Growth and Enterprise and not in Starter", () => {
  const expected = { STARTER: "NOT_IN_PLAN", TEAM: "AVAILABLE", GROWTH: "AVAILABLE", ENTERPRISE: "AVAILABLE" };
  for (const code of PLAN_CODES) assert.equal(askAccess({ ...base, planCode: code, limits: resolvePlanLimits(code) }), expected[code], code);
});

test("the plan comes before the opt-in, the opt-in before AI, and a partner is never let in", () => {
  const team = resolvePlanLimits("TEAM");
  assert.equal(askAccess({ ...base, planCode: "STARTER", limits: resolvePlanLimits("STARTER"), askEnabled: false }), "NOT_IN_PLAN");
  assert.equal(askAccess({ ...base, planCode: "TEAM", limits: team, askEnabled: false }), "NOT_TURNED_ON");
  assert.equal(askAccess({ ...base, planCode: "TEAM", limits: team, aiEnabled: false }), "NO_AI");
  assert.equal(askAccess({ ...base, planCode: "TEAM", limits: team, external: true }), "PARTNER");
});

test("limits stored before Ask was a plan feature fall back to the plan's own value; an override can switch it off or on", () => {
  assert.equal(askAccess({ ...base, planCode: "GROWTH", limits: {} }), "AVAILABLE");
  assert.equal(askAccess({ ...base, planCode: "STARTER", limits: {} }), "NOT_IN_PLAN");
  assert.equal(askAccess({ ...base, planCode: "TEAM", limits: { askAssistant: false } }), "NOT_IN_PLAN");
  assert.equal(askAccess({ ...base, planCode: "STARTER", limits: { askAssistant: true } }), "AVAILABLE");
  assert.equal(askAccess({ ...base, planCode: "UNKNOWN", limits: {} }), "NOT_IN_PLAN");
});
