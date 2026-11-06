import test from "node:test";
import assert from "node:assert/strict";
import { projectCandidate, indicatorCandidates, activityCandidates, evidenceCandidates, selectSources, buildAskPrompt, groundAnswer, askFigures, questionTerms } from "../dist/index.js";

const sheet = {
  projectId: "p", finance: [],
  periods: [{ id: "a", label: "Jan 2026", start: "2026-01-01", end: "2026-01-31" }, { id: "b", label: "Feb 2026", start: "2026-02-01", end: "2026-02-28" }],
  indicators: [
    { id: "i1", code: "OUT-1", name: "Households receiving kits", type: "NUMBER", unit: "households", baseline: "0", target: "1,200" },
    { id: "i2", code: "OUT-2", name: "Water points repaired", type: "NUMBER", baseline: "0", target: "40" },
    { id: "i3", code: "OUT-3", name: "Trainings held", type: "NUMBER", baseline: "0", target: "10" },
  ],
  cells: [
    { indicatorId: "i1", periodId: "b", periodValue: "310", cumulativeValue: "480", status: "DRAFT" },
    { indicatorId: "i1", periodId: "a", periodValue: "170", cumulativeValue: "170", status: "VERIFIED" },
    { indicatorId: "i2", periodId: "a", periodValue: "", cumulativeValue: "", status: "DRAFT", notApplicable: true },
  ],
};
const all = [
  projectCandidate({ title: "WASH Gulu", projectCode: "WG-1", country: "Uganda" }),
  ...indicatorCandidates(sheet),
  ...activityCandidates([{ title: "Hygiene session", date: "2026-02-03", location: "Gulu", participants: 42, summary: "Handwashing demonstration." }]),
  ...evidenceCandidates([{ title: "Attendance sheet", text: "Attendance list for the hygiene session in Gulu. 42 people signed.", verified: true }, { title: "Empty", text: "", verified: false }]),
];

test("indicator sources list every recorded value in period order with whether it is verified; not-applicable and empty are not values", () => {
  const [i1, i2, i3] = indicatorCandidates(sheet);
  assert.match(i1.text, /Jan 2026: period value 170, cumulative 170 \(verified\); Feb 2026: period value 310, cumulative 480 \(not yet verified\)/);
  assert.match(i2.text, /No value has been recorded yet/);
  assert.match(i3.text, /No value has been recorded yet/);
  assert.equal(evidenceCandidates([{ title: "x", text: "", verified: true }]).length, 0);
});

test("selection: relevant sources first, a named indicator code outranks word matches, the project always goes, nothing relevant leaves only the project", () => {
  const byCode = selectSources("What is the latest value of OUT-1?", all);
  assert.equal(byCode[0].id, "S1");
  assert.equal(byCode[0].kind, "PROJECT");
  assert.equal(byCode[1].label, "Indicator OUT-1");
  const byWords = selectSources("Who attended the hygiene session in Gulu?", all);
  assert.deepEqual(byWords.slice(1).map((s) => s.kind).sort(), ["ACTIVITY", "EVIDENCE"]);
  assert.deepEqual(selectSources("What is the weather like?", all).map((s) => s.kind), ["PROJECT"]);
  assert.deepEqual(questionTerms("How many households were reached?"), ["households", "reached"]);
  assert.ok(selectSources("hygiene Gulu OUT-1", all, { limit: 2 }).length <= 2);
});

test("the prompt numbers the sources and carries the rules", () => {
  const sources = selectSources("OUT-1?", all);
  const p = buildAskPrompt("OUT-1?", sources);
  assert.match(p.system, /ONLY the numbered sources/);
  assert.match(p.user, /\[S2\] Indicator OUT-1/);
});

const sources = selectSources("How many households received kits (OUT-1)?", all);
const reply = (o) => JSON.stringify(o);

test("a sentence is kept only if it names a real source and its figures are in the sources it names", () => {
  const good = groundAnswer(reply({ answer: [
    { text: "In January 170 households received kits (verified).", sources: ["S2"] },
    { text: "The February figure of 310 is not yet verified.", sources: ["s2"] },
    { text: "That is 480 in total.", sources: ["S2"] },
  ], missing: [] }), sources);
  assert.equal(good.status, "ANSWERED");
  assert.equal(good.sentences.length, 3);
  assert.equal(good.sentences[1].sources[0].id, "S2", "ids are matched without regard to case");
  assert.deepEqual(good.dropped, { uncited: 0, ungrounded: 0 });

  const bad = groundAnswer(reply({ answer: [
    { text: "About 500 households received kits.", sources: ["S2"] },
    { text: "Kits reached households.", sources: [] },
    { text: "Kits reached households.", sources: ["S99"] },
    { text: "The target is 1200 households.", sources: ["S2"] },
  ] }), sources);
  assert.equal(bad.sentences.length, 1, "1,200 and 1200 are the same figure");
  assert.deepEqual(bad.dropped, { uncited: 2, ungrounded: 1 });
});

test("a figure must come from the source the sentence names, not from any source", () => {
  const two = selectSources("OUT-1 OUT-2 hygiene Gulu", all);
  const act = two.find((s) => s.kind === "ACTIVITY");
  const ind = two.find((s) => s.label === "Indicator OUT-1");
  const r = groundAnswer(reply({ answer: [{ text: "42 households received kits.", sources: [ind.id] }, { text: "42 people took part in the hygiene session.", sources: [act.id] }] }), two);
  assert.deepEqual(r.sentences.map((s) => s.sources[0].kind), ["ACTIVITY"]);
  assert.equal(r.dropped.ungrounded, 1);
});

test("nothing left is NOT_FOUND; the model's own 'missing' is kept only if its figures are in the sources", () => {
  const none = groundAnswer(reply({ answer: [{ text: "It was 999.", sources: ["S2"] }], missing: ["The number reached in March", "Nothing for 777 households"] }), sources);
  assert.equal(none.status, "NOT_FOUND");
  assert.deepEqual(none.missing, ["The number reached in March"]);
  assert.equal(groundAnswer("not json at all", sources).status, "NOT_FOUND");
  assert.equal(groundAnswer("", sources).sentences.length, 0);
});

test("a truncated reply still yields the sentences that were written whole", () => {
  const cut = '{"answer":[{"text":"In January 170 households received kits (verified).","sources":["S2"]},{"text":"In Feb';
  assert.equal(groundAnswer(cut, sources).sentences.length >= 1, true);
});

test("figures are compared in one spelling", () => {
  assert.deepEqual(askFigures("1,200 and 1200.0 and 62.50%"), ["1200", "1200", "62.5"]);
});
