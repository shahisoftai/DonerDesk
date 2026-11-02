import test from "node:test";
import assert from "node:assert/strict";
import { projectInputFromDraft, entryWindowFor, LAUNCH_STEPS, notWrittenAtLaunch, emptyDraft, proposalForLaunch, costCategoryOf, COST_CATEGORY_WORDS, budgetLinesForLaunch, SUPPORT_LINE, budgetKeyOf, responsibilitiesOf, readResponsibilities, describeResponsibility, planKeyOf } from "../dist/index.js";

const item = (value) => ({ value, sourceQuote: null, sourceRef: null, confidence: "HIGH", status: "EDITED" });
const person = (key, role, email) => ({ key, name: key, email, role, external: false, invite: "LATER" });
const ctx = { organisationName: "Hope NGO", userId: "admin-1", userIdByEmail: new Map([["pat@x.org", "u-pat"]]) };

function draft() {
  const d = emptyDraft();
  const f = d.proposal.facts;
  f.name = item("WASH Gulu"); f.code = item("WG-1"); f.startDate = item("2026-01-01"); f.endDate = item("2027-12-31"); f.currency = item("EUR"); f.summary = item("Water for families.");
  d.extras.start = { donor: " EU ", sector: "WASH", country: " Uganda ", withDocuments: false };
  d.extras.schedule.cadence = "QUARTERLY";
  d.extras.team = [person("pm", "PROJECT_MANAGER", "Pat@X.org"), person("me", "ME_OFFICER", "me@x.org")];
  return d;
}

test("the project is built from the draft, the organisation's own name and the person launching", () => {
  const r = projectInputFromDraft(draft(), ctx);
  assert.equal(r.ok, true);
  assert.deepEqual(r.input, {
    title: "WASH Gulu", projectCode: "WG-1", donorName: "EU", implementingOrganization: "Hope NGO", country: "Uganda", sector: "WASH",
    startDate: "2026-01-01T00:00:00.000Z", endDate: "2027-12-31T00:00:00.000Z", reportingFrequency: "QUARTERLY",
    projectManagerId: "u-pat", budgetCurrency: "EUR", description: "Water for families.",
  });
});

test("the manager is the person launching when the team's manager has no account; the M&E officer is left empty", () => {
  const d = draft();
  d.extras.team = [person("pm", "PROJECT_MANAGER", "new@x.org"), person("me", "ME_OFFICER", null)];
  const r = projectInputFromDraft(d, ctx);
  assert.equal(r.input.projectManagerId, "admin-1");
  assert.equal("meOfficerId" in r.input, false, "nobody is named who cannot be");
  d.extras.team = [person("pm", "PROJECT_MANAGER", "pat@x.org"), person("me", "ME_OFFICER", "pat@x.org")];
  assert.equal(projectInputFromDraft(d, ctx).input.meOfficerId, "u-pat");
});

test("the reporting currency from finance wins over the one in the facts; none is left out, not invented", () => {
  const d = draft();
  d.extras.finance.reportingCurrency = "USD";
  assert.equal(projectInputFromDraft(d, ctx).input.budgetCurrency, "USD");
  d.extras.finance.reportingCurrency = undefined;
  d.proposal.facts.currency = item(null);
  assert.equal("budgetCurrency" in projectInputFromDraft(d, ctx).input, false);
});

test("a draft that cannot make a project says what is missing, in words", () => {
  const miss = (change) => { const d = draft(); change(d); const r = projectInputFromDraft(d, ctx); assert.equal(r.ok, false); return r.reason; };
  assert.match(miss((d) => { d.proposal.facts.name = item(null); }), /name, a code and start and end dates/);
  assert.match(miss((d) => { d.extras.start.donor = undefined; }), /donor/);
  assert.match(miss((d) => { d.extras.start.country = undefined; }), /country/);
  assert.match(miss((d) => { d.extras.start.sector = "MOON"; }), /sector/);
  assert.match(miss((d) => { d.extras.schedule.cadence = "CUSTOM"; }), /how often/);
  assert.match(miss((d) => { d.extras.schedule.cadence = undefined; }), /how often/);
});

test("the cadence a document stated is used when the person has not chosen one", () => {
  const d = draft();
  d.extras.schedule.cadence = undefined;
  d.proposal.periods = [{ value: { type: "MONTHLY", start: null, end: null }, sourceQuote: "monthly", sourceRef: null, confidence: "HIGH", status: "ACCEPTED" }];
  assert.equal(projectInputFromDraft(d, ctx).input.reportingFrequency, "MONTHLY");
});

test("an entry window is counted in days from the period's last day, across month and year ends", () => {
  assert.deepEqual(entryWindowFor("2026-03-31T00:00:00.000Z", { opensDaysBefore: 10, closesDaysAfter: 15 }), { opensOn: "2026-03-21", closesOn: "2026-04-15" });
  assert.deepEqual(entryWindowFor("2026-12-31", { opensDaysBefore: 0, closesDaysAfter: 1 }), { opensOn: "2026-12-31", closesOn: "2027-01-01" });
});

