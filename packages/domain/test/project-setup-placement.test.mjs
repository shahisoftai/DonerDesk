// Phase 37, pure: document kinds, the results chain as a tree, linking items to their results, the placement checks and
// what grounding leaves out.
import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyDocument, splitSheets, linkProposal, bestLink, contentWords, wordOverlap, tidyResultsChain, applyStructure, majorityStructure,
  orderAsTree, repeatedStatements, checkProposal, proposeCodes, groundAreaPatch, LEFT_OUT_LIMIT, linkItem,
} from "../dist/index.js";

const A = (value, quote = "q") => ({ value, sourceQuote: quote, sourceRef: null, confidence: "HIGH", status: "ACCEPTED" });
const P = (value) => ({ ...A(value), status: "PROPOSED" });
const E = (value) => ({ ...A(value), status: "EDITED" });
const N = () => ({ value: null, sourceQuote: null, sourceRef: null, confidence: "LOW", status: "PROPOSED" });
const facts = (o = {}) => ({ name: N(), code: N(), donor: N(), countries: N(), sectors: N(), startDate: N(), endDate: N(), currency: N(), summary: N(), ...o });
const node = (level, title, code = null, parentCode = null) => ({ level, code, title, description: null, parentCode });
const activity = (title, o = {}) => ({ title, logframeCode: null, start: null, end: null, location: null, lead: null, ...o });
const indicator = (title, o = {}) => ({ code: null, title, logframeCode: null, type: null, unit: null, baseline: null, target: null, targetSchedule: null, frequency: null, direction: null, disaggregation: null, meansOfVerification: null, ...o });
const proposal = (o = {}) => ({ facts: facts(), logframe: [], indicators: [], periods: [], plan: [], places: [], funding: [], budget: [], risks: [], ...o });

test("classifyDocument tells a Gantt chart, a budget, a logframe matrix, an indicator table and a proposal apart", () => {
  const gantt = ["Activity Code\tActivities\tLOP Target", ...[1, 2, 3, 4].map((n) => `1.${n}\tDo thing ${n}\t\t[scheduled 2023-07-0${n} to 2023-07-1${n} (July Wk - 1)]`)].join("\n");
  assert.equal(classifyDocument(gantt).kind, "WORK_PLAN_GANTT");
  const budget = "SUMMARY BUDGET\t10 Months\tTotal\nPersonnel\t\t19015000\nTravel\t\t8976000\nTotal Direct Costs\t\t56611643.5\nIndirect Costs\t\t5661165";
  assert.equal(classifyDocument(budget).kind, "BUDGET");
  const matrix = "Intervention logic\tIndicators\tSources of verification\tAssumptions\nOverall objective\tMaternal deaths\tHMIS\tStable\nSpecific objective 1\tSkilled births\tSurvey\t";
  assert.equal(classifyDocument(matrix).kind, "LOGFRAME_MATRIX");
  const pitt = "Indicator\tBaseline\tTarget\tFrequency\tData source\nNumber of HCPs trained\t0\t42\tQuarterly\tTraining report";
  assert.equal(classifyDocument(pitt).kind, "INDICATOR_TABLE");
  const prose = Array.from({ length: 5 }, (_, i) => `Paragraph ${i}: the project will introduce a technology-based solution and train health care providers for improved emergency obstetric care services in the district.`).join("\n\n");
  assert.equal(classifyDocument(prose).kind, "PROPOSAL");
  assert.equal(classifyDocument("hello\nworld").kind, "OTHER");
});

test("splitSheets cuts a workbook at its sheet lines and keeps a plain document whole", () => {
  assert.deepEqual(splitSheets("# One\na\tb\n# Two\nc").map((s) => s.title), ["One", "Two"]);
  assert.equal(splitSheets("Plain text\nmore").length, 1);
});

