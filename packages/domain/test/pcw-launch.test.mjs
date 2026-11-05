import test from "node:test";
import assert from "node:assert/strict";
import {
  RISK_OPERATIONS, applyRiskOperation, launchSummary, applyOperation, emptyDraft, emptyProposal, evaluateRequirements,
  SETUP_REQUIREMENTS, gapInbox, DEFERRED_STEPS, SECTOR_TEMPLATES,
  DRAFT_OPERATIONS,
} from "../dist/index.js";

const run = (p, op) => { const r = applyRiskOperation(p, op); assert.equal(r.ok, true, r.reason); return r.proposal; };
const refused = (p, op) => { const r = applyRiskOperation(p, op); assert.equal(r.ok, false); return r.reason; };
const item = (value, extra = {}) => ({ value, sourceQuote: null, sourceRef: null, confidence: "HIGH", status: "EDITED", ...extra });

test("every risk operation kind has a handler", () => {
  assert.deepEqual(Object.keys(RISK_OPERATIONS).sort(), ["ADD_RISK", "EDIT_RISK"]);
});

test("a risk and an assumption are one list; kind and seriousness come from the real lists", () => {
  let p = run(emptyProposal(), { kind: "ADD_RISK", riskKind: "RISK", title: " Flooding ", seriousness: "HIGH", mitigation: "Build early" });
  p = run(p, { kind: "ADD_RISK", riskKind: "ASSUMPTION", title: "Roads stay open", seriousness: "LOW" });
  assert.deepEqual(p.risks.map((r) => [r.value.kind, r.value.title, r.value.seriousness]), [["RISK", "Flooding", "HIGH"], ["ASSUMPTION", "Roads stay open", "LOW"]]);
  assert.ok(p.risks.every((r) => r.status === "EDITED" && r.sourceQuote === null));
  assert.match(refused(p, { kind: "ADD_RISK", riskKind: "WORRY", title: "x" }), /has happened, might happen/);
  assert.match(refused(p, { kind: "ADD_RISK", riskKind: "RISK", title: " " }), /Say what/);
  assert.match(refused(p, { kind: "ADD_RISK", riskKind: "RISK", title: "x", seriousness: "SEVERE" }), /high, medium or low/);
  assert.match(refused(p, { kind: "ADD_RISK", riskKind: "RISK", title: "x" }), /how serious/, "a risk with no rating would be left out at launch, so it is asked for here");
  assert.match(refused(p, { kind: "ADD_RISK", riskKind: "RISK", title: "x", seriousness: null }), /how serious/);
  assert.match(refused(p, { kind: "ADD_RISK", riskKind: "RISK", title: "flooding", seriousness: "LOW" }), /already on the list/);
  assert.equal(applyRiskOperation(p, { kind: "ADD_RISK", riskKind: "ASSUMPTION", title: "Flooding", seriousness: "LOW" }).ok, true, "the same words as an assumption are a different entry");
});

test("editing a risk keeps it the person's and validates the same way", () => {
  let p = run(emptyProposal(), { kind: "ADD_RISK", riskKind: "RISK", title: "Flooding", seriousness: "HIGH" });
  p = run(p, { kind: "EDIT_RISK", path: "risks.0", patch: { seriousness: "LOW", mitigation: "  Move stock  " } });
  assert.match(refused(p, { kind: "EDIT_RISK", path: "risks.0", patch: { seriousness: null } }), /how serious/, "a rating cannot be taken away");
  assert.deepEqual([p.risks[0].value.seriousness, p.risks[0].value.mitigation], ["LOW", "Move stock"]);
  assert.match(refused(p, { kind: "EDIT_RISK", path: "risks.0", patch: { kind: "WORRY" } }), /has happened/);
  assert.match(refused(p, { kind: "EDIT_RISK", path: "risks.3", patch: {} }), /not on the list/);
  assert.match(refused(p, { kind: "EDIT_RISK", path: "risks.0", patch: { title: "" } }), /Say what/);
});