test("the wizard's steps are listed in order with a plain name", () => {
  assert.deepEqual(LAUNCH_STEPS.map((s) => s.key), ["REVIEW_MODE", "ENTRY_WINDOWS", "FORMS", "RESPONSIBILITIES", "BUDGET_LINES", "DASHBOARD", "INVITATIONS", "ACTIVATION"]);
  assert.ok(LAUNCH_STEPS.every((s) => s.label.length > 5 && !/[_A-Z]{4,}/.test(s.label)));
  assert.equal(LAUNCH_STEPS.at(-1).key, "ACTIVATION", "starting the project is last: it happens only when everything before it worked");
});

test("what launching does not write is listed in words, and only for what the draft holds", () => {
  assert.deepEqual(notWrittenAtLaunch(emptyDraft()), []);
  const d = draft();
  d.extras.indicatorSetup = { I1: { ownerKey: "pm" }, I2: { ownerKey: "me" }, I3: { method: "FORM" } };
  d.extras.planSetup = { a: { placeNames: ["Gulu"], projectWide: false, indicatorCodes: [], leadKey: "pm", requiredFiles: [], recordsParticipants: false } };
  d.proposal.budget = [item({ category: "Wells", amount: "10", currency: "EUR", logframeCode: null, kind: "LINE" })];
  d.extras.finance.budgetPlan = { [budgetKeyOf({ category: "Wells", amount: "10" })]: SUPPORT_LINE };
  d.extras.dashboardTemplate = "tpl-health-mnch";
  const said = notWrittenAtLaunch(d);
  assert.equal(said.length, 1, "the verifier, approvers, evidence default and checklist are not collected, so there is nothing to say about them");
  assert.match(said[0], /^1 budget line that pay for the whole project/);
  assert.ok(!said.some((t) => /activity lead|starting dashboard/.test(t)), "leads and the dashboard are written now");
  assert.ok(!said.some((t) => /indicator owner/.test(t)), "owners are written now");
  assert.ok(!said.some((t) => /Places for/.test(t)), "places are written now");
  assert.ok(said.every((s) => s.length > 20));
});

// ---------- responsibilities and folding ----------

test("a person's responsibilities are the indicators they own, in a stable order, and none for someone who owns nothing", () => {
  const d = draft();
  d.extras.indicatorSetup = { I2: { ownerKey: "pm" }, I1: { ownerKey: "pm" }, I3: { ownerKey: "me" }, I4: { method: "FORM" } };
  assert.deepEqual(responsibilitiesOf(d, "pm"), [{ kind: "INDICATOR_OWNER", indicatorCode: "I1" }, { kind: "INDICATOR_OWNER", indicatorCode: "I2" }]);
  assert.deepEqual(responsibilitiesOf(d, "nobody"), []);
  assert.equal(describeResponsibility({ kind: "INDICATOR_OWNER", indicatorCode: "I1" }), "owns indicator I1");
});

test("stored responsibilities are read back defensively: damaged or unknown ones are dropped, never trusted", () => {
  assert.deepEqual(readResponsibilities('[{"kind":"INDICATOR_OWNER","indicatorCode":"I1"},{"kind":"ROCKET","x":1},{"kind":"INDICATOR_OWNER"},"x",null]'), [{ kind: "INDICATOR_OWNER", indicatorCode: "I1" }]);
  assert.deepEqual(readResponsibilities("not json"), []);
  assert.deepEqual(readResponsibilities('{"kind":"INDICATOR_OWNER"}'), []);
});

test("a planned activity's places become the location the apply writes; the document's own location wins; the stored proposal is untouched", () => {
  const d = draft();
  const row = (title, location, planCode) => item({ title, logframeCode: null, start: null, end: null, location, lead: null, planCode });
  d.proposal.plan = [row("A", null, "1"), row("B", "Written in the document", "2"), row("C", null, "3"), row("D", null, "4")];
  d.extras.planSetup = {
    [planKeyOf({ planCode: "1" })]: { placeNames: ["Gulu", "Kitgum"], projectWide: false, indicatorCodes: [], requiredFiles: [], recordsParticipants: false },
    [planKeyOf({ planCode: "2" })]: { placeNames: ["Gulu"], projectWide: false, indicatorCodes: [], requiredFiles: [], recordsParticipants: false },
    [planKeyOf({ planCode: "3" })]: { placeNames: [], projectWide: true, indicatorCodes: [], requiredFiles: [], recordsParticipants: false },
  };
  const before = JSON.stringify(d.proposal);
  const folded = proposalForLaunch(d);
  assert.deepEqual(folded.plan.map((p) => p.value.location), ["Gulu; Kitgum", "Written in the document", "Project-wide", null]);
  assert.equal(JSON.stringify(d.proposal), before);
});