test("word overlap ignores stop words and light inflection", () => {
  assert.equal(wordOverlap(contentWords("Trainings of providers"), contentWords("training the provider")), 1);
  assert.equal(wordOverlap(contentWords("budget"), contentWords("")), 0);
});

test("bestLink links only a clear winner, and leaves a tie or a weak match empty", () => {
  const candidates = [
    { code: "OP1", level: "OUTPUT", words: contentWords("Health care providers trained on emergency obstetric care") },
    { code: "OP2", level: "OUTPUT", words: contentWords("Referral mechanism established with rescue services") },
  ];
  assert.equal(bestLink("Train providers on emergency obstetric care", null, candidates, ["OUTPUT"])?.code, "OP1");
  assert.equal(bestLink("Procure tablets", null, candidates, ["OUTPUT"]), null);
  const tie = [{ code: "A", level: "OUTPUT", words: contentWords("community sessions") }, { code: "B", level: "OUTPUT", words: contentWords("community sessions") }];
  assert.equal(bestLink("community sessions", null, tie, ["OUTPUT"]), null);
  // The heading a row sits under counts too, at a lower weight.
  assert.equal(bestLink("ToT for 16 participants", "Task- 14 Establishing referral mechanism with rescue", candidates, ["OUTPUT"])?.code, "OP2");
});

test("linkProposal fills only empty links, marks them SUGGESTED and never touches an edited item", () => {
  const p = linkProposal(proposal({
    logframe: [A(node("GOAL", "Reduce maternal deaths", "G1")), A(node("OUTPUT", "Health care providers trained on emergency obstetric care", "OP1", "G1"))],
    plan: [A(activity("Train providers on emergency obstetric care")), A(activity("Train providers on obstetric care", { logframeCode: "G1" })), E(activity("Train providers on emergency obstetric care"))],
    indicators: [A(indicator("Number of providers trained on emergency obstetric care"))],
  }));
  assert.deepEqual(p.plan.map((i) => [i.value.logframeCode, i.value.linkSource]), [["OP1", "SUGGESTED"], ["G1", undefined], [null, undefined]]);
  assert.deepEqual([p.indicators[0].value.logframeCode, p.indicators[0].value.linkSource], ["OP1", "SUGGESTED"]);
});

test("linkProposal links to codes proposeCodes generated, so a code-less chain still places its activities", () => {
  const p = linkProposal(proposeCodes(proposal({
    logframe: [A(node("GOAL", "Reduce maternal deaths")), A(node("OUTCOME", "Better emergency care")), A(node("OUTPUT", "Remote online clinics established"))],
    plan: [A(activity("Establish remote online clinics"))],
  })));
  assert.equal(p.plan[0].value.logframeCode, p.logframe[2].value.code);
});

test("repeatedStatements keeps the first of two statements in the same words", () => {
  const items = [P(node("GOAL", "Reduce maternal mortality and morbidity")), P(node("GOAL", "Reducing maternal mortality and morbidity")), P(node("OUTCOME", "Improve referral"))];
  assert.deepEqual([...repeatedStatements(items)], [1]);
});

test("orderAsTree puts each parent before its children and ignores a parent that is not higher", () => {
  const items = [P(node("OUTPUT", "o1")), P(node("GOAL", "g")), P(node("OUTCOME", "oc"))];
  const { items: ordered, parents } = orderAsTree(items, (i) => [2, null, 1][i]);
  assert.deepEqual(ordered.map((i) => i.value.title), ["g", "oc", "o1"]);
  assert.deepEqual(parents, [null, 0, 1]);
  const flat = orderAsTree([P(node("OUTCOME", "a")), P(node("OUTCOME", "b"))], (i) => (i === 1 ? 0 : null));
  assert.deepEqual(flat.parents, [null, null]);
});

