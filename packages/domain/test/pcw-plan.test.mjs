import test from "node:test";
import assert from "node:assert/strict";
import {
  PLAN_OPERATIONS, applyPlanOperation, SETUP_LINK_SUGGESTERS, suggestSetupLinks, planCoverage, planKeyOf,
  applyOperation, emptyDraft, evaluateRequirements, SETUP_REQUIREMENTS, gapInbox,
} from "../dist/index.js";

const item = (value, extra = {}) => ({ value, sourceQuote: null, sourceRef: null, confidence: "HIGH", status: "EDITED", ...extra });
const person = (key, name, role, extra = {}) => ({ key, name, email: null, role, external: false, invite: "LATER", ...extra });

/** A draft with one activity under one output, one indicator on the output, two places and a small team. */
function draft() {
  const d = emptyDraft();
  d.proposal.logframe = [
    item({ level: "OUTPUT", code: "OP1", title: "Wells built", description: null, parentCode: null }),
    item({ level: "ACTIVITY", code: "A1", title: "Drill wells", description: null, parentCode: "OP1" }),
  ];
  d.proposal.indicators = [item({ code: "I1", title: "Wells working", logframeCode: "OP1", type: "NUMBER", unit: null, baseline: null, target: "20", targetSchedule: null, frequency: null, direction: null, disaggregation: null, meansOfVerification: null })];
  d.proposal.places = [item({ name: "Gulu District", adminLevel: 2, parentName: null, latitude: null, longitude: null }), item({ name: "Kitgum", adminLevel: 2, parentName: null, latitude: null, longitude: null })];
  d.proposal.plan = [item({ title: "Drill wells in Gulu", logframeCode: "A1", start: "2026-02-01", end: "2026-06-30", location: "Gulu", lead: "Ali Hassan", planCode: "1.1" })];
  d.extras.team = [person("pm", "Pat", "PROJECT_MANAGER"), person("ali", "Ali Hassan", "FIELD_OFFICER")];
  return d;
}
const key = (d) => planKeyOf(d.proposal.plan[0].value);

// ---------- plan operations ----------

const run = (p, op) => { const r = applyPlanOperation(p, op); assert.equal(r.ok, true, r.reason); return r.proposal; };
const refused = (p, op) => { const r = applyPlanOperation(p, op); assert.equal(r.ok, false); return r.reason; };

test("every plan operation kind has a handler", () => {
  assert.deepEqual(Object.keys(PLAN_OPERATIONS).sort(), ["ADD_PLAN", "EDIT_PLAN"]);
});

