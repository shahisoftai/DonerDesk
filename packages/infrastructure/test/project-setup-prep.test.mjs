import test from "node:test";
import assert from "node:assert/strict";
import { compactSheetText, dropNearDuplicates, overlapRatio } from "../dist/project-setup/document-prep.js";
import { readBudgetSheet } from "../dist/project-setup/budget-sheet-reader.js";
import { selectBlocks, runAreaExtraction, chunkBlocksText } from "../dist/project-setup/extractor-shared.js";
import { toBlocks } from "../dist/project-setup/source-reader.js";

const blocksOf = (text, documentId = "source-1", start = 0) => toBlocks(text).map((b, i) => ({ ...b, documentId, index: start + i }));

test("compactSheetText drops trailing empty cells and rounds float noise", () => {
  const out = compactSheetText("a\tb\t\t\t\n1.1000000000000001\tx\t\t");
  assert.equal(out, "a\tb\n1.1\tx");
});

test("compactSheetText turns Gantt marks into the weeks they cover", () => {
  const sheet = [
    "Code\tActivity\tTarget\tJuly\tAugust\t\t\t",
    "\t\t\tWk -4\tWk - 1\tWk - 2\tWk - 3\tWk - 4\tWk - 5",
    "1.1\tKick-off\t1 meeting\tx\t\t\t\t\t",
    "1.2\tHire staff\tOrganogram\tx\tx\tx\t\t\t",
    "1.3\tNo marks\t\t\t\t\t\t\t",
  ].join("\n");
  const out = compactSheetText(sheet).split("\n");
  // No year on the month labels: the weeks are kept as the sheet's words, never turned into dates.
  assert.ok(out.some((l) => l === "1.1\tKick-off\t1 meeting\t[scheduled July Wk -4]"));
  assert.ok(out.some((l) => l.startsWith("1.2\tHire staff\tOrganogram\t[scheduled July Wk -4 to August Wk - 2]")));
  assert.ok(out.includes("1.3\tNo marks"));
});

test("dropNearDuplicates leaves out the shorter of two near-identical files and names it", () => {
  const body = Array.from({ length: 30 }, (_, i) => `This is a sufficiently long line number ${i} of the grant description.`).join("\n");
  const docs = [{ name: "a.docx", text: body }, { name: "b.docx", text: `${body}\nOne extra revised line that is also long enough.` }, { name: "c.xlsx", text: "completely different text that is long enough to count here" }];
  const { kept, dropped } = dropNearDuplicates(docs);
  assert.deepEqual(dropped, ["a.docx"]);
  assert.deepEqual(kept.map((d) => d.name), ["b.docx", "c.xlsx"]);
  assert.ok(overlapRatio(body, "nothing alike at all, not even close to the other text") < 0.1);
});

const SUMMARY = [
  "# Summary Budget", "\tPeriod of Performance:  \t10 Months", "\tBudgets developed in Pakistani Rupee (PKRs.)",
  "\tPersonnel\t\t100\t100", "\t     Local Staff\t\t100\t100", "\tSupplies\t\t0\t0", "\t Operation Costs\t\t50.5\t50.5",
  "\tTotal Direct Costs\t\t150.5\t150.5", "\tTOTAL PROJECT COSTS\t\t150.5\t150.5", "# Other sheet", "\tx\t1",
].join("\n");

test("budget sheet reader: top-level lines only, sub-totals and zero lines left out, the grand total kept as a TOTAL, currency from the sheet", () => {
  const read = readBudgetSheet(blocksOf(SUMMARY));
  assert.ok(read);
  const lines = read.fields.budget.map((b) => [b.value.kind, b.value.category, b.value.amount, b.value.currency]);
  assert.deepEqual(lines, [["LINE", "Personnel", "100", "PKR"], ["LINE", "Operation Costs", "50.5", "PKR"], ["TOTAL", "TOTAL PROJECT COSTS", "150.5", "PKR"]]);
  assert.match(read.fields.budget[0].sourceQuote, /^Personnel 100 100$/);
  assert.deepEqual(read.documentIds, ["source-1"]);
});

