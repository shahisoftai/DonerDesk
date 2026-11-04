import test from "node:test";
import assert from "node:assert/strict";
import { suggestMethods, applyOperation, emptyDraft, planKeyOf, evaluateRequirements, SETUP_REQUIREMENTS, gapInbox } from "../dist/index.js";

const item = (value) => ({ value, sourceQuote: null, sourceRef: null, confidence: "HIGH", status: "EDITED" });
const indicator = (code) => item({ code, title: `Ind ${code}`, logframeCode: null, type: "NUMBER", unit: null, baseline: null, target: "1", targetSchedule: null, frequency: null, direction: null, disaggregation: null, meansOfVerification: null });
const plan = (planCode, title) => item({ title, logframeCode: null, start: null, end: null, location: null, lead: null, planCode });
const team = [{ key: "pm", name: "Pat", email: null, role: "PROJECT_MANAGER", external: false, invite: "LATER" }];

function draft() {
  const d = emptyDraft();
  d.proposal.indicators = [indicator("I1"), indicator("I2"), indicator("I3")];
  d.proposal.plan = [plan("1.1", "Training sessions"), plan("1.2", "Procurement")];
  d.extras.team = team;
  d.extras.planSetup = {
    [planKeyOf({ planCode: "1.1" })]: { placeNames: [], projectWide: true, indicatorCodes: ["I1"], requiredFiles: [], recordsParticipants: true },
    [planKeyOf({ planCode: "1.2" })]: { placeNames: [], projectWide: true, indicatorCodes: ["I2"], requiredFiles: [], recordsParticipants: false },
  };
  return d;
}

test("a form is offered when a feeding activity records who took part; typing otherwise; always with a reason", () => {
  const s = suggestMethods(draft());
  const by = Object.fromEntries(s.map((x) => [x.indicatorCode, x]));
  assert.equal(by.I1.method, "FORM");
  assert.match(by.I1.reason, /Training sessions.*who took part/);
  assert.equal(by.I2.method, "MANUAL");
  assert.match(by.I2.reason, /do not record/);
  assert.equal(by.I3.method, "MANUAL");
  assert.match(by.I3.reason, /No activity feeds it/);
  assert.ok(s.every((x) => x.id === `METHOD:${x.indicatorCode}:${x.method}` && !/[_A-Z]{5,}/.test(x.reason)));
});

test("calculated and connector are never suggested: the draft cannot know of them", () => {
  assert.ok(suggestMethods(draft()).every((s) => s.method === "FORM" || s.method === "MANUAL"));
});

test("what is chosen or rejected is not offered again, and the suggester is deterministic and pure", () => {
  const d = draft();
  const before = JSON.stringify(d);
  const first = suggestMethods(d);
  assert.deepEqual(suggestMethods(d), first);
  assert.equal(JSON.stringify(d), before);
  d.extras.indicatorSetup.I1 = { method: "CONNECTOR" };
  d.extras.rejectedSuggestions = ["METHOD:I2:MANUAL"];
  assert.deepEqual(suggestMethods(d).map((s) => s.indicatorCode), ["I3"]);
});

test("accepting sets the methods, keeps other decisions, and refuses an id that is no longer offered", () => {
  const d = draft();
  d.extras.indicatorSetup.I1 = { ownerKey: "pm", directionConfirmed: true };
  const ids = suggestMethods(d).map((s) => s.id);
  const r = applyOperation(d, { kind: "ACCEPT_METHOD_SUGGESTIONS", ids });
  assert.equal(r.ok, true);
  assert.deepEqual(r.draft.extras.indicatorSetup.I1, { ownerKey: "pm", directionConfirmed: true, method: "FORM" });
  assert.equal(r.draft.extras.indicatorSetup.I3.method, "MANUAL");
  assert.equal(applyOperation(r.draft, { kind: "ACCEPT_METHOD_SUGGESTIONS", ids }).ok, false, "a second accept is refused");
  assert.match(applyOperation(d, { kind: "ACCEPT_METHOD_SUGGESTIONS", ids: ["METHOD:ZZ:FORM"] }).reason, /no longer offered/);
});

test("there is no evidence default or named verifier to set: the product has no place for them", () => {
  const d = draft();
  assert.ok(!SETUP_REQUIREMENTS.some((r) => r.key === "entry.evidence"));
  const r = applyOperation(d, { kind: "SET_COLLECTION", patch: { reviewMode: "FULL", windowRule: { opensDaysBefore: 1, closesDaysAfter: 1 } } });
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(r.draft.extras.collection).sort(), ["reviewMode", "windowRule"]);
});

test("the data entry requirements close from the slide's decisions", () => {
  const open = (x) => gapInbox(evaluateRequirements(x, SETUP_REQUIREMENTS)).map((r) => r.key).filter((k) => k.startsWith("entry."));
  let d = draft();
  assert.deepEqual(open(d).sort(), ["entry.methods", "entry.review"]);
  d = applyOperation(d, { kind: "ACCEPT_METHOD_SUGGESTIONS", ids: suggestMethods(d).map((s) => s.id) }).draft;
  d = applyOperation(d, { kind: "SET_COLLECTION", patch: { reviewMode: "FULL", windowRule: { opensDaysBefore: 10, closesDaysAfter: 15 } } }).draft;
  assert.deepEqual(open(d), [], "full review needs no named verifier: who verifies follows people's roles");
});

test("a rate is never offered a form, even when an activity records who took part", () => {
  const d = draft();
  d.proposal.indicators = [item({ ...indicator("I1").value, type: "PERCENTAGE", unit: "%" })];
  const s = suggestMethods(d);
  assert.equal(s[0].method, "MANUAL");
  assert.match(s[0].reason, /rate/);
});
