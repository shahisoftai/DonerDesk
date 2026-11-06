import { test } from "node:test";
import assert from "node:assert/strict";
import { GENERAL, formFrom, inputFrom } from "../../src/features/project-setup/domain/pack-form.ts";

const pack = { id: "builtin:health", sector: "HEALTH", label: "Health", cadence: "QUARTERLY", reviewMode: "FULL", reportRules: [{ reportType: "QUARTERLY", template: "BUILT_IN", dueDaysAfterEnd: 30 }], windowRule: { opensDaysBefore: 10, closesDaysAfter: 15 }, risks: [{ kind: "RISK", title: "Stock-outs", seriousness: "HIGH", mitigation: null }], dashboardTemplate: "tpl-health-mnch" };

test("a pack becomes a form and back to the same request", () => {
  const input = inputFrom(formFrom("HEALTH", pack));
  assert.equal(input.sector, "HEALTH");
  assert.deepEqual(input.reportRules, [{ reportType: "QUARTERLY", dueDaysAfterEnd: 30 }]);
  assert.deepEqual(input.windowRule, { opensDaysBefore: 10, closesDaysAfter: 15 });
  assert.equal(input.risks[0]!.title, "Stock-outs");
  assert.equal(input.dashboardTemplate, "tpl-health-mnch");
});

test("the general pack has no sector, an empty form starts empty, and an empty window is left out rather than sent as zeros", () => {
  const empty = formFrom(GENERAL, null);
  const input = inputFrom(empty);
  assert.equal(input.sector, null);
  assert.equal(input.windowRule, null);
  assert.equal(input.cadence, null);
  assert.deepEqual(input.reportRules, []);
});

test("a half-filled window or a blank due date is sent as an impossible number so the server names it, never as 0", () => {
  const f = formFrom("HEALTH", pack);
  f.closes = "";
  f.rules[0]!.due = "";
  const input = inputFrom(f);
  assert.equal(input.windowRule!.closesDaysAfter, -1);
  assert.equal(input.reportRules[0]!.dueDaysAfterEnd, -1);
});