test("budget sheet reader: a currency the sheet does not name stays Not stated, and a document without the sheet is not read", () => {
  const read = readBudgetSheet(blocksOf(SUMMARY.replace("Pakistani Rupee (PKRs.)", "local money")));
  assert.equal(read.fields.budget[0].value.currency, null);
  assert.equal(readBudgetSheet(blocksOf("# Detailed Budget\n\tA\t1")), null);
});

test("selection ranks blocks by how many of the area's words they use and keeps reading order", () => {
  const blocks = [
    { documentId: "d", index: 0, text: "cover page" },
    { documentId: "d", index: 1, text: "weather and background of the region" },
    { documentId: "d", index: 2, text: "budget total cost" },
    { documentId: "d", index: 3, text: "budget funding grant contribution" },
    { documentId: "d", index: 4, text: "budget" },
    { documentId: "d", index: 5, text: "filler ".repeat(200) },
  ];
  const small = selectBlocks(blocks, ["budget", "total", "cost", "funding", "grant"], 120);
  assert.match(small.text, /\[2\]/);
  assert.match(small.text, /\[3\]/);
  assert.doesNotMatch(small.text, /\[1\]/);
  assert.ok(small.text.indexOf("[2]") < small.text.indexOf("[3]"));
  const withHead = selectBlocks(blocks, ["budget", "total", "cost", "funding", "grant"], 400, 1);
  assert.match(withHead.text, /\[0\] cover page/);
});

const llmReplying = (replies) => {
  let n = 0; const calls = [];
  return { calls, llm: { completeJson: async (input) => { calls.push(input); const r = replies[Math.min(n++, replies.length - 1)]; return r instanceof Error ? { ok: false, error: r } : { ok: true, value: { text: r, model: "m", promptVersion: "p", usage: { inputTokens: 10, outputTokens: 5 } } }; } } };
};
const base = (llm, blocks) => ({ llm, tenantId: "t", proposalId: "p", blocks, sourceText: "", prior: {}, maxTokens: 100, timeoutMs: 1000, keywords: ["word"], buildPrompt: (t) => ({ system: "s", user: t }), parseChunk: (raw) => raw, merge: (a, b) => ({ ...a, ...b }) });

test("an unreadable reply is retried once, then read", async () => {
  const { llm, calls } = llmReplying(["not json at all", '{"ok": 1}']);
  const run = await runAreaExtraction(base(llm, blocksOf("a word here")));
  assert.equal(run.ok, true);
  assert.equal(calls.length, 2);
  assert.deepEqual(run.value.fields, { ok: 1 });
});

test("chunks are asked at the same time and merged in reading order", async () => {
  const big = Array.from({ length: 40 }, (_, i) => `word ${i} ${"x".repeat(900)}`).join("\n");
  const blocks = blocksOf(big);
  assert.ok(chunkBlocksText(blocks.map((b) => `[${b.index}] ${b.text}`).join("\n")).chunks.length >= 2);
  let live = 0; let peak = 0;
  const llm = { completeJson: async ({ user }) => { live++; peak = Math.max(peak, live); await new Promise((r) => setTimeout(r, 20)); live--; const first = /\[(\d+)\]/.exec(user)[1]; return { ok: true, value: { text: JSON.stringify({ [`c${first}`]: 1 }), model: "m", promptVersion: "p", usage: { inputTokens: 1, outputTokens: 1 } } }; } };
  const run = await runAreaExtraction({ ...base(llm, blocks), budgetChars: 100_000 });
  assert.equal(run.ok, true);
  assert.ok(peak >= 2, `expected overlapping calls, peak was ${peak}`);
  const keys = Object.keys(run.value.fields);
  assert.deepEqual(keys, [...keys].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))));
});