test("a typed activity is the person's, has its own key, and must sit under a real activity with sensible dates", () => {
  const p = draft().proposal;
  const added = run(p, { kind: "ADD_PLAN", title: "Train staff", logframeCode: "A1", start: "2026-03-01", end: "2026-03-05" });
  const v = added.plan[1].value;
  assert.equal(added.plan[1].status, "EDITED");
  assert.equal(v.key, "new:2");
  assert.equal(v.linkSource, "PERSON");
  assert.match(refused(p, { kind: "ADD_PLAN", title: " " }), /name/);
  assert.match(refused(p, { kind: "ADD_PLAN", title: "x", logframeCode: "OP1" }), /project's activities/);
  assert.match(refused(p, { kind: "ADD_PLAN", title: "x", start: "01/03/2026" }), /year-month-day/);
  assert.match(refused(p, { kind: "ADD_PLAN", title: "x", start: "2026-03-05", end: "2026-03-01" }), /before the start/);
  assert.equal(applyPlanOperation(p, { kind: "ADD_PLAN", title: "No dates yet" }).ok, true, "dates may be left empty, never invented");
});

test("keys of new rows are unique", () => {
  let p = draft().proposal;
  p = run(p, { kind: "ADD_PLAN", title: "A" });
  p = run(p, { kind: "ADD_PLAN", title: "B" });
  const keys = p.plan.map((x) => planKeyOf(x.value));
  assert.equal(new Set(keys).size, keys.length);
});

test("editing a row keeps the address it had, so links already chosen survive a new title or date", () => {
  const d = draft();
  const before = key(d);
  assert.equal(before, "code:1.1");
  const edited = run(d.proposal, { kind: "EDIT_PLAN", path: "plan.0", patch: { title: "Drill boreholes", start: "2026-02-10", planCode: undefined } });
  assert.equal(planKeyOf(edited.plan[0].value), before);
  const rowKeyed = { ...draft().proposal, plan: [item({ title: "Row", logframeCode: "A1", start: "2026-02-01", end: null, location: null, lead: null })] };
  const rowBefore = planKeyOf(rowKeyed.plan[0].value);
  const moved = run(rowKeyed, { kind: "EDIT_PLAN", path: "plan.0", patch: { title: "Renamed", start: "2026-04-01" } });
  assert.equal(planKeyOf(moved.plan[0].value), rowBefore);
});

test("editing validates the same way and refuses a row that is not there", () => {
  const p = draft().proposal;
  assert.match(refused(p, { kind: "EDIT_PLAN", path: "plan.0", patch: { end: "2026-01-01" } }), /before the start/);
  assert.match(refused(p, { kind: "EDIT_PLAN", path: "plan.0", patch: { logframeCode: "nope" } }), /project's activities/);
  assert.match(refused(p, { kind: "EDIT_PLAN", path: "plan.5", patch: {} }), /not in the plan/);
  assert.match(refused(p, { kind: "EDIT_PLAN", path: "plan.0", patch: { title: " " } }), /name/);
});

// ---------- the suggester contract: every suggester obeys it ----------

for (const suggester of SETUP_LINK_SUGGESTERS) {
  test(`suggester ${suggester.key}: deterministic, reasoned, in-draft, and never repeats what exists or was rejected`, () => {
    const d = draft();
    const first = suggester.suggest(d);
    assert.ok(first.length > 0, "the fixture gives it something to offer");
    assert.deepEqual(suggester.suggest(d), first, "same draft, same suggestions");
    for (const s of first) {
      assert.ok(s.reason.length > 10 && !/[_A-Z]{5,}/.test(s.reason), "a reason in plain words");
      assert.equal(s.id, `${s.kind}:${s.planKey}:${s.value}`);
      assert.equal(s.planKey, key(d), "only about rows of this draft");
    }
    const taken = applyOperation(d, { kind: "ACCEPT_SUGGESTIONS", ids: first.map((s) => s.id) }).draft;
    assert.deepEqual(suggester.suggest(taken), [], "what is linked is not offered again");
    const rejected = { ...d, extras: { ...d.extras, rejectedSuggestions: first.map((s) => s.id) } };
    assert.deepEqual(suggestSetupLinks(rejected).filter((s) => first.some((f) => f.id === s.id)), [], "what was rejected is not offered again");
    const before = JSON.stringify(d);
    suggester.suggest(d);
    assert.equal(JSON.stringify(d), before);
  });
}

test("the suggestions say what they are: indicators of the output, places named, and the lead the plan names", () => {
  const all = suggestSetupLinks(draft());
  assert.deepEqual(all.map((s) => [s.kind, s.value]).sort(), [["INDICATOR", "I1"], ["LEAD", "ali"], ["PLACE", "Gulu District"]]);
  assert.match(all.find((s) => s.kind === "INDICATOR").reason, /Wells built/);
  assert.match(all.find((s) => s.kind === "LEAD").reason, /names Ali Hassan/);
  assert.equal(all.some((s) => s.value === "Kitgum"), false, "a place the activity does not name is not offered");
});

test("a lead is guessed from the team only when there is exactly one field officer", () => {
  const d = draft();
  d.proposal.plan[0].value.lead = null;
  assert.match(suggestSetupLinks(d).find((s) => s.kind === "LEAD").reason, /only field officer/);
  d.extras.team.push(person("bo", "Bo", "FIELD_OFFICER"));
  assert.equal(suggestSetupLinks(d).some((s) => s.kind === "LEAD"), false);
  d.extras.team = [person("pm", "Pat", "PROJECT_MANAGER"), person("ext", "Ext", "FIELD_OFFICER", { external: true })];
  assert.equal(suggestSetupLinks(d).some((s) => s.kind === "LEAD"), false, "an outside partner is not offered as the lead");
});

test("a place name is matched as a whole word, and short names are ignored", () => {
  const d = draft();
  d.proposal.places.push(item({ name: "Gu", adminLevel: 2, parentName: null, latitude: null, longitude: null }));
  d.proposal.plan[0].value.title = "Guarantee review";
  d.proposal.plan[0].value.location = null;
  assert.deepEqual(suggestSetupLinks(d).filter((s) => s.kind === "PLACE"), []);
});

test("accepting links the chosen things, and refuses a suggestion that is no longer offered", () => {
  const d = draft();
  const ids = suggestSetupLinks(d).map((s) => s.id);
  const r = applyOperation(d, { kind: "ACCEPT_SUGGESTIONS", ids });
  assert.equal(r.ok, true);
  assert.deepEqual(r.draft.extras.planSetup[key(d)], { placeNames: ["Gulu District"], projectWide: false, indicatorCodes: ["I1"], requiredFiles: [], recordsParticipants: false, leadKey: "ali" });
  assert.equal(applyOperation(r.draft, { kind: "ACCEPT_SUGGESTIONS", ids }).ok, false, "accepting twice is refused, not repeated");
  assert.match(applyOperation(d, { kind: "ACCEPT_SUGGESTIONS", ids: ["PLACE:x:y"] }).reason, /no longer offered/);
  assert.equal(JSON.stringify(d).includes('"leadKey"'), false, "the draft given is unchanged");
});

// ---------- coverage ----------

test("coverage counts the same things the requirements ask", () => {
  const d = draft();
  assert.deepEqual(planCoverage(d), { activities: { covered: 1, total: 1 }, plans: { complete: 0, total: 1 }, indicators: { fed: 0, total: 1 } });
  const done = applyOperation(d, { kind: "ACCEPT_SUGGESTIONS", ids: suggestSetupLinks(d).map((s) => s.id) }).draft;
  assert.deepEqual(planCoverage(done), { activities: { covered: 1, total: 1 }, plans: { complete: 1, total: 1 }, indicators: { fed: 1, total: 1 } });
  const open = (x) => gapInbox(evaluateRequirements(x, SETUP_REQUIREMENTS)).map((r) => r.key).filter((k) => k.startsWith("plan."));
  assert.ok(open(d).includes("plan.complete") && open(d).includes("plan.indicatorFed"));
  assert.deepEqual(open(done), []);
});
