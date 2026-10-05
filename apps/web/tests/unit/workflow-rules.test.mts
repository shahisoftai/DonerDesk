import { test } from "node:test";
import assert from "node:assert/strict";
import { WORKFLOW_ORDER, WORKFLOW_RULES, ruleForStep } from "../../src/features/tour/domain/workflow-rules.ts";
import { TOUR_STEPS } from "../../src/features/tour/domain/tour-steps.ts";

test("the order of work is the documented ten steps, in order", () => {
  assert.deepEqual(WORKFLOW_ORDER.map((s) => s.key), ["project", "logframe", "indicators", "template", "period", "data", "evidence", "generate", "review", "export"]);
});

test("there are five rules, each tied to an existing tour step, with unique keys", () => {
  assert.equal(WORKFLOW_RULES.length, 5);
  assert.equal(new Set(WORKFLOW_RULES.map((r) => r.key)).size, 5);
  const ids = new Set(TOUR_STEPS.map((s) => s.id));
  for (const r of WORKFLOW_RULES) assert.ok(ids.has(r.stepId), `${r.key} -> ${r.stepId}`);
});

test("tour steps are unique and follow the workflow: logframe before template before period before evidence before draft", () => {
  const ids = TOUR_STEPS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  const pos = (id: string) => ids.indexOf(id);
  assert.ok(pos("logframe-indicators") < pos("donor-template"));
  assert.ok(pos("donor-template") < pos("reporting-period"));
  assert.ok(pos("reporting-period") < pos("evidence"));
  assert.ok(pos("evidence") < pos("ai-draft"));
  assert.ok(pos("ai-draft") < pos("report-editor"));
  assert.equal(ids[ids.length - 1], "export");
});

test("each step shows exactly its rule's wording, from the one source", () => {
  for (const s of TOUR_STEPS) {
    const rule = ruleForStep(s.id);
    if (rule) assert.deepEqual(s.rule, { title: rule.title, body: rule.body });
    else assert.equal(s.rule, undefined);
  }
});

test("route placeholders in tour steps are only the known ones", () => {
  for (const s of TOUR_STEPS) assert.deepEqual((s.route.match(/\{[^}]+\}/g) ?? []).filter((p) => !["{projectId}", "{periodId}"].includes(p)), []);
});