test("compactSheetText gives a Gantt row real dates when the month labels carry a year", () => {
  const sheet = [
    "Code\tActivity\tTarget\tJuly\tAugust, 2023\t\t\t\tSeptember, 2023\t\t\t\t\tDecember, 2023\tJanuary, 2024",
    "\t\t\tWk -4\tWk - 1\tWk - 2\tWk - 3\tWk - 4\tWk - 1\tWk - 2\tWk - 3\tWk - 4\tWk - 5\tWk - 4\tWk - 5",
    "1.1\tKick-off\t1 meeting\tx",
    "1.2\tHire staff\t\tx\tx",
    "1.3\tClose-out\t\t\t\t\t\t\t\t\t\t\t\t\tx",
  ].join("\n");
  const out = compactSheetText(sheet).split("\n");
  // July is before the first labelled month (August 2023): it is July 2023. Week 4 of July is days 22-28.
  assert.ok(out.includes("1.1\tKick-off\t1 meeting\t[scheduled 2023-07-22 to 2023-07-28 (July Wk -4)]"), out.join("|"));
  assert.ok(out.some((l) => l.startsWith("1.2\tHire staff\t\t[scheduled 2023-07-22 to 2023-08-07 (July Wk -4 to August, 2023 Wk - 1)]")), out.join("|"));
  // The last week of a month runs to its end; a month after December is the next year.
  assert.ok(out.some((l) => l.includes("[scheduled 2024-01-29 to 2024-01-31 (January, 2024 Wk - 5)]")), out.join("|"));
});

import { workPlanSheetReader } from "../dist/project-setup/sheet-readers.js";