test("assumptions now have a requirement (step 11 is no longer deferred) and 'not used' answers it", () => {
  assert.equal(11 in DEFERRED_STEPS, false);
  const open = (d) => gapInbox(evaluateRequirements(d, SETUP_REQUIREMENTS)).map((r) => r.key).filter((k) => k.startsWith("launch."));
  const d = emptyDraft();
  d.proposal.risks = [item({ kind: "RISK", title: "Floods", seriousness: "HIGH", mitigation: null })];
  assert.ok(open(d).includes("launch.assumptions"));
  assert.ok(!open(d).includes("launch.risks"));
  d.proposal.risks.push(item({ kind: "ASSUMPTION", title: "Roads open", seriousness: "LOW", mitigation: null }));
  assert.ok(!open(d).includes("launch.assumptions"));
  const off = applyOperation(emptyDraft(), { kind: "ANSWER_NOT_USED", requirement: "launch.assumptions" }).draft;
  assert.ok(!open(off).includes("launch.assumptions"));
});

test("there is no checklist to set up: the product builds it from the project's data, so the wizard neither asks for it nor accepts it", () => {
  const kinds = Object.keys(DRAFT_OPERATIONS);
  assert.ok(!kinds.some((k) => /CHECKLIST/.test(k)));
  assert.equal("checklist" in emptyDraft().extras, false);
  assert.ok(!SETUP_REQUIREMENTS.some((r) => /checklist/.test(r.key)));
});

test("the dashboard is one of the real starting dashboards, and can be cleared", () => {
  const d = emptyDraft();
  const id = SECTOR_TEMPLATES[0].id;
  assert.equal(applyOperation(d, { kind: "SET_DASHBOARD", templateKey: "tpl-nope" }).ok, false);
  const set = applyOperation(d, { kind: "SET_DASHBOARD", templateKey: id }).draft;
  assert.equal(set.extras.dashboardTemplate, id);
  assert.equal("dashboardTemplate" in applyOperation(set, { kind: "SET_DASHBOARD", templateKey: null }).draft.extras, false);
});

test("the summary counts what will be created and who is invited when", () => {
  const d = emptyDraft();
  d.proposal.logframe = [item({ level: "GOAL", code: "G1", title: "g", description: null, parentCode: null }), item({ level: "OUTCOME", code: "OC1", title: "o", description: null, parentCode: "G1" }, { status: "REJECTED" })];
  d.proposal.indicators = [item({ code: "I1", title: "i" }, { sourceQuote: "i", status: "ACCEPTED" }), item({ code: "I2", title: "j" }, { sourceQuote: "j", status: "REJECTED" })];
  d.proposal.risks = [item({ kind: "RISK", title: "a" }), item({ kind: "ASSUMPTION", title: "b" }), item({ kind: "ASSUMPTION", title: "c" })];
  d.extras.team = [{ key: "a", name: "A", email: "a@x.org", role: "VIEWER", external: false, invite: "NOW" }, { key: "b", name: "B", email: null, role: "VIEWER", external: false, invite: "LATER" }];
  const s = launchSummary(d);
  assert.deepEqual([s.results, s.indicators, s.risks, s.assumptions, s.people, s.invitedAtLaunch, s.invitedLater], [1, 1, 1, 2, 2, 1, 1]);
  assert.deepEqual(s.fromDocuments, { accepted: 1, leftOut: 1 }, "only items read from a document are counted in the comparison");
});

test("an entry with no rating holds the risks requirement open instead of being left out at launch", () => {
  const open = (d) => gapInbox(evaluateRequirements(d, SETUP_REQUIREMENTS)).filter((r) => r.key === "launch.risks").map((r) => [r.code, r.params.first]);
  const d = emptyDraft();
  d.proposal.risks = [item({ kind: "RISK", title: "Floods", seriousness: "HIGH", mitigation: null }), item({ kind: "ASSUMPTION", title: "Roads stay open", seriousness: null, mitigation: null })];
  assert.deepEqual(open(d), [["risksUnrated", "Roads stay open"]]);
  d.proposal.risks[1].value.seriousness = "LOW";
  assert.deepEqual(open(d), []);
});

test("the plain apply's 'budget lines not created' note is recognised so the wizard can drop it (its own step creates them)", async () => {
  const { budgetNotApplied, isBudgetNotAppliedNote } = await import("../dist/index.js");
  const p = { budget: [{ value: { kind: "LINE" }, status: "ACCEPTED" }] };
  const notes = budgetNotApplied(p);
  assert.equal(notes.length, 1);
  assert.equal(isBudgetNotAppliedNote(notes[0]), true);
  assert.equal(isBudgetNotAppliedNote("Something else"), false);
});