test("the plan and the places can be applied: a period is stated from the chosen frequency when none was read", () => {
  const d = draft();
  assert.equal(d.proposal.periods.length, 0);
  const folded = proposalForLaunch(d);
  assert.deepEqual(folded.periods.map((p) => [p.value.type, p.status]), [["QUARTERLY", "EDITED"]]);
  assert.equal(d.proposal.periods.length, 0, "the stored proposal is not changed");
  d.proposal.periods = [{ value: { type: "MONTHLY", start: null, end: null }, sourceQuote: "monthly", sourceRef: null, confidence: "HIGH", status: "ACCEPTED" }];
  assert.deepEqual(proposalForLaunch(d).periods.map((p) => p.value.type), ["MONTHLY"], "one the document gave is kept, and none is added");
  d.proposal.periods[0].status = "REJECTED";
  assert.deepEqual(proposalForLaunch(d).periods.map((p) => p.status), ["REJECTED", "EDITED"]);
  delete d.extras.schedule.cadence;
  assert.deepEqual(proposalForLaunch(d).periods.map((p) => p.status), ["REJECTED"], "no frequency chosen, no period invented");
});

test("a planned activity's lead is a responsibility found again by title and start, for people who joined or not", () => {
  const d = draft();
  d.proposal.plan = [item({ title: "Drill wells", logframeCode: null, start: "2027-04-01", end: null, location: null, lead: null, planCode: "1.1" }), item({ title: "Train staff", logframeCode: null, start: null, end: null, location: null, lead: null, planCode: "1.2" })];
  d.extras.planSetup = {
    [planKeyOf({ planCode: "1.1" })]: { placeNames: [], projectWide: true, indicatorCodes: [], leadKey: "pm", requiredFiles: [], recordsParticipants: false },
    [planKeyOf({ planCode: "1.2" })]: { placeNames: [], projectWide: true, indicatorCodes: [], leadKey: "me", requiredFiles: [], recordsParticipants: false },
  };
  d.extras.indicatorSetup = { I1: { ownerKey: "pm" } };
  assert.deepEqual(responsibilitiesOf(d, "pm"), [{ kind: "INDICATOR_OWNER", indicatorCode: "I1" }, { kind: "PLAN_LEAD", title: "Drill wells", start: "2027-04-01" }]);
  assert.deepEqual(responsibilitiesOf(d, "me"), [{ kind: "PLAN_LEAD", title: "Train staff", start: null }]);
  assert.equal(describeResponsibility({ kind: "PLAN_LEAD", title: "Drill wells", start: null }), "leads “Drill wells”");
  assert.deepEqual(readResponsibilities(JSON.stringify([{ kind: "PLAN_LEAD", title: "A", start: null }, { kind: "PLAN_LEAD", title: 5 }, { kind: "PLAN_LEAD", title: "B", start: 7 }])), [{ kind: "PLAN_LEAD", title: "A", start: null }]);
});

test("a cost's kind comes from clear words in its name, and 'Other' when they say nothing", () => {
  assert.equal(costCategoryOf("Staff salaries"), "PERSONNEL");
  assert.equal(costCategoryOf("Travel and per diem"), "TRAVEL");
  assert.equal(costCategoryOf("Training materials"), "SUPPLIES", "the first kind in the table that matches wins");
  assert.equal(costCategoryOf("Vehicle hire"), "EQUIPMENT");
  assert.equal(costCategoryOf("External audit"), "SERVICES");
  assert.equal(costCategoryOf("Borehole rehabilitation"), "OTHER");
  assert.equal(costCategoryOf("Traveller's guide"), "OTHER", "whole words only");
  assert.equal(costCategoryOf(null), "OTHER");
  const seen = COST_CATEGORY_WORDS.flatMap((c) => c.words);
  assert.equal(new Set(seen).size, seen.length, "no word belongs to two kinds");
});

test("budget lines are made on the activity chosen for them; whole-project lines are counted, not made", () => {
  const d = draft();
  d.proposal.plan = [item({ title: "Drill wells", logframeCode: null, start: "2027-04-01", end: null, location: null, lead: null, planCode: "1.1" })];
  d.proposal.budget = [
    item({ category: "Staff salaries", amount: "4000", currency: "EUR", logframeCode: null, kind: "LINE", ref: "F1" }),
    item({ category: "Rig hire", amount: "2500.50", currency: "EUR", logframeCode: null, kind: "LINE" }),
    item({ category: "Office", amount: "100", currency: "EUR", logframeCode: null, kind: "LINE" }),
    item({ category: "Unplaced", amount: "5", currency: "EUR", logframeCode: null, kind: "LINE" }),
    item({ category: "Total project cost", amount: "6600.50", currency: "EUR", logframeCode: null, kind: "TOTAL" }),
  ];
  const key = planKeyOf({ planCode: "1.1" });
  d.extras.finance.budgetPlan = { [budgetKeyOf(d.proposal.budget[0].value)]: key, [budgetKeyOf(d.proposal.budget[1].value)]: key, [budgetKeyOf(d.proposal.budget[2].value)]: SUPPORT_LINE };
  const r = budgetLinesForLaunch(d);
  assert.equal(r.support, 1);
  assert.deepEqual(r.lines, [
    { title: "Drill wells", start: "2027-04-01", code: "F1", category: "PERSONNEL", description: "Staff salaries", currency: "EUR", amount: "4000" },
    { title: "Drill wells", start: "2027-04-01", code: "B2", category: "OTHER", description: "Rig hire", currency: "EUR", amount: "2500.50" },
  ]);
});
