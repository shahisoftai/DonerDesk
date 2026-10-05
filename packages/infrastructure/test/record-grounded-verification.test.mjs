import assert from "node:assert/strict";
import test from "node:test";
import { DeterministicClaimVerifier } from "../dist/llm/claim-verifier.js";
import { DeterministicAssertionExtractor, isDisclosureOrMeta } from "../dist/llm/assertion-extractor.js";
import { buildRecordChunks, recordSentences } from "@donordesk/application";

const sources = {
  project: { title: "Learning Recovery", projectCode: "EDU-1", donorName: "Global Education Partnership Fund", implementingOrganization: "Acme", country: "Kenya", region: "Turkana", district: "Turkana West", sector: "EDUCATION", duration: { start: new Date("2026-03-01T00:00:00Z"), end: new Date("2026-08-31T00:00:00Z") }, budget: { amount: 420000, currency: "USD" }, description: "Children return to school." },
  period: { reportType: "FINAL", duration: { start: new Date("2026-08-01T00:00:00Z"), end: new Date("2026-08-31T00:00:00Z") } },
  activities: [{ id: "a1", activityTitle: "Enrolment drive", activityDate: new Date("2026-03-05T00:00:00Z"), location: "Majengo", participantsTotal: 150, summary: "Mobilisers registered out-of-school children.", achievements: "150 children enrolled.", challenges: "Rainy-season access and supply delays were managed through early ordering and flexible scheduling.", lessonsLearned: "Community ownership drove delivery on time.", nextSteps: "Hand over to the school management committees." }],
  indicatorUpdates: [{ indicatorCode: "IND-1", comments: "Steady uptake at both sites.", dataSource: "School enrolment registers" }],
};
const records = buildRecordChunks(sources);
const verifier = new DeterministicClaimVerifier();
const verify = (text, recs = records, type = "FACTUAL") => verifier.verify({ claim: { text, type, proposedSources: [] }, findings: [], evidencePackages: [], records: recs });

test("record chunks are short statements whose ids can never be an evidence id", () => {
  assert.ok(records.length > 8);
  assert.ok(records.every((r) => r.chunkId.startsWith("record:") && r.text.length <= 420));
  assert.deepEqual(recordSentences("One long thing. Another thing here!"), ["One long thing.", "Another thing here!"]);
});