test("a Gantt chart is read as a work plan: code, title and the dates its weeks give, no model", () => {
  const gantt = [
    "# Sheet1", "Activity Code\tActivities\tLOP Target\tJuly\tAugust, 2023",
    "Task- 1\tProject Start-Up and Kick-off Meeting",
    "1.1\tAttend the kick-off meeting\t1 meeting\tx",
    "1.2\tPrepare the work plan\tApproved WP\tx\tx",
    "1.3\tSubmit the NOC application\t\tx",
  ].join("\n");
  const compact = compactSheetText(gantt.replace("Wk", "Wk")); // no week row: not a Gantt, so nothing is read
  assert.equal(workPlanSheetReader(blocksOf(compact)), null);
  const withWeeks = [
    "Code\tActivity\tTarget\tJuly\tAugust, 2023\t\t\t\t\tSeptember, 2023", "\t\t\tWk -4\tWk - 1\tWk - 2\tWk - 3\tWk - 4\tWk - 5\tWk - 1\tWk - 2",
    "1.1\tAttend the kick-off meeting\t1 meeting\tx", "1.2\tPrepare the work plan\t\tx\tx", "1.3\tSubmit the NOC application\t\tx",
  ].join("\n");
  const read = workPlanSheetReader(blocksOf(compactSheetText(withWeeks)));
  assert.ok(read);
  assert.deepEqual(read.plan.map((i) => [i.value.title, i.value.start, i.value.end, i.value.logframeCode]), [
    ["Attend the kick-off meeting", "2023-07-22", "2023-07-28", null],
    ["Prepare the work plan", "2023-07-22", "2023-08-07", null],
    ["Submit the NOC application", "2023-07-22", "2023-07-28", null],
  ]);
  assert.match(read.plan[0].sourceQuote, /^1\.1 Attend the kick-off meeting.*\[scheduled 2023-07-22 to 2023-07-28/);
});

test("a block an area must not read is left out of its selection", () => {
  const blocks = [
    { documentId: "d", index: 0, text: "goal: reduce mortality objective outcome result" },
    { documentId: "d", index: 1, text: "Task- 1\\tgoal objective\\t[scheduled 2023-07-22 to 2023-07-28 (July Wk -4)]" },
    { documentId: "d", index: 2, text: "output result objective" },
    { documentId: "d", index: 3, text: "outcome goal objective" },
  ];
  const keywords = ["goal", "objective", "outcome", "output", "result"];
  assert.match(selectBlocks(blocks, keywords, 10_000).text, /\[1\]/);
  const skipped = selectBlocks(blocks, keywords, 10_000, 0, (b) => /\[scheduled \d{4}-/.test(b.text)).text;
  assert.doesNotMatch(skipped, /\[1\]/);
  assert.match(skipped, /\[0\]/);
});

// Phase 37: document kinds per block, the Gantt read by its own headers, recall and the structure vote.
import { blocksInScope } from "../dist/project-setup/document-scope.js";
import { recallBlocks, quotedBlocks, runRefinement } from "../dist/project-setup/area-passes.js";
import { LOGFRAME_STRUCTURE } from "../dist/project-setup/prompts/logframe.js";
import { TenantId } from "@donordesk/domain";

const GANTT_WEEKS = "\t\t\tWk -4\tWk - 1\tWk - 2\tWk - 3\tWk - 4\tWk - 5\tWk - 1\tWk - 2";

test("toBlocks keeps a leading tab, so a row whose first cell is empty keeps its columns", () => {
  const blocks = toBlocks("\tTitle only\tDeliverable\nnext");
  assert.equal(blocks[0].text.split("\n")[0], "\tTitle only\tDeliverable");
});

test("the Gantt reader takes the title from the Activities column, keeps task headings as groups and lists unscheduled rows", () => {
  const sheet = [
    "Activity Code\t Activities\tLOP Target\tJuly\tAugust, 2023\t\t\t\t\tSeptember, 2023", GANTT_WEEKS,
    "Task- 2\tProject staff hiring and office set-up",
    "2.4\tHiring of project staff in Dir Upper\tProject Organogram\tx\tx\tx",
    "2.5\tOrientation of staff\t\t\tx",
    "2.6\tFinalise the staff handbook",
    "Task- 3\tStakeholder workshop",
    "3.1\tHold the launch workshop\tWorkshop report\t\t\tx",
    "Notes about the chart",
  ].join("\n");
  const read = workPlanSheetReader(blocksOf(compactSheetText(sheet)));
  assert.deepEqual(read.plan.map((i) => [i.value.planCode, i.value.title, i.value.start, i.value.group]), [
    ["2.4", "Hiring of project staff in Dir Upper", "2023-07-22", "Task- 2 Project staff hiring and office set-up"],
    ["2.5", "Orientation of staff", "2023-08-01", "Task- 2 Project staff hiring and office set-up"],
    ["2.6", "Finalise the staff handbook", null, "Task- 2 Project staff hiring and office set-up"],
    ["3.1", "Hold the launch workshop", "2023-08-08", "Task- 3 Stakeholder workshop"],
  ]);
});

test("blocksInScope reads only the kinds an area owns, always reads OTHER, and never leaves an area with nothing", () => {
  const blocks = [{ documentId: "a", index: 0, text: "x", docKind: "BUDGET" }, { documentId: "b", index: 1, text: "y", docKind: "PROPOSAL" }, { documentId: "c", index: 2, text: "z", docKind: "OTHER" }, { documentId: "d", index: 3, text: "w" }];
  assert.deepEqual(blocksInScope(blocks, ["PROPOSAL"]).map((b) => b.index), [1, 2, 3]);
  assert.deepEqual(blocksInScope(blocks, undefined).map((b) => b.index), [0, 1, 2, 3]);
  assert.deepEqual(blocksInScope(blocks.slice(0, 1), ["PROPOSAL"]).map((b) => b.index), [0]);
});

test("recallBlocks offers the relevant blocks nothing was quoted from, and nothing when too little is left", () => {
  const long = "goal outcome ".repeat(200);
  const blocks = [{ documentId: "d", index: 0, text: long }, { documentId: "d", index: 1, text: long }, { documentId: "d", index: 2, text: "nothing relevant ".repeat(200) }];
  const fields = { logframe: [{ value: {}, sourceRef: { documentId: "d", block: 0 } }] };
  assert.deepEqual([...quotedBlocks(fields)], [0]);
  assert.deepEqual(recallBlocks(blocks, fields, ["goal", "outcome"]).map((b) => b.index), [1]);
  assert.deepEqual(recallBlocks([{ documentId: "d", index: 5, text: "goal outcome" }], {}, ["goal", "outcome"]), []);
});

test("the structure pass asks several times at once, takes the majority and keeps the first read when no answer is readable", async () => {
  const P = (level, title, code = null) => ({ value: { level, code, title, description: null, parentCode: null }, sourceQuote: title, sourceRef: null, confidence: "HIGH", status: "PROPOSED" });
  const fields = { logframe: [P("OUTCOME", "Fewer maternal deaths", "G"), P("OUTPUT", "Better emergency care"), P("ACTIVITY", "Train providers")] };
  const good = { items: [{ i: 0, level: "GOAL", parent: null }, { i: 1, level: "OUTCOME", parent: 0 }, { i: 2, level: "OUTPUT", parent: 1 }] };
  const odd = { items: [{ i: 0, level: "GOAL", parent: null }, { i: 1, level: "OUTPUT", parent: 0 }, { i: 2, level: "OUTPUT", parent: 0 }] };
  const replies = [good, odd, good];
  let n = 0;
  const llm = { available: async () => true, completeJson: async () => ({ ok: true, value: { text: JSON.stringify(replies[n++]), model: "m", promptVersion: "p", usage: { inputTokens: 10, outputTokens: 5 } } }) };
  const out = await runRefinement(LOGFRAME_STRUCTURE, fields, { llm, tenantId: TenantId.create("tenant-structure"), maxTokens: 100, timeoutMs: 100 });
  assert.equal(n, 3);
  assert.equal(out.usage.calls, 3);
  assert.deepEqual(out.fields.logframe.map((i) => [i.value.level, i.value.parentCode]), [["GOAL", null], ["OUTCOME", "G"], ["OUTPUT", null]]);
  const broken = { available: async () => true, completeJson: async () => ({ ok: true, value: { text: "not json", model: "m", promptVersion: "p" } }) };
  const kept = await runRefinement(LOGFRAME_STRUCTURE, fields, { llm: broken, tenantId: TenantId.create("tenant-structure"), maxTokens: 100, timeoutMs: 100 });
  assert.equal(kept.refined, false);
  assert.equal(kept.fields, fields);
});

import { readIndicatorSheet } from "../dist/project-setup/indicator-sheet-reader.js";
import { combineFields } from "../dist/project-setup/partial-sheet-first-extractor.js";

test("an indicator table (PITT) is read by its headers, figures as written, missing cells Not stated, codes kept", () => {
  const pitt = [
    "# PITT", "Code\tIndicateur\tRésultat\tUnité\tValeur de référence\tCible\tFréquence\tSource de vérification",
    "IND1\tNumber of health care providers trained on EmONC\tOP1\tProviders\t0\t42\tQuarterly\tTraining reports",
    "IND2\tPercentage of deliveries with a skilled birth attendant\tOC1\t%\t35%\t60%\tAnnual\tHMIS",
    "IND3\tReferral mechanism established\tA referral output\t\tN/A\t1\t\t",
    "Total\t\t\t\t\t\t\t",
  ].join("\n").replace("Source de vérification", "Sources de vérification");
  const read = readIndicatorSheet(blocksOf(pitt, "source-2"));
  assert.deepEqual(read.documentIds, ["source-2"]);
  assert.equal(read.combine, "APPEND");
  assert.deepEqual(read.fields.indicators.map((i) => [i.value.code, i.value.logframeCode, i.value.baseline, i.value.target, i.value.type, i.value.frequency]), [
    ["IND1", "OP1", "0", "42", null, "Quarterly"],
    ["IND2", "OC1", "35%", "60%", "PERCENTAGE", "Annual"],
    ["IND3", null, null, "1", null, null],
  ]);
  assert.match(read.fields.indicators[0].sourceQuote, /^IND1 Number of health care providers trained on EmONC OP1/);
  assert.equal(readIndicatorSheet(blocksOf("Indicator\tNotes\nSomething long enough\tx")), null);
});

test("combineFields replaces by default and appends the sheet's items first when asked", () => {
  assert.deepEqual(combineFields({ budget: [1], funding: [2] }, { fields: { budget: [9] }, documentIds: [] }), { budget: [9], funding: [2] });
  assert.deepEqual(combineFields({ indicators: [1] }, { fields: { indicators: [9] }, documentIds: [], combine: "APPEND" }), { indicators: [9, 1] });
});

import { parseLogframeMatrix, levelCell } from "../dist/project-setup/logframe-matrix.js";
import { logframeSheetReader } from "../dist/project-setup/sheet-readers.js";
import { groundAreaPatch as ground37, joinBlocks as join37 } from "@donordesk/domain";

const EU_MATRIX = [
  "# Logframe",
  "\tIntervention logic\tIndicators\tBaseline\tTarget\tSources of verification\tAssumptions",
  "Overall objective\tReduced maternal mortality in Upper Dir\tMaternal mortality ratio\t275\t200\tPDHS\t",
  "Specific objective 1\tImproved emergency obstetric care in public facilities\tPercentage of PPH cases managed to protocol\t20%\t80%\tFacility records\tStaff stay",
  "Output 1.1\tHealth care providers trained on EmONC\tNumber of providers trained\t0\t42\tTraining reports\t",
  "\t\tNumber of trainings held\t0\t4\tAttendance sheets\t",
  "Output 1.2\tRemote online clinics established\tNumber of clinics running\t0\t3\tClinic logs\t",
  "Activities\tTrain master trainers\t\t\t\t\t",
  "\tHold trickle-down trainings\t\t\t\t\t",
].join("\n");

test("levelCell reads the level, its code and the rest, in three languages", () => {
  assert.deepEqual(levelCell("Output 1.2: Clinics set up"), { level: "OUTPUT", code: "1.2", rest: "Clinics set up" });
  assert.deepEqual(levelCell("Objectif spécifique 2"), { level: "OUTCOME", code: "2", rest: "" });
  assert.equal(levelCell("Producto 3 - Clínicas").level, "OUTPUT");
  assert.equal(levelCell("Train the trainers"), null);
});

test("a logframe matrix gives the results chain and the indicators on each result's own rows, and all of it grounds", () => {
  const blocks = blocksOf(EU_MATRIX, "source-1");
  const rows = parseLogframeMatrix(blocks);
  assert.deepEqual(rows.map((r) => [r.node.value.level, r.node.value.code, r.node.value.parentCode, r.node.value.title]), [
    ["GOAL", "G1", null, "Reduced maternal mortality in Upper Dir"],
    ["OUTCOME", "1", "G1", "Improved emergency obstetric care in public facilities"],
    ["OUTPUT", "1.1", "1", "Health care providers trained on EmONC"],
    ["OUTPUT", "1.2", "1", "Remote online clinics established"],
    ["ACTIVITY", "A1.2.1", "1.2", "Train master trainers"],
    ["ACTIVITY", "A1.2.2", "1.2", "Hold trickle-down trainings"],
  ]);
  const indicators = readIndicatorSheet(blocks).fields.indicators;
  assert.deepEqual(indicators.map((i) => [i.value.title, i.value.logframeCode, i.value.baseline, i.value.target]), [
    ["Maternal mortality ratio", "G1", "275", "200"],
    ["Percentage of PPH cases managed to protocol", "1", "20%", "80%"],
    ["Number of providers trained", "1.1", "0", "42"],
    ["Number of trainings held", "1.1", "0", "4"],
    ["Number of clinics running", "1.2", "0", "3"],
  ]);
  const text = join37(blocks);
  const logframe = logframeSheetReader(blocks);
  assert.equal(ground37("LOGFRAME", logframe, text).dropped, 0);
  assert.equal(ground37("INDICATORS", { indicators }, text).dropped, 0);
});

import { countriesFromBlocks, FactsFromTextExtractor } from "../dist/project-setup/facts-from-text.js";
import { dropPromptEchoes } from "../dist/project-setup/area-passes.js";

test("the budget workbook gives its categories, the detailed rows and the stated totals, and they add up", () => {
  const book = [
    "# Summary Budget", "\tBudgets developed in Pakistani Rupee (PKRs.)", "\tSUMMARY BUDGET\t\t10 Months\tTotal",
    "\tPersonnel\t\t100\t100", "\t     Local staff\t\t100\t100", "\tTravel\t\t50.5\t50.5", "\tTotal Direct Costs\t\t150.5\t150.5", "\tTOTAL PROJECT COSTS\t\t150.5\t150.5",
    "# Detailed Budget", "Ref No. \tLine Item / Description\tDescription \tUnit\tUnits\tCost/Unit\tCost",
    "A\tPERSONNEL COST", "A.1\tDirector\t1 Director\tMonths\t10\t6\t60", "A.2\tOfficer\t\tMonths\t10\t4\t40", "A.3\tRemoved line\t\tMonths\t1\t0\t0",
    "\tTOTAL PERSONNEL\t\t\t\t\t100", "C 1\t\tFlights to Peshawar\tTrips\t1\t50.5\t50.5", "\tTOTAL ESTIMATED COST\t\t\t\t\t150.5",
  ].join("\n");
  const blocks = blocksOf(compactSheetText(book));
  const rows = readBudgetSheet(blocks).fields.budget;
  assert.deepEqual(rows.map((r) => [r.value.kind, r.value.ref ?? null, r.value.category, r.value.amount]), [
    ["LINE", null, "Personnel", "100"], ["LINE", null, "Travel", "50.5"], ["TOTAL", null, "TOTAL PROJECT COSTS", "150.5"],
    ["DETAIL", "A.1", "Director", "60"], ["DETAIL", "A.2", "Officer", "40"], ["DETAIL", "C 1", "Flights to Peshawar", "50.5"], ["TOTAL", null, "TOTAL ESTIMATED COST", "150.5"],
  ]);
  assert.equal(ground37("FUNDING_BUDGET", { budget: rows }, join37(blocks)).dropped, 0);
});

test("a country the model left Not stated is found in the documents' own words, preferring the proposal", async () => {
  const blocks = [
    { documentId: "s1", index: 0, text: "# LOE\nPakistan\tstaff list", docKind: "BUDGET" },
    { documentId: "s2", index: 1, text: "The project serves District Upper Dir, Khyber Pakhtunkhwa, Pakistan, through public facilities.", docKind: "PROPOSAL" },
  ];
  const found = countriesFromBlocks(blocks);
  assert.deepEqual([found.value, found.sourceRef.documentId], [["Pakistan"], "s2"]);
  assert.ok(blocks[1].text.includes(found.sourceQuote));
  const N = { value: null, sourceQuote: null, sourceRef: null, confidence: "LOW", status: "PROPOSED" };
  const inner = { area: "FACTS", extract: async () => ({ ok: true, value: { fields: { facts: { countries: N, name: { ...N, value: "X" } } } } }) };
  const out = await new FactsFromTextExtractor(inner).extract({ blocks });
  assert.deepEqual(out.value.fields.facts.countries.value, ["Pakistan"]);
  const given = { area: "FACTS", extract: async () => ({ ok: true, value: { fields: { facts: { countries: { ...N, value: ["Kenya"], sourceQuote: "Kenya" } } } } }) };
  assert.deepEqual((await new FactsFromTextExtractor(given).extract({ blocks })).value.fields.facts.countries.value, ["Kenya"]);
});

test("items quoting the prompt's own example words are removed", () => {
  const prompt = 'Answer: {"title": "Households use safe water", "quote": "..."}';
  const out = dropPromptEchoes({ logframe: [{ sourceQuote: "Households use safe water" }, { sourceQuote: "Mothers deliver in facilities" }, { sourceQuote: "0" }] }, prompt);
  assert.equal(out.dropped, 1);
  assert.deepEqual(out.fields.logframe.map((i) => i.sourceQuote), ["Mothers deliver in facilities", "0"]);
});

import { fit } from "../dist/project-setup/fit-text.js";

test("a Gantt row whose title is longer than a title may be is cut at a word, never breaking the proposal, and still grounds", () => {
  assert.equal(fit("short", 300), "short");
  assert.equal(fit(null, 10), null);
  const long = `Identify and adapt training modules on ${"postpartum haemorrhage care and hypertensive disorders ".repeat(8)}for 16 providers`;
  const cut = fit(long, 300);
  assert.ok(cut.length <= 300 && cut.endsWith("…"));
  const sheet = ["Activity Code\tActivities\tLOP Target\tJuly\tAugust, 2023", GANTT_WEEKS, `5.1\t${long}\t\tx`, "5.2\tB task\t\tx", "5.3\tC task\t\tx"].join("\n");
  const blocks = blocksOf(compactSheetText(sheet));
  const plan = workPlanSheetReader(blocks).plan;
  assert.ok(plan[0].value.title.length <= 300);
  assert.equal(ground37("PLAN", { plan }, join37(blocks)).dropped, 0);
});

test("a detailed-budget row whose description cell has line breaks is put back together and still adds up", () => {
  const book = [
    "# Summary Budget", "\tBudgets developed in Pakistani Rupee (PKRs.)", "\tPersonnel\t\t1530100\t1530100", "\tTOTAL PROJECT COSTS\t\t1530100\t1530100",
    "# Detailed Budget", "Ref No. \tLine Item / Description\tDescription \tUnit\tUnits\tCost/Unit\tCost",
    "D.2.1\tTablets for Outreach", "", "[SAMSUNG Galaxy Tab A7 Lite - LTE T225\t\tNo.\t20\t76500\t1530000", "D.2.2\tCases\t\tNo.\t1\t100\t100",
    "\tTOTAL ESTIMATED COST\t\t\t\t\t1530100",
  ].join("\n");
  const blocks = blocksOf(compactSheetText(book));
  const rows = readBudgetSheet(blocks).fields.budget.filter((r) => r.value.kind === "DETAIL");
  assert.deepEqual(rows.map((r) => [r.value.ref, r.value.amount]), [["D.2.1", "1530000"], ["D.2.2", "100"]]);
  assert.equal(ground37("FUNDING_BUDGET", { budget: rows }, join37(blocks)).dropped, 0);
});

test("a Gantt row whose title cell has line breaks keeps its code and its dates", () => {
  const sheet = ["Activity Code\tActivities\tLOP Target\tJuly\tAugust, 2023", GANTT_WEEKS, "1.1\tAttend the kick-off", "meeting with partners\t1 meeting\tx", "1.2\tB task\t\tx", "1.3\tC task\t\tx"].join("\n");
  const blocks = blocksOf(compactSheetText(sheet));
  const plan = workPlanSheetReader(blocks).plan;
  assert.deepEqual([plan[0].value.planCode, plan[0].value.title, plan[0].value.start], ["1.1", "Attend the kick-off meeting with partners", "2023-07-22"]);
  assert.equal(ground37("PLAN", { plan }, join37(blocks)).dropped, 0);
});
