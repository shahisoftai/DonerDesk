import test from "node:test";
import assert from "node:assert/strict";
import { dropExactDuplicates } from "../dist/index.js";

const P = (value) => ({ value, sourceQuote: "q", sourceRef: null, confidence: "HIGH", status: "PROPOSED" });
const ind = (o = {}) => ({ code: "OP1-1a", title: "Households registered", logframeCode: "1.1", type: "NUMBER", unit: "households", baseline: "0", target: "6000", targetSchedule: null, frequency: "Monthly", direction: null, disaggregation: null, meansOfVerification: null, ...o });
const base = () => ({ facts: {}, logframe: [], indicators: [], periods: [], plan: [], places: [], funding: [], budget: [], risks: [] });

test("an exact repeat read from a second document is dropped; the first one read stays", () => {
  const p = base();
  p.indicators = [P(ind()), P(ind({ title: "  households   REGISTERED " })), P(ind({ code: "OP1-1b", title: "Households paid" }))];
  const r = dropExactDuplicates(p);
  assert.equal(r.dropped, 1);
  assert.deepEqual(r.proposal.indicators.map((i) => i.value.code), ["OP1-1a", "OP1-1b"]);
});

test("the same code with a different target is kept: a person decides, nothing is merged", () => {
  const p = base();
  p.indicators = [P(ind()), P(ind({ target: "7000" }))];
  assert.equal(dropExactDuplicates(p).dropped, 0);
  assert.equal(dropExactDuplicates(p).proposal.indicators.length, 2);
});

test("every list is covered and the input is not changed", () => {
  const p = base();
  p.risks = [P({ kind: "RISK", title: "Flood", seriousness: "HIGH", mitigation: null }), P({ kind: "RISK", title: "flood", seriousness: "HIGH", mitigation: null })];
  p.places = [P({ name: "Bama", adminLevel: 2 }), P({ name: "Bama", adminLevel: 2 })];
  const before = JSON.stringify(p);
  const r = dropExactDuplicates(p);
  assert.equal(r.dropped, 2);
  assert.equal(JSON.stringify(p), before);
});

test("a repeat that states less than the first (the model left fields empty) is dropped; one that states more is kept", () => {
  const p = base();
  p.indicators = [P(ind()), P(ind({ unit: null, baseline: null, frequency: null }))];
  assert.equal(dropExactDuplicates(p).dropped, 1);
  const q = base();
  q.indicators = [P(ind({ unit: null })), P(ind())];
  assert.equal(dropExactDuplicates(q).dropped, 0, "the later one adds the unit, so a person sees both");
});
