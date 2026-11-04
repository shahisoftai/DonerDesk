import test from "node:test";
import assert from "node:assert/strict";
import {
  SETUP_SLIDES, SLIDE_KEYS, SLIDE_ORDER, SETUP_REQUIREMENTS, AUTOMATIC_STEPS, DEFERRED_STEPS,
  emptyDraft, upgradeProposal, planKeyOf, budgetKeyOf, SUPPORT_LINE,
  evaluateRequirements, gapInbox, slideProgress, canLaunch, signOffDraft, signOffIsCurrent, draftFingerprint,
  DRAFT_OPERATIONS, applyOperation, personReferences,
} from "../dist/index.js";

// ---------- fixtures ----------

const item = (value, extra = {}) => ({ value, sourceQuote: null, sourceRef: null, confidence: "HIGH", status: "EDITED", ...extra });

const person = (key, role, extra = {}) => ({ key, name: key, email: `${key}@x.org`, role, external: false, invite: "LATER", ...extra });

/** A draft in which every requirement holds. */
function completeDraft() {
  const d = emptyDraft(false);
  const f = d.proposal.facts;
  f.name = item("WASH Gulu"); f.code = item("WG-1"); f.startDate = item("2026-01-01"); f.endDate = item("2027-12-31"); f.currency = item("EUR");
  d.proposal.logframe = [
    item({ level: "OUTCOME", code: "OC1", title: "Safe water", description: null, parentCode: null, codeSource: "DOCUMENT" }),
    item({ level: "OUTPUT", code: "OP1", title: "Wells built", description: null, parentCode: "OC1", codeSource: "DOCUMENT" }),
    item({ level: "ACTIVITY", code: "A1", title: "Drill wells", description: null, parentCode: "OP1", codeSource: "DOCUMENT" }),
  ];
  d.proposal.indicators = [
    item({ code: "I1", title: "Wells", logframeCode: "OP1", type: "NUMBER", unit: "wells", baseline: "0", target: "20", targetSchedule: null, frequency: "MONTHLY", direction: null, disaggregation: null, meansOfVerification: null }),
  ];
  d.proposal.plan = [item({ title: "Drill wells", logframeCode: "A1", start: "2026-02-01", end: "2026-06-30", location: null, lead: null, planCode: "1.1" })];
  d.proposal.places = [item({ name: "Gulu", adminLevel: 2, parentName: null, latitude: null, longitude: null })];
  d.proposal.funding = [item({ sourceName: "EU", amount: "100000", currency: "EUR" })];
  d.proposal.budget = [item({ category: "Wells", amount: "100000", currency: "EUR", logframeCode: "A1", kind: "LINE" })];
  d.proposal.risks = [item({ kind: "RISK", title: "Floods", seriousness: "MEDIUM", mitigation: "Plan early" }), item({ kind: "ASSUMPTION", title: "Roads stay open", seriousness: "LOW", mitigation: null })];
  const e = d.extras;
  e.start = { donor: "EU", sector: "WASH", country: "Uganda", withDocuments: false };
  e.team = [person("pm", "PROJECT_MANAGER"), person("me", "ME_OFFICER"), person("fo", "FIELD_OFFICER"), person("ngo", "FIELD_OFFICER", { external: true })];
  e.indicatorSetup = { I1: { ownerKey: "me", method: "FORM", directionConfirmed: true } };
  e.planSetup = { [planKeyOf({ planCode: "1.1", title: "Drill wells", start: "2026-02-01" })]: { placeNames: ["Gulu"], projectWide: false, indicatorCodes: ["I1"], leadKey: "fo", requiredFiles: [], recordsParticipants: false } };
  e.projectArea = "Gulu District";
  e.collection = { reviewMode: "SIMPLE", windowRule: { opensDaysBefore: 10, closesDaysAfter: 15 } };
  e.schedule = { cadence: "QUARTERLY", reminders: true, rules: [{ reportType: "QUARTERLY", template: "BUILT_IN", dueDaysAfterEnd: 30 }] };
  e.finance = { reportingCurrency: "EUR", differenceAcknowledged: false, budgetPlan: { [budgetKeyOf({ category: "Wells", amount: "100000" })]: SUPPORT_LINE } };
  e.dashboardTemplate = "WASH_OVERVIEW";
  return d;
}

const results = (d) => evaluateRequirements(d, SETUP_REQUIREMENTS);
const openKeys = (d) => gapInbox(results(d)).map((r) => r.key);

// ---------- slides ----------

