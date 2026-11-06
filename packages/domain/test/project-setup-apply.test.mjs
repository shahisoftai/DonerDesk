// Phase 36.3, pure: codes for a document that has none, the project draft, and the sheets handed to the existing
// importers — round-tripped through those importers' own parsers so a format drift fails here.
import test from "node:test";
import assert from "node:assert/strict";
import {
  proposeCodes, projectDraftFromProposal, logframeSheet, indicatorSheet, workPlanSheet, placesSheet, riskInputs, fundingInputs,
  normaliseAmountText, budgetNotApplied, parseLogframeText, parseIndicatorText, parseWorkPlanText, parsePlaceSheet,
} from "../dist/index.js";

const A = (value) => ({ value, sourceQuote: "q", sourceRef: null, confidence: "HIGH", status: "ACCEPTED" });
const R = (value) => ({ ...A(value), status: "REJECTED" });
const N = () => ({ value: null, sourceQuote: null, sourceRef: null, confidence: "LOW", status: "PROPOSED" });
const facts = (o = {}) => ({ name: N(), code: N(), donor: N(), countries: N(), sectors: N(), startDate: N(), endDate: N(), currency: N(), summary: N(), ...o });
const node = (level, code = null, parentCode = null, title = `${level} item`) => ({ level, code, title, description: null, parentCode });
const proposal = (o = {}) => ({ facts: facts(), logframe: [], indicators: [], periods: [], plan: [], places: [], funding: [], budget: [], risks: [], ...o });

test("proposeCodes numbers a code-less logframe as a tree and marks every code it made", () => {
  const p = proposeCodes(proposal({ logframe: [A(node("GOAL")), A(node("OUTCOME")), A(node("OUTPUT")), A(node("OUTPUT")), A(node("OUTCOME")), A(node("OUTPUT"))] }));
  assert.deepEqual(p.logframe.map((i) => [i.value.code, i.value.parentCode]), [
    ["G1", null], ["OC1.1", "G1"], ["OP1.1.1", "OC1.1"], ["OP1.1.2", "OC1.1"], ["OC1.2", "G1"], ["OP1.2.1", "OC1.2"],
  ]);
  assert.ok(p.logframe.every((i) => i.value.codeSource === "GENERATED"));
});

test("proposeCodes never changes a document code, never repeats one, and leaves rejected items alone", () => {
  const p = proposeCodes(proposal({
    logframe: [A({ ...node("GOAL", "G1"), codeSource: "DOCUMENT" }), A(node("GOAL")), R(node("OUTPUT"))],
    indicators: [A({ code: null, title: "x", logframeCode: "G1" }), A({ code: "IND1", title: "y", logframeCode: "G1" })],
  }));
  assert.equal(p.logframe[0].value.code, "G1");
  assert.equal(p.logframe[0].value.codeSource, "DOCUMENT");
  assert.notEqual(p.logframe[1].value.code.toLowerCase(), "g1");
  assert.equal(p.logframe[2].value.code, null);
  assert.equal(p.indicators[0].value.code, "IND2");
});

test("the project draft uses accepted facts only and names what the person must still fill", () => {
  const { draft, missing } = projectDraftFromProposal(proposal({
    facts: facts({ name: A("Blue Water"), donor: R("EU"), countries: A(["Uganda", "Kenya"]), startDate: A("2027-03-01"), endDate: A("2029-02-28") }),
    periods: [A({ type: "FINAL", start: null, end: null }), A({ type: "QUARTERLY", start: null, end: null })],
  }));
  assert.deepEqual(draft, { title: "Blue Water", country: "Uganda", startDate: "2027-03-01", endDate: "2029-02-28", reportingFrequency: "QUARTERLY" });
  assert.deepEqual(missing, ["projectCode", "donorName", "implementingOrganization", "sector"]);
});

test("every sheet is read back by its importer's own parser exactly", () => {
  const p = proposal({
    logframe: [A(node("GOAL", "1", null, "Health\twith tab")), A(node("OUTCOME", "1.1", "1"))],
    indicators: [A({ code: "1.1.a", title: "People", logframeCode: "1.1", type: null, unit: null, baseline: "0", target: "75%", frequency: "quarterly", meansOfVerification: null })],
    plan: [A({ title: "Rehab", logframeCode: "1.1", start: "2027-04-01", end: null, location: "Gulu", lead: null })],
    places: [A({ name: "Gulu District", adminLevel: 2, parentName: "Uganda", latitude: null, longitude: null }), A({ name: "Uganda", adminLevel: 0, parentName: null, latitude: null, longitude: null })],
  });
  const lf = parseLogframeText(logframeSheet(p).text);
  assert.deepEqual(lf.rows.map((r) => [r.level, r.code, r.title]), [["GOAL", "1", "Health with tab"], ["OUTCOME", "1.1", "OUTCOME item"]]);
  const ind = parseIndicatorText(indicatorSheet(p).text);
  assert.equal(ind.rows[0].type, "PERCENTAGE", "a % target makes a percentage when the type is not stated");
  assert.equal(ind.rows[0].logframeCode, "1.1");
  const plan = parseWorkPlanText(workPlanSheet(p).text);
  assert.deepEqual(plan.problems, []);
  assert.equal(plan.rows[0].location, "Gulu");
  const places = parsePlaceSheet(placesSheet(p).text);
  assert.deepEqual(places.problems, []);
  assert.deepEqual(places.rows.map((r) => r.name), ["Uganda", "Gulu District"], "larger areas first");
});

test("items an importer could not take honestly are left out with a sentence, never guessed", () => {
  const p = proposal({
    indicators: [A({ code: "X", title: "Unlinked", logframeCode: null })],
    plan: [A({ title: "Someday", logframeCode: null, start: null, end: null, location: null, lead: null })],
    places: [A({ name: "Somewhere", adminLevel: null, parentName: null, latitude: null, longitude: null })],
    risks: [A({ kind: "RISK", title: "Floods", seriousness: null, mitigation: null }), A({ kind: "ISSUE", title: "Strike", seriousness: "High likelihood", mitigation: "talk" })],
    funding: [A({ sourceName: "EU", amount: "1,250", currency: "EUR" }), A({ sourceName: "EU", amount: "1,250,000", currency: null }), A({ sourceName: "UN", amount: "1.250.000,00", currency: "USD" })],
    budget: [A({ category: "Staff", amount: "1", currency: "EUR", logframeCode: null })],
  });
  assert.equal(indicatorSheet(p).rows, 0);
  assert.equal(indicatorSheet(p).notes.length, 1);
  assert.equal(workPlanSheet(p).rows, 0);
  assert.equal(placesSheet(p).rows, 0);
  const risks = riskInputs(p);
  assert.deepEqual(risks.inputs, [{ kind: "PROBLEM", title: "Strike", seriousness: "HIGH", action: "talk" }]);
  assert.equal(risks.notes.length, 1);
  const funding = fundingInputs(p);
  assert.deepEqual(funding.inputs, [{ sourceName: "UN", amount: "1250000.00", currency: "USD" }]);
  assert.equal(funding.notes.length, 2);
  assert.equal(budgetNotApplied(p).length, 1);
});

test("amounts: one reading or none", () => {
  const cases = [["1,250,000", "1250000"], ["1.250.000,00", "1250000.00"], ["1,250.50", "1250.50"], ["12.5", "12.5"], ["400 000", "400000"],
    ["1,250", null], ["1.250", null], ["EUR 5", "5"], ["", null], ["1,25,000", null]];
  for (const [raw, want] of cases) assert.equal(normaliseAmountText(raw), want, raw);
});