test("tidyResultsChain removes repeats, clears unknown parents and orders by the codes", () => {
  const out = tidyResultsChain([
    P(node("OUTPUT", "Clinics established", "1.1", "1")), P(node("OUTCOME", "Better care", "1", "G")), P(node("GOAL", "Fewer deaths", "G")),
    P(node("OUTPUT", "Clinic established", "1.1b", "1")), P(node("OUTPUT", "Tablets bought", "1.2", "X")),
  ]);
  assert.deepEqual(out.map((i) => [i.value.code, i.value.parentCode]), [["G", null], ["1", "G"], ["1.1", "1"], ["1.2", null]]);
});

test("applyStructure sets levels and parent codes from the decisions; majorityStructure takes the most common answer", () => {
  const items = [P(node("OUTCOME", "Fewer deaths", "G")), P(node("OUTPUT", "Better care")), P(node("OUTPUT", "Clinics", "C1"))];
  const votes = [
    [{ level: "GOAL", parent: null }, { level: "OUTCOME", parent: 0 }, { level: "OUTPUT", parent: 1 }],
    [{ level: "GOAL", parent: null }, { level: "OUTCOME", parent: 0 }, { level: "OUTPUT", parent: 0 }],
    [{ level: "GOAL", parent: null }, { level: "OUTCOME", parent: 0 }, { level: "OUTPUT", parent: 1 }],
  ];
  const decided = majorityStructure(votes, 3);
  assert.deepEqual(decided.map((d) => d.agreed), [true, true, false]);
  const out = applyStructure(items, decided);
  assert.deepEqual(out.map((i) => [i.value.level, i.value.title, i.value.parentCode]), [["GOAL", "Fewer deaths", null], ["OUTCOME", "Better care", "G"], ["OUTPUT", "Clinics", null]]);
  // An edited item keeps the person's level.
  assert.equal(applyStructure([E(node("OUTPUT", "x"))], [{ level: "GOAL", parent: null }])[0].value.level, "OUTPUT");
});

test("placement checks advise on two goals, a missing level, unplaced items and dates the work plan states", () => {
  const codes = (p) => checkProposal(p).filter((x) => x.severity === "SOFT").map((x) => x.code);
  assert.deepEqual(codes(proposal({ logframe: [A(node("GOAL", "a", "G1")), A(node("GOAL", "b", "G2")), A(node("OUTPUT", "c", "O1"))] })), ["LOGFRAME_SEVERAL_GOALS", "LOGFRAME_LEVEL_MISSING"]);
  const p = proposal({
    logframe: [A(node("GOAL", "g", "G1"))],
    indicators: [A(indicator("i"))],
    plan: [A(activity("a", { start: "2023-07-22", end: "2023-08-14" })), A(activity("b", { start: "2024-01-01", end: "2024-04-30" }))],
  });
  const problems = checkProposal(p);
  assert.ok(problems.some((x) => x.code === "INDICATORS_NOT_PLACED" && x.params.count === 1));
  assert.ok(problems.some((x) => x.code === "ACTIVITIES_NOT_PLACED" && x.params.count === 2));
  const dates = problems.find((x) => x.code === "FACTS_DATES_FROM_PLAN");
  assert.deepEqual([dates.params.start, dates.params.end], ["2023-07-22", "2024-04-30"]);
  assert.ok(problems.filter((x) => x.code !== "FACTS_NAME_REQUIRED").every((x) => x.severity === "SOFT"));
});

test("groundAreaPatch lists what it left out and why, up to the limit", () => {
  const text = "Train 16 providers in Peshawar.";
  const out = groundAreaPatch("PLAN", { plan: [{ ...P(activity("Train 16 providers")), sourceQuote: "Train 16 providers" }, { ...P(activity("Train 20 providers")), sourceQuote: "Train 16 providers" }, { ...P(activity("Ghost")), sourceQuote: "not there" }] }, text);
  assert.equal(out.fields.plan.length, 1);
  assert.deepEqual(out.leftOut.map((l) => [l.field, l.reason]), [["plan", "FIGURE_NOT_IN_QUOTE"], ["plan", "QUOTE_NOT_FOUND"]]);
  const many = groundAreaPatch("PLAN", { plan: Array.from({ length: LEFT_OUT_LIMIT + 5 }, () => ({ ...P(activity("x")), sourceQuote: "nope" })) }, text);
  assert.equal(many.dropped, LEFT_OUT_LIMIT + 5);
  assert.equal(many.leftOut.length, LEFT_OUT_LIMIT);
});