test("there are ten slides, in a unique order, and each only depends on earlier slides", () => {
  assert.equal(SLIDE_KEYS.length, 10);
  assert.deepEqual(SLIDE_ORDER.map((k) => SETUP_SLIDES[k].order), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  for (const key of SLIDE_KEYS) {
    assert.equal(SETUP_SLIDES[key].key, key);
    for (const dep of SETUP_SLIDES[key].dependsOn) assert.ok(SETUP_SLIDES[dep].order < SETUP_SLIDES[key].order, `${key} depends on later slide ${dep}`);
  }
});

// ---------- requirements table ----------

test("every requirement has a unique key, a real slide and covers at least one step; every slide has one", () => {
  const keys = SETUP_REQUIREMENTS.map((r) => r.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const r of SETUP_REQUIREMENTS) {
    assert.ok(SETUP_SLIDES[r.slide], r.key);
    assert.ok(r.coversSteps.length > 0, r.key);
    if (r.unlessNotUsed) assert.ok(keys.includes(r.unlessNotUsed), `${r.key} points at a missing switch`);
  }
  for (const slide of SLIDE_KEYS) assert.ok(SETUP_REQUIREMENTS.some((r) => r.slide === slide), `no requirement on ${slide}`);
});

test("all 47 setup steps are accounted for: a requirement, Launch itself, or a named deferral", () => {
  const covered = new Set([...SETUP_REQUIREMENTS.flatMap((r) => r.coversSteps), ...AUTOMATIC_STEPS, ...Object.keys(DEFERRED_STEPS).map(Number)]);
  const missing = Array.from({ length: 47 }, (_, i) => i + 1).filter((n) => !covered.has(n));
  assert.deepEqual(missing, []);
  for (const reason of Object.values(DEFERRED_STEPS)) assert.ok(reason.length > 10);
});

test("a requirement that cannot be left out is never turned off by an answer", () => {
  const d = completeDraft();
  d.proposal.facts.name = item(null);
  d.extras.answers["project.facts"] = { notUsed: true };
  assert.ok(openKeys(d).includes("project.facts"));
});

test("every requirement is total: an empty draft never throws and leaves things open", () => {
  for (const withDocs of [false, true]) {
    const r = results(emptyDraft(withDocs));
    assert.equal(r.length, SETUP_REQUIREMENTS.length);
    assert.ok(gapInbox(r).length > 0);
  }
  assert.doesNotThrow(() => results(upgradeProposal(emptyDraft().proposal)));
});

// ---------- evaluation ----------

test("a complete draft has nothing open and every slide is complete", () => {
  const d = completeDraft();
  assert.deepEqual(openKeys(d), []);
  for (const slide of SLIDE_KEYS) assert.equal(slideProgress(results(d), slide).complete, true, slide);
});

test("an edit on one slide re-opens what it breaks on another", () => {
  const d = completeDraft();
  d.proposal.indicators = [];
  assert.ok(openKeys(d).includes("indicators.perOutput"));
  const e = completeDraft();
  e.proposal.logframe = e.proposal.logframe.filter((n) => n.value.level !== "ACTIVITY");
  assert.equal(openKeys(e).includes("results.chain"), true);
});

test("the inbox follows slide order and names the first thing to fix", () => {
  const d = completeDraft();
  d.extras.team = d.extras.team.filter((p) => p.role !== "PROJECT_MANAGER");
  d.extras.start.donor = undefined;
  const inbox = gapInbox(results(d));
  assert.equal(inbox[0].slide, "START");
  assert.ok(inbox.some((r) => r.key === "project.manager"));
  const fine = completeDraft();
  fine.proposal.indicators[0].value.frequency = null;
  const gap = gapInbox(results(fine)).find((r) => r.key === "indicators.complete");
  assert.equal(gap.params.first, "I1");
});

test("an undecided document item keeps its area open; rejecting it is a decision", () => {
  const d = completeDraft();
  d.proposal.places.push({ value: { name: "Kitgum", adminLevel: 2, parentName: null, latitude: null, longitude: null }, sourceQuote: "Kitgum", sourceRef: null, confidence: "HIGH", status: "PROPOSED" });
  assert.ok(openKeys(d).includes("places.decided"));
  d.proposal.places[1].status = "REJECTED";
  assert.ok(!openKeys(d).includes("places.decided"));
});

test("a generated code stays open until the person keeps it", () => {
  const d = completeDraft();
  d.proposal.logframe[1].value.code = "OP-GEN";
  d.proposal.logframe[1].value.codeSource = "GENERATED";
  d.proposal.logframe[2].value.parentCode = "OP-GEN";
  d.proposal.indicators[0].value.logframeCode = "OP-GEN";
  assert.ok(openKeys(d).includes("results.codes"));
  const kept = applyOperation(d, { kind: "CONFIRM_CODES", codes: ["OP-GEN"] });
  assert.ok(!openKeys(kept.draft).includes("results.codes"));
});

test("an activity needs a place or 'project-wide', a lead on the team, and dates", () => {
  const d = completeDraft();
  const key = planKeyOf(d.proposal.plan[0].value);
  d.extras.planSetup[key].placeNames = [];
  assert.ok(openKeys(d).includes("plan.complete"));
  d.extras.planSetup[key].projectWide = true;
  assert.ok(!openKeys(d).includes("plan.complete"));
  d.extras.planSetup[key].leadKey = "nobody";
  assert.ok(openKeys(d).includes("plan.complete"));
});

test("an indicator is fed by an activity or has its own collection method", () => {
  const d = completeDraft();
  d.extras.planSetup[planKeyOf(d.proposal.plan[0].value)].indicatorCodes = [];
  assert.ok(!openKeys(d).includes("plan.indicatorFed"), "a form method counts");
  d.extras.indicatorSetup.I1.method = undefined;
  assert.ok(openKeys(d).includes("plan.indicatorFed"));
  assert.ok(openKeys(d).includes("entry.methods"));
});

test("a full review needs no named verifier: who verifies follows people's roles", () => {
  const d = completeDraft();
  d.extras.collection.reviewMode = "FULL";
  assert.ok(!openKeys(d).includes("entry.review"));
});

test("answering finance 'not used' switches the whole slide off, and a reason is optional", () => {
  const d = completeDraft();
  d.proposal.funding = [];
  d.proposal.budget = [];
  assert.ok(openKeys(d).includes("finance.funding"));
  const off = applyOperation(d, { kind: "ANSWER_NOT_USED", requirement: "finance.funding" });
  assert.equal(off.ok, true);
  const states = Object.fromEntries(results(off.draft).filter((r) => r.slide === "FINANCE").map((r) => [r.key, r.status]));
  assert.deepEqual(states, { "finance.funding": "NOT_USED", "finance.budget": "NOT_USED", "finance.reconcile": "NOT_USED" });
  assert.equal(off.draft.extras.answers["finance.funding"].reason, undefined);
  const withReason = applyOperation(d, { kind: "ANSWER_NOT_USED", requirement: "finance.funding", reason: "  Self-funded  " });
  assert.equal(withReason.draft.extras.answers["finance.funding"].reason, "Self-funded");
});

test("a budget that differs from its stated total needs an acknowledgement", () => {
  const d = completeDraft();
  d.proposal.budget.push(item({ category: "Total project cost", amount: "120000", currency: "EUR", logframeCode: null, kind: "TOTAL" }));
  assert.ok(openKeys(d).includes("finance.reconcile"));
  d.extras.finance.differenceAcknowledged = true;
  assert.ok(!openKeys(d).includes("finance.reconcile"));
});

test("a budget line must be tied to an activity or marked as a support line", () => {
  const d = completeDraft();
  d.extras.finance.budgetPlan = {};
  assert.ok(openKeys(d).includes("finance.budget"));
});

// ---------- launch gate ----------

test("Launch needs every requirement closed and a current sign-off", () => {
  const d = completeDraft();
  assert.deepEqual(canLaunch(results(d), d).blockers, [{ kind: "SIGN_OFF_MISSING" }]);
  const signed = signOffDraft(d, "u1", "2026-11-02T10:00:00Z", 0).draft;
  assert.equal(canLaunch(results(signed), signed).ok, true);
  const open = { ...signed, extras: { ...signed.extras } };
  delete open.extras.dashboardTemplate;
  assert.ok(canLaunch(results(open), open).blockers.some((b) => b.kind === "OPEN_REQUIREMENTS" && b.count === 1));
});

test("a sign-off goes stale the moment anything changes, and is never given to an unfinished draft", () => {
  const d = completeDraft();
  assert.equal(signOffDraft(d, "u1", "t", 2).ok, false);
  assert.match(signOffDraft(d, "u1", "t", 2).reason, /2 things are still to answer/);
  assert.match(signOffDraft(d, "u1", "t", 1).reason, /1 thing is still/);
  const signed = signOffDraft(d, "u1", "t", 0).draft;
  assert.equal(signOffIsCurrent(signed), true);
  const edited = applyOperation(signed, { kind: "SET_START", patch: { donor: "Someone else" } }).draft;
  assert.equal(signOffIsCurrent(edited), false);
  assert.deepEqual(canLaunch(results(edited), edited).blockers, [{ kind: "SIGN_OFF_STALE" }]);
  const proposalChanged = { ...signed, proposal: { ...signed.proposal, risks: [] } };
  assert.equal(signOffIsCurrent(proposalChanged), false);
  assert.equal(signOffIsCurrent(emptyDraft()), false);
});

test("the fingerprint ignores the sign-off itself and the order keys were written in", () => {
  const d = completeDraft();
  assert.equal(draftFingerprint(d), draftFingerprint(signOffDraft(d, "u1", "t", 0).draft));
  const reordered = { extras: d.extras, proposal: d.proposal };
  assert.equal(draftFingerprint(d), draftFingerprint(reordered));
  assert.notEqual(draftFingerprint(d), draftFingerprint({ ...d, extras: { ...d.extras, projectArea: "x" } }));
});

// ---------- operations ----------

test("every operation kind has exactly one handler", () => {
  const kinds = ["SET_START", "ADD_PERSON", "UPDATE_PERSON", "REMOVE_PERSON", "SET_INDICATOR_SETUP", "SET_PLAN_SETUP", "SET_PLACES_SETUP", "SET_COLLECTION", "SET_SCHEDULE", "SET_FINANCE", "CONFIRM_CODES", "ANSWER_NOT_USED", "REOPEN_REQUIREMENT", "REJECT_SUGGESTION", "ACCEPT_SUGGESTIONS", "ACCEPT_METHOD_SUGGESTIONS", "ACCEPT_BUDGET_SUGGESTIONS", "SET_DASHBOARD"];
  assert.deepEqual(Object.keys(DRAFT_OPERATIONS).sort(), [...kinds].sort());
});

test("operations never change the draft they were given", () => {
  const d = completeDraft();
  const before = JSON.stringify(d);
  applyOperation(d, { kind: "ADD_PERSON", person: person("new", "VIEWER") });
  applyOperation(d, { kind: "SET_START", patch: { donor: "USAID" } });
  applyOperation(d, { kind: "SET_INDICATOR_SETUP", code: "I1", patch: { ownerKey: "pm" } });
  assert.equal(JSON.stringify(d), before);
});

test("people: a duplicate, a bad email and an invite without an email are refused", () => {
  const d = completeDraft();
  assert.equal(applyOperation(d, { kind: "ADD_PERSON", person: person("pm", "VIEWER") }).ok, false);
  assert.equal(applyOperation(d, { kind: "ADD_PERSON", person: person("z", "VIEWER", { email: "nope" }) }).ok, false);
  assert.equal(applyOperation(d, { kind: "ADD_PERSON", person: person("z", "VIEWER", { email: null, invite: "NOW" }) }).ok, false);
  assert.equal(applyOperation(d, { kind: "ADD_PERSON", person: person("z", "VIEWER", { email: null, invite: "LATER" }) }).ok, true);
});

test("a person who owns something cannot be removed until it is handed over", () => {
  const d = completeDraft();
  assert.deepEqual(personReferences(d, "me"), ["an indicator owner"]);
  const refused = applyOperation(d, { kind: "REMOVE_PERSON", key: "me" });
  assert.equal(refused.ok, false);
  assert.match(refused.reason, /indicator owner/);
  assert.equal(applyOperation(d, { kind: "REMOVE_PERSON", key: "ngo" }).ok, true);
});

test("an owner or a lead has to be on the team", () => {
  const d = completeDraft();
  assert.equal(applyOperation(d, { kind: "SET_INDICATOR_SETUP", code: "I1", patch: { ownerKey: "ghost" } }).ok, false);
  assert.equal(applyOperation(d, { kind: "SET_PLAN_SETUP", planKey: "x", patch: { leadKey: "ghost" } }).ok, false);
  assert.equal(applyOperation(d, { kind: "SET_COLLECTION", patch: { windowRule: { opensDaysBefore: -1, closesDaysAfter: 5 } } }).ok, false);
});

test("an unknown or mandatory requirement cannot be answered 'not used'; reopening removes the answer", () => {
  const d = completeDraft();
  assert.equal(applyOperation(d, { kind: "ANSWER_NOT_USED", requirement: "nope" }).ok, false);
  assert.equal(applyOperation(d, { kind: "ANSWER_NOT_USED", requirement: "results.chain" }).ok, false);
  const used = applyOperation(d, { kind: "ANSWER_NOT_USED", requirement: "launch.dashboard" }).draft;
  assert.equal(used.extras.answers["launch.dashboard"].notUsed, true);
  const back = applyOperation(used, { kind: "REOPEN_REQUIREMENT", requirement: "launch.dashboard" }).draft;
  assert.equal(back.extras.answers["launch.dashboard"], undefined);
});

test("a rejected suggestion is remembered once", () => {
  let d = completeDraft();
  d = applyOperation(d, { kind: "REJECT_SUGGESTION", id: "planToPlace:a:b" }).draft;
  d = applyOperation(d, { kind: "REJECT_SUGGESTION", id: "planToPlace:a:b" }).draft;
  assert.deepEqual(d.extras.rejectedSuggestions, ["planToPlace:a:b"]);
});

test("draft keys: a plan row is keyed by its own code, else its title and start", () => {
  assert.equal(planKeyOf({ planCode: " 7.1 ", title: "x", start: null }), "code:7.1");
  assert.equal(planKeyOf({ planCode: null, title: " Train Staff ", start: "2026-03-01" }), "row:train staff|2026-03-01");
  assert.equal(budgetKeyOf({ ref: "F2.1", category: "a", amount: "1" }), "ref:F2.1");
  assert.equal(budgetKeyOf({ ref: null, category: " Wells ", amount: "10" }), "row:wells|10");
});

test("requirement codes are unique", async () => {
  const { REQUIREMENT_CODES } = await import("../dist/index.js");
  assert.equal(new Set(REQUIREMENT_CODES).size, REQUIREMENT_CODES.length);
});

test("the project area and boundary level are set, cleared and checked", () => {
  const d = completeDraft();
  const set = applyOperation(d, { kind: "SET_PLACES_SETUP", patch: { projectArea: "  Northern Uganda ", boundaryLevel: 2 } }).draft;
  assert.equal(set.extras.projectArea, "Northern Uganda");
  assert.equal(set.extras.boundaryLevel, 2);
  const cleared = applyOperation(set, { kind: "SET_PLACES_SETUP", patch: { projectArea: "  ", boundaryLevel: null } }).draft;
  assert.equal("projectArea" in cleared.extras, false);
  assert.equal("boundaryLevel" in cleared.extras, false);
  assert.equal(applyOperation(d, { kind: "SET_PLACES_SETUP", patch: { boundaryLevel: 7 } }).ok, false);
  assert.ok(gapInbox(evaluateRequirements(cleared, SETUP_REQUIREMENTS)).some((r) => r.key === "places.area"));
});

test("the documents fill empty Start and reporting answers once, never a person's answer or a rejected reading", async () => {
  const { prefillFromDocuments, sectorFromText, emptyDraft } = await import("../dist/index.js");
  const P = (value, status = "PROPOSED") => ({ value, sourceQuote: "q", sourceRef: null, confidence: "HIGH", status });
  const d = emptyDraft(true);
  d.proposal.facts = { ...d.proposal.facts, donor: P("CBPF"), countries: P(["Somalia"]), sectors: P(["Water, Sanitation and Hygiene"]) };
  d.proposal.periods = [P({ type: "SEMI_ANNUAL", start: null, end: null }), P({ type: "FINAL", start: null, end: null }), P({ type: "MONTHLY", start: null, end: null }, "REJECTED")];
  d.extras.start.country = "Kenya";
  const { draft, filled } = prefillFromDocuments(d);
  assert.equal(draft.extras.start.donor, "CBPF");
  assert.equal(draft.extras.start.country, "Kenya");
  assert.equal(draft.extras.start.sector, "WASH");
  assert.equal(draft.extras.schedule.cadence, "SEMI_ANNUAL");
  assert.deepEqual(draft.extras.schedule.rules.map((r) => r.reportType), ["SEMI_ANNUAL", "FINAL"]);
  assert.deepEqual(filled, ["donor", "sector", "cadence", "reports"]);
  assert.equal(prefillFromDocuments(draft).draft, draft, "only once");
  assert.equal(sectorFromText(["Health", "Education"]), "MULTI_SECTOR");
  assert.equal(sectorFromText(["Something else"]), null);
  const blank = emptyDraft(false);
  assert.equal(prefillFromDocuments(blank).draft, blank, "a draft without documents is untouched");
});
