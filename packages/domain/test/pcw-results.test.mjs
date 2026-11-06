import test from "node:test";
import assert from "node:assert/strict";
import { RESULT_OPERATIONS, applyResultOperation, emptyProposal, emptyDraft, evaluateRequirements, SETUP_REQUIREMENTS, gapInbox } from "../dist/index.js";

const run = (p, op) => { const r = applyResultOperation(p, op); assert.equal(r.ok, true, r.reason); return r.proposal; };
const refused = (p, op) => { const r = applyResultOperation(p, op); assert.equal(r.ok, false); return r.reason; };
const node = (p, title) => p.logframe.find((n) => n.value?.title === title)?.value;

function chain() {
  let p = emptyProposal();
  p = run(p, { kind: "ADD_NODE", level: "GOAL", title: "Healthy families" });
  p = run(p, { kind: "ADD_NODE", level: "OUTCOME", title: "Safe water", parentCode: node(p, "Healthy families").code });
  p = run(p, { kind: "ADD_NODE", level: "OUTPUT", title: "Wells built", parentCode: node(p, "Safe water").code });
  p = run(p, { kind: "ADD_NODE", level: "ACTIVITY", title: "Drill wells", parentCode: node(p, "Wells built").code });
  return p;
}

test("every result operation kind has a handler", () => {
  assert.deepEqual(Object.keys(RESULT_OPERATIONS).sort(), ["ADD_INDICATOR", "ADD_NODE", "BULK_INDICATORS", "EDIT_INDICATOR", "EDIT_NODE_TITLE"]);
});

test("a typed chain gets codes, belongs to the person, and closes the results requirements", () => {
  const p = chain();
  assert.ok(p.logframe.every((n) => n.status === "EDITED" && n.sourceQuote === null && n.value.code));
  assert.equal(node(p, "Drill wells").parentCode, node(p, "Wells built").code);
  const d = { ...emptyDraft(), proposal: p };
  const open = gapInbox(evaluateRequirements(d, SETUP_REQUIREMENTS)).map((r) => r.key);
  assert.ok(!open.includes("results.chain") && !open.includes("results.decided"));
  assert.ok(open.includes("results.codes"), "generated codes still wait for the person to keep them");
});

test("a node needs a name, the right parent and one goal only", () => {
  const p = chain();
  assert.match(refused(p, { kind: "ADD_NODE", level: "GOAL", title: "Another" }), /one goal/);
  assert.match(refused(p, { kind: "ADD_NODE", level: "OUTPUT", title: "x" }), /Choose the outcome/);
  assert.match(refused(p, { kind: "ADD_NODE", level: "OUTPUT", title: "x", parentCode: node(p, "Wells built").code }), /go under outcomes/);
  assert.match(refused(p, { kind: "ADD_NODE", level: "ACTIVITY", title: "x", parentCode: "nope" }), /not among/);
  assert.match(refused(p, { kind: "ADD_NODE", level: "ACTIVITY", title: "  ", parentCode: node(p, "Wells built").code }), /name/);
  assert.equal(applyResultOperation(emptyProposal(), { kind: "ADD_NODE", level: "OUTCOME", title: "Alone" }).ok, true, "an outcome may stand without a goal");
});

test("an added indicator gets a code and an owner can be named by it", () => {
  let p = chain();
  const output = node(p, "Wells built").code;
  p = run(p, { kind: "ADD_INDICATOR", value: { title: "Wells working", logframeCode: output, type: "NUMBER", target: "20" } });
  const ind = p.indicators[0];
  assert.ok(ind.value.code);
  assert.equal(ind.value.logframeCode, output);
  assert.match(refused(p, { kind: "ADD_INDICATOR", value: { title: "x", logframeCode: "nope" } }), /not among/);
});

test("editing an indicator keeps it the person's, validates the result link, and refuses a blank name", () => {
  let p = chain();
  p = run(p, { kind: "ADD_INDICATOR", value: { title: "Wells working" } });
  p = run(p, { kind: "EDIT_INDICATOR", path: "indicators.0", patch: { target: " 25 ", frequency: "Quarterly", logframeCode: node(p, "Wells built").code, disaggregation: ["Sex", " "] } });
  const v = p.indicators[0].value;
  assert.equal(v.target, "25");
  assert.deepEqual(v.disaggregation, ["Sex"]);
  assert.equal(v.linkSource, "PERSON");
  assert.match(refused(p, { kind: "EDIT_INDICATOR", path: "indicators.0", patch: { title: " " } }), /name/);
  assert.match(refused(p, { kind: "EDIT_INDICATOR", path: "indicators.0", patch: { logframeCode: "zzz" } }), /not among/);
  assert.match(refused(p, { kind: "EDIT_INDICATOR", path: "indicators.9", patch: {} }), /not in the project/);
  assert.equal(p.indicators[0].value.baseline, null, "a field not sent is left alone");
});

test("a rejected item cannot be edited", () => {
  let p = chain();
  p = { ...p, logframe: p.logframe.map((n, i) => (i === 3 ? { ...n, status: "REJECTED" } : n)) };
  assert.match(refused(p, { kind: "EDIT_NODE_TITLE", path: "logframe.3", title: "x" }), /not in the project/);
});

test("bulk fills only what is empty, can be limited to a level, and refuses an empty request", () => {
  let p = chain();
  const output = node(p, "Wells built").code;
  const outcome = node(p, "Safe water").code;
  p = run(p, { kind: "ADD_INDICATOR", value: { title: "A", logframeCode: output, frequency: "Monthly" } });
  p = run(p, { kind: "ADD_INDICATOR", value: { title: "B", logframeCode: output } });
  p = run(p, { kind: "ADD_INDICATOR", value: { title: "C", logframeCode: outcome } });
  const filled = run(p, { kind: "BULK_INDICATORS", frequency: "Quarterly", disaggregation: ["Sex", "Age"], level: "OUTPUT" });
  const by = (t) => filled.indicators.find((i) => i.value.title === t).value;
  assert.equal(by("A").frequency, "Monthly", "an existing frequency is kept");
  assert.equal(by("B").frequency, "Quarterly");
  assert.deepEqual(by("B").disaggregation, ["Sex", "Age"]);
  assert.equal(by("C").frequency, null, "other levels are left alone");
  const again = run(filled, { kind: "BULK_INDICATORS", frequency: "Quarterly", disaggregation: ["Sex", "Age"], level: "OUTPUT" });
  assert.deepEqual(again.indicators, filled.indicators, "applying twice changes nothing");
  assert.match(refused(p, { kind: "BULK_INDICATORS" }), /Choose a frequency/);
});

test("result operations never change the proposal they were given", () => {
  const p = chain();
  const before = JSON.stringify(p);
  applyResultOperation(p, { kind: "ADD_INDICATOR", value: { title: "x" } });
  applyResultOperation(p, { kind: "EDIT_NODE_TITLE", path: "logframe.0", title: "New" });
  assert.equal(JSON.stringify(p), before);
});