test("linkItem places an item under a live result as the person's choice, which later suggestions keep", () => {
  const base = proposal({ logframe: [A(node("OUTPUT", "Clinics established", "OP1")), { ...A(node("OUTPUT", "Gone", "OP9")), status: "REJECTED" }], plan: [P(activity("Hold a launch workshop"))] });
  const done = linkItem(base, { area: "PLAN", path: "plan.0" }, "OP1");
  assert.equal(done.ok, true);
  assert.deepEqual([done.proposal.plan[0].value.logframeCode, done.proposal.plan[0].value.linkSource, done.proposal.plan[0].status], ["OP1", "PERSON", "PROPOSED"]);
  const cleared = linkItem(done.proposal, { area: "PLAN", path: "plan.0" }, null);
  assert.equal(linkProposal(cleared.proposal).plan[0].value.logframeCode, null);
  assert.equal(linkItem(base, { area: "PLAN", path: "plan.0" }, "OP9").ok, false);
  assert.equal(linkItem(base, { area: "LOGFRAME", path: "logframe.0" }, "OP1").ok, false);
});

test("a suggested link to a result that no longer exists is withdrawn, and proposeCodes LIVE codes every live result", () => {
  const p = proposal({ logframe: [P(node("GOAL", "Fewer deaths")), P(node("OUTPUT", "Clinics established"))], plan: [P(activity("Hold a launch workshop", { logframeCode: "OLD", linkSource: "SUGGESTED" }))] });
  assert.equal(proposeCodes(p).logframe[0].value.code, null);
  const live = proposeCodes(p, "LIVE");
  assert.deepEqual(live.logframe.map((n) => n.value.code), ["G1", "OP1.1"]);
  const out = linkProposal(live);
  assert.equal(out.plan[0].value.logframeCode, null);
  assert.equal(out.plan[0].value.linkSource, undefined);
});

// Phase 37 second pass: budget totals, countries, second readings, and the review's structural edits.
import { checkBudgetTotals, leafRows, recogniseCountry, countriesInText, withAlternative, offerPlanDates, chooseAlternative, moveResult, addIndicator, checkFactReadings } from "../dist/index.js";

const line = (category, amount, o = {}) => A({ category, amount, currency: "PKR", logframeCode: null, ...o });

test("checkBudgetTotals sets categories and the most detailed rows against the stated grand total", () => {
  const budget = [
    line("Personnel", "100"), line("Travel", "50.5"), line("TOTAL PROJECT COSTS", "150.5", { kind: "TOTAL" }),
    line("Staff", "100", { kind: "DETAIL", ref: "A" }), line("Director", "60", { kind: "DETAIL", ref: "A.1" }), line("Officer", "40", { kind: "DETAIL", ref: "A.2" }),
    line("Flights", "50.5", { kind: "DETAIL", ref: "C 1" }), line("TOTAL ESTIMATED COST", "150.5", { kind: "TOTAL" }),
  ];
  assert.deepEqual(checkBudgetTotals(proposal({ budget })), []);
  assert.deepEqual(leafRows(budget.map((b) => b.value).filter((v) => v.kind === "DETAIL")).map((r) => r.ref), ["A.1", "A.2", "C 1"]);
  const wrong = checkBudgetTotals(proposal({ budget: budget.map((b, i) => (i === 4 ? line("Director", "70", { kind: "DETAIL", ref: "A.1" }) : b)) }));
  assert.deepEqual(wrong.map((p) => [p.params.what, p.params.stated, p.params.counted]), [["DETAILS", "150.5", "160.5"], ["DETAILS", "150.5", "160.5"]]);
  assert.deepEqual(checkBudgetTotals(proposal({ budget: [line("A", "1"), line("B", "1", { currency: "USD" }), line("Total project costs", "9", { kind: "TOTAL" })] })), [], "two currencies are never added");
});