test("a claim that restates an activity record is supported by it, and says so", async () => {
  const r = await verify("Rainy-season access and supply delays were managed through early ordering and flexible scheduling.");
  assert.equal(r.value.result, "PASSED");
  assert.match(r.value.detail, /project's own records/);
});

test("project details ground the donor attribution and the delivery place", async () => {
  assert.equal((await verify("This project is implemented with the support of Global Education Partnership Fund.")).value.result, "PASSED");
  assert.equal((await verify("Acme implements the project in Turkana West, Kenya.")).value.result, "PASSED");
});

test("a claim no record states still fails, and without records nothing is grounded", async () => {
  assert.equal((await verify("The ministry of education formally endorsed the curriculum reform in 2025.")).value.result, "FAILED");
  assert.equal((await verify("Rainy-season access and supply delays were managed through early ordering and flexible scheduling.", [])).value.result, "FAILED");
});

test("disclosures of missing inputs and document meta are not claims; quantitative or world claims still are", () => {
  for (const t of [
    "The inputs record no expenditure figure and no burn rate for the reporting period.",
    "No variance explanation was recorded in the activity records.",
    "The reporting officer's narrative context contains no budget or variance statement.",
    "Where the evidence record is silent, this report says so rather than inferring compliance.",
    "This section interprets it in brief.",
    "The donor template asks the section to confirm child-safeguarding compliance and donor visibility.",
  ]) assert.equal(isDisclosureOrMeta(t), true, t);
  for (const t of [
    "No safeguarding incident occurred during the project.",
    "The project enrolled 1,260 children, but sex data was not recorded in the records for 12 of them.",
    "Average attendance rose to 86%.",
    "The report confirms that all targets were met.",
  ]) assert.equal(isDisclosureOrMeta(t), false, t);
});

test("the extractor leaves disclosures out of the claim list", async () => {
  const out = await new DeterministicAssertionExtractor().extract({ content: "Enrolment grew steadily. The inputs record no expenditure figure for the period. This section interprets it in brief.", writerClaims: [] });
  assert.equal(out.ok, true);
  assert.deepEqual(out.value.map((a) => a.text), ["Enrolment grew steadily."]);
});

import { recordChunksFromFindings, recordChunksFromFinance, figuresInRecords } from "@donordesk/application";
import { NumericAssertionVerifier, DeterministicEntailmentVerifier } from "../dist/llm/verifier-strategies.js";
import { summarizeFinance, normalizeFinanceFigures } from "@donordesk/domain";

const finding = (over = {}) => ({
  indicatorId: "i1", indicatorCode: "IND-1", indicatorName: "Children enrolled", value: "240", target: "1200", baseline: "0", unit: "children", reportingPeriodId: "p", qualityFlags: [],
  lifeOfProject: { value: "1260", basis: "REPORTED_CUMULATIVE", periodsCovered: 6, asOf: "2026-08-31" },
  disaggregation: [{ dimension: "SEX", category: "Female", value: "655" }, { dimension: "SEX", category: "Male", value: "605" }],
  performanceEvaluation: { type: "POSITIVE", detail: "" }, ...over,
});

test("findings become statements a restating sentence is supported by", async () => {
  const chunks = recordChunksFromFindings([finding()]);
  const text = chunks.map((c) => c.text).join(" ");
  for (const expect of ["1260 children over the life of the project against a target of 1200", "105% of target", "Female 655, Male 605", "on track", "There are 1 verified indicator results", "No data-quality flags were raised"]) {
    assert.ok(text.includes(expect), expect);
  }
  const v = await verifier.verify({ claim: { text: "Enrolment reached 1260 children against a target of 1200, and 655 were female and 605 male.", type: "FACTUAL", proposedSources: [] }, findings: [], evidencePackages: [], records: chunks });
  assert.equal(v.value.result, "PASSED");
});

test("verified finance becomes statements", async () => {
  const finance = summarizeFinance("USD", normalizeFinanceFigures({ lines: [{ budgetLine: "Teacher training", budget: "60000", expenditure: "58200" }] }));
  const chunks = recordChunksFromFinance(finance);
  const v = await verifier.verify({ claim: { text: "The project closed with expenditure of 58200 USD against a budget of 60000 USD, a burn rate of 97 percent.", type: "FACTUAL", proposedSources: [] }, findings: [], evidencePackages: [], records: chunks });
  assert.equal(v.value.result, "PASSED");
});

test("figures in records exclude dates, years and codes", () => {
  const figures = figuresInRecords([
    { chunkId: "record:a:0", label: "", text: "Participants: 10 participants, 6 female, 4 male. Run 2026-03-01 to 31 August 2026 by IND-6 under A1.1 with a budget of 420,000 USD." },
  ]);
  assert.deepEqual(figures.sort(), ["10", "4", "420000", "6"].sort());
});

test("a figure a record states is grounded; one it does not is not", () => {
  const numeric = new NumericAssertionVerifier();
  const atom = (value) => ({ charStart: 0, charEnd: value.length, value, role: "ACHIEVEMENT", bound: false });
  const dec = (t) => ({ value: BigInt(t), scale: 0 });
  assert.equal(numeric.verify({ atoms: [atom("10")], findings: [], recordFigures: [dec("10")] }).result, "PASSED");
  assert.equal(numeric.verify({ atoms: [atom("11")], findings: [], recordFigures: [dec("10")] }).result, "FAILED");
  assert.equal(numeric.verify({ atoms: [atom("10")], findings: [] }).result, "FAILED");
});

test("a percent of target may be written to the whole percent", () => {
  const numeric = new NumericAssertionVerifier();
  const f = { indicatorId: "i", indicatorCode: "IND-6", value: "86", target: "85", baseline: "62", reportingPeriodId: "p", qualityFlags: [] };
  for (const written of ["101", "101.2"]) assert.equal(numeric.verify({ atoms: [{ charStart: 0, charEnd: 3, value: written, role: "PERCENT", isPercent: true, bound: false }], findings: [f] }).result, "PASSED", written);
  assert.equal(numeric.verify({ atoms: [{ charStart: 0, charEnd: 3, value: "103", role: "PERCENT", isPercent: true, bound: false }], findings: [f] }).result, "FAILED");
});

test("a long sentence that synthesises several records is supported only when they cover all of it", async () => {
  const entail = new DeterministicEntailmentVerifier();
  const evidence = [
    { evidenceId: "record:a", chunkId: "record:a", chunkText: "Construction faced a two-day cement delay and a contractor shortage during the rainy season.", score: 1 },
    { evidenceId: "record:b", chunkId: "record:b", chunkText: "Roof sheeting arrived with minor damage and was replaced.", score: 1 },
    { evidenceId: "record:c", chunkId: "record:c", chunkText: "Water for construction was limited at one site and painting was delayed by humidity.", score: 1 },
  ];
  const covered = "Construction faced a two-day cement delay, a contractor shortage during the rainy season, damaged roof sheeting that was replaced, limited water at one site and painting delayed by humidity.";
  assert.equal((await entail.verify({ assertionText: covered, assertionType: "FACTUAL", evidence })).value.verdict, "SUPPORTED");
  const invented = "Construction faced a two-day cement delay, a contractor strike, flooding of the foundations, theft of equipment and a ministry inspection failure.";
  assert.notEqual((await entail.verify({ assertionText: invented, assertionType: "FACTUAL", evidence })).value.verdict, "SUPPORTED");
});

import { recordChunksFromEvidence } from "@donordesk/application";
import { extractNumericAtoms } from "@donordesk/domain";

test("evidence files become statements the evidence log is supported by", async () => {
  const chunks = recordChunksFromEvidence([
    { evidenceId: "e1", title: "Closure certificate", evidenceType: "APPROVAL_DOCUMENT", verificationStatus: "VERIFIED", confidentialityLevel: "INTERNAL" },
    { evidenceId: "e2", title: "Attendance review", evidenceType: "MONITORING_REPORT", verificationStatus: "VERIFIED", confidentialityLevel: "INTERNAL" },
  ]);
  const v = await verifier.verify({ claim: { text: "Two verified evidence files are annexed, all verified and all classified as internal.", type: "FACTUAL", proposedSources: [] }, findings: [], evidencePackages: [], records: chunks });
  assert.equal(v.value.result, "PASSED");
  assert.deepEqual(recordChunksFromEvidence([]), []);
});

test("an identifier cited in prose is not a figure, even when its first group is all digits", () => {
  const text = "Cement delivery was delayed by two days (14141986-6483-4267-8ab7-931cdb9b7e51) and 12 children were registered.";
  assert.deepEqual(extractNumericAtoms(text).map((a) => a.value), ["12"]);
});

test("the reporting officer's story is quoted back as the officer's own statement", async () => {
  const chunks = buildRecordChunks({ ...sources, story: { varianceExplanations: "The small unspent balance reflects negotiated savings on roofing materials and a lower cost for the final inspection." } });
  const v = await verifier.verify({ claim: { text: "The reporting officer recorded the reason for the unspent balance: the small unspent balance reflects negotiated savings on roofing materials and a lower cost for the final inspection.", type: "FACTUAL", proposedSources: [] }, findings: [], evidencePackages: [], records: chunks });
  assert.equal(v.value.result, "PASSED");
});

test("the life-of-project breakdown is stated beside the life-of-project total and verified as a figure", async () => {
  const f = finding({ value: "240", disaggregation: [{ dimension: "SEX", category: "Female", value: "125" }, { dimension: "SEX", category: "Male", value: "115" }], lifeOfProject: { value: "1260", basis: "REPORTED_CUMULATIVE", periodsCovered: 6, asOf: "2026-08-31", disaggregation: [{ dimension: "SEX", category: "Female", value: "655" }, { dimension: "SEX", category: "Male", value: "605" }] } });
  const text = recordChunksFromFindings([f]).map((c) => c.text).join(" ");
  assert.ok(text.includes("breakdown of this period's 240 children: Female 125, Male 115"));
  assert.ok(text.includes("breakdown of the life-of-project 1260 children: Female 655, Male 605"));
  const numeric = new NumericAssertionVerifier();
  const atom = (value) => ({ charStart: 0, charEnd: value.length, value, role: "ACHIEVEMENT", bound: false });
  assert.equal(numeric.verify({ atoms: [atom("1260"), atom("655"), atom("605")], findings: [f] }).result, "PASSED");
});

import { stripCrossReferences } from "../dist/llm/verifier-strategies.js";

test("a recommendation is a proposal: only the figures in it are verified", async () => {
  const finance = summarizeFinance("USD", normalizeFinanceFigures({ lines: [{ budgetLine: "Teacher training", budget: "60000", expenditure: "58200" }] }));
  const recs = recordChunksFromFinance(finance);
  const verifyRec = (text) => verifier.verify({ claim: { text, type: "FACTUAL", assertionType: "RECOMMENDATION", proposedSources: [] }, findings: [], evidencePackages: [], records: recs, finance });
  assert.equal((await verifyRec("The project recommends that the committees continue the monthly drives and order materials before the rainy season.")).value.result, "PASSED");
  assert.equal((await verifyRec("The project recommends repeating the savings approach that left a balance of 1800 USD against expenditure of 58200 USD.")).value.result, "PASSED");
  assert.equal((await verifyRec("The project recommends repeating the savings approach that left a balance of 9999 USD.")).value.result, "FAILED", "a figure it states must still be real");
  // the same words as a factual claim are not a proposal
  assert.equal((await verifier.verify({ claim: { text: "The committees will continue the monthly drives.", type: "FACTUAL", proposedSources: [] }, findings: [], evidencePackages: [], records: recs })).value.result, "FAILED");
});

test("cross-references are not content, so a claim that points at another section is judged on what it states", async () => {
  assert.equal(stripCrossReferences("The project closed all six indicators at target, as set out in Results Against the Logframe, and closed expenditure at 97% (see Financial Summary).").includes("Financial"), false);
  const entail = new DeterministicEntailmentVerifier();
  const evidence = [
    { evidenceId: "record:a", chunkId: "record:a", chunkText: "All 6 indicators were evaluated as POSITIVE: all 6 indicators met or exceeded their targets and are on track.", score: 1 },
    { evidenceId: "record:b", chunkId: "record:b", chunkText: "Budget 420000 USD; expenditure 407400 USD; balance 12600 USD; burn rate 97 percent.", score: 1 },
  ];
  const claim = "The project met or exceeded all 6 indicator targets, as set out in Results Against the Logframe, with a burn rate of 97 percent of budget (see Financial Summary).";
  assert.equal((await entail.verify({ assertionText: claim, assertionType: "FACTUAL", evidence })).value.verdict, "SUPPORTED");
});

test("a recommendation that mentions a budget is still a proposal; a compliance declaration is not", async () => {
  const out = await new DeterministicAssertionExtractor().extract({
    content: "Action: the project recommends continuing the savings approach that left a balance of 12600 USD. The organisation complies with the donor's budget reporting obligation. The programme is expected to continue under county leadership next year.",
    writerClaims: [],
  });
  assert.deepEqual(out.value.map((a) => a.type), ["RECOMMENDATION", "COMPLIANCE_DECLARATION", "FORECAST"]);
});

test("what the verified figures imply is a statement too: all indicators at target, delivered within budget", async () => {
  const f = (code) => finding({ indicatorCode: code, indicatorId: code, disaggregation: undefined, lifeOfProject: undefined });
  const findings = ["IND-1", "IND-2", "IND-3"].map(f);
  const finance = summarizeFinance("USD", normalizeFinanceFigures({ lines: [{ budgetLine: "Training", budget: "100", expenditure: "97" }, { budgetLine: "Kits", budget: "200", expenditure: "194" }] }));
  const chunks = [...recordChunksFromFindings(findings), ...recordChunksFromFinance(finance)];
  const supported = async (text) => (await verifier.verify({ claim: { text, type: "FACTUAL", proposedSources: [] }, findings: [], evidencePackages: [], records: chunks })).value.result;
  assert.equal(await supported("The project closed all three indicators at or above target."), "PASSED");
  assert.equal(await supported("The project was delivered within budget, with every budget line closing at a burn rate of 97 percent."), "PASSED");
  const over = summarizeFinance("USD", normalizeFinanceFigures({ lines: [{ budgetLine: "Training", budget: "100", expenditure: "120" }] }));
  const overChunks = recordChunksFromFinance(over);
  assert.ok(!overChunks.some((c) => /within budget/.test(c.text)), "an overspend is never stated as within budget");
});