test("countries are recognised by any common spelling, found in text by whole words, and a province is not one", () => {
  assert.equal(recogniseCountry("RDC"), "Democratic Republic of the Congo");
  assert.equal(recogniseCountry("Khyber Pakhtunkhwa"), null);
  assert.deepEqual(countriesInText("Field offices in South Sudan; budget in Pakistani Rupee; staff in Pakistan"), ["South Sudan", "Pakistan"]);
  assert.deepEqual(countriesInText("Chad and Georgia are people here"), []);
  const problems = checkFactReadings(proposal({ facts: facts({ countries: A(["Pakistan", "Upper Dir"]) }) }));
  assert.deepEqual(problems.map((p) => [p.code, p.params.name]), [["COUNTRY_NOT_RECOGNISED", "Upper Dir"]]);
});

test("withAlternative keeps a different second reading beside the first, fills an empty one, and ignores a repeat", () => {
  const first = A("2023-07-01", "starts 2023-07-01");
  const other = { ...A("2023-07-22", "from 2023-07-22"), status: "PROPOSED" };
  assert.deepEqual(withAlternative(first, other).alternatives.map((a) => a.value), ["2023-07-22"]);
  assert.equal(withAlternative(first, A("2023-07-01", "again")).alternatives, undefined);
  assert.equal(withAlternative(N(), other).value, "2023-07-22");
});

test("offerPlanDates offers the work plan's span for the project's dates, without filling them", () => {
  const p = offerPlanDates(proposal({
    facts: facts({ endDate: A("2024-03-31", "ends 2024-03-31") }),
    plan: [A(activity("a", { start: "2023-07-22", end: "2023-08-14" }), "row a 2023-07-22 2023-08-14"), A(activity("b", { start: "2024-01-01", end: "2024-04-30" }), "row b 2024-04-30")],
  }));
  assert.equal(p.facts.startDate.value, null);
  assert.deepEqual(p.facts.startDate.alternatives.map((a) => [a.value, a.sourceQuote]), [["2023-07-22", "row a 2023-07-22 2023-08-14"]]);
  assert.equal(p.facts.endDate.value, "2024-03-31");
  assert.deepEqual(p.facts.endDate.alternatives.map((a) => a.value), ["2024-04-30"]);
  const chosen = chooseAlternative(p, { area: "FACTS", path: "facts.endDate" }, 0);
  assert.equal(chosen.ok, true);
  assert.deepEqual([chosen.proposal.facts.endDate.value, chosen.proposal.facts.endDate.status, chosen.proposal.facts.endDate.alternatives.map((a) => a.value)], ["2024-04-30", "ACCEPTED", ["2024-03-31"]]);
  assert.equal(chooseAlternative(p, { area: "FACTS", path: "facts.endDate" }, 5).ok, false);
});

test("grounding drops a second reading that is not in the documents and keeps one that is", () => {
  const item = { ...P("2023-07-01"), sourceQuote: "starts 2023-07-01", alternatives: [{ value: "2023-07-22", sourceQuote: "from 2023-07-22", sourceRef: null }, { value: "2030-01-01", sourceQuote: "invented 2030-01-01", sourceRef: null }] };
  const out = groundAreaPatch("FACTS", { facts: facts({ startDate: item }) }, "The work starts 2023-07-01 and runs from 2023-07-22.");
  assert.deepEqual(out.fields.facts.startDate.alternatives.map((a) => a.value), ["2023-07-22"]);
});

test("moveResult changes level and parent, refuses a circle or a wrong level, and keeps tree order", () => {
  const p = proposal({ logframe: [P(node("GOAL", "g", "G")), P(node("OUTCOME", "o1", "O1", "G")), P(node("OUTPUT", "p1", "P1", "O1")), P(node("OUTCOME", "o2", "O2", "G"))] });
  const moved = moveResult(p, { area: "LOGFRAME", path: "logframe.2" }, { level: "OUTPUT", parentCode: "O2" });
  assert.equal(moved.ok, true);
  assert.deepEqual(moved.proposal.logframe.map((n) => n.value.code), ["G", "O1", "O2", "P1"]);
  assert.equal(moveResult(p, { area: "LOGFRAME", path: "logframe.1" }, { level: "OUTCOME", parentCode: "P1" }).ok, false, "not under a lower level");
  assert.equal(moveResult(p, { area: "LOGFRAME", path: "logframe.1" }, { level: "OUTCOME", parentCode: null }).ok, false, "only a goal is at the top");
  const deep = proposal({ logframe: [P(node("GOAL", "g", "G")), P(node("OUTCOME", "o", "O", "G")), P(node("ACTIVITY", "a", "A", "O"))] });
  assert.equal(moveResult(deep, { area: "LOGFRAME", path: "logframe.1" }, { level: "OUTPUT", parentCode: "A" }).ok, false);
});

test("addIndicator adds a person's own indicator under a live result, and refuses a used code or an unknown result", () => {
  const p = proposal({ logframe: [P(node("OUTPUT", "Clinics", "OP1"))] });
  const added = addIndicator(p, { title: "Number of clinics running", logframeCode: "OP1", baseline: "0", target: "3", type: "NUMBER" });
  assert.equal(added.ok, true);
  const item = added.proposal.indicators[0];
  assert.deepEqual([item.status, item.sourceQuote, item.value.logframeCode, item.value.linkSource, item.value.target], ["EDITED", null, "OP1", "PERSON", "3"]);
  assert.equal(addIndicator(p, { title: "x", code: "OP1" }).ok, false);
  assert.equal(addIndicator(p, { title: "x", logframeCode: "NOPE" }).ok, false);
  assert.equal(addIndicator(p, { title: "  " }).ok, false);
});

import { offerPlaceCountries } from "../dist/index.js";

test("offerPlaceCountries offers the country the places name when the facts read another one, never swapping it in", () => {
  const p = offerPlaceCountries(proposal({
    facts: facts({ countries: A(["United States"], "United States Agency for International Development") }),
    places: [A({ name: "Upper Dir", adminLevel: 2, parentName: "Pakistan", latitude: null, longitude: null }, "District Upper Dir, Khyber Pakhtunkhwa, Pakistan")],
  }));
  assert.deepEqual(p.facts.countries.value, ["United States"]);
  assert.deepEqual(p.facts.countries.alternatives.map((a) => a.value), [["Pakistan"]]);
  const same = proposal({ facts: facts({ countries: A(["Pakistan"], "Pakistan") }), places: [A({ name: "Pakistan", adminLevel: 0, parentName: null, latitude: null, longitude: null }, "in Pakistan")] });
  assert.equal(offerPlaceCountries(same), same);
});

test("a generated indicator code skips the codes the document already uses (IND2, not IND1-2)", async () => {
  const { proposeCodes } = await import("../dist/index.js");
  const ind = (code) => ({ value: { code, codeSource: code ? "DOCUMENT" : null, title: "x", logframeCode: null, type: null, unit: null, baseline: null, target: null, targetSchedule: null, frequency: null, direction: null, disaggregation: null, meansOfVerification: null }, sourceQuote: null, sourceRef: null, confidence: "HIGH", status: "EDITED" });
  const out = proposeCodes({ logframe: [], indicators: [ind("IND1"), ind(null)], plan: [], places: [], periods: [], funding: [], budget: [], risks: [], facts: {} });
  assert.equal(out.indicators[1].value.code, "IND2");
});
