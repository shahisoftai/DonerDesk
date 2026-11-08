import test from "node:test";
import assert from "node:assert/strict";
import {
  applyOperation, applyResultOperation, emptyDraft, libraryIndicator, BUILT_IN_CONTENT, BUILT_IN_PACKS, resolvePack, emptyProposal, projectInputFromDraft, LAUNCH_STEPS,
} from "../dist/index.js";

const draft = () => emptyDraft(false);
const ok = (r) => { assert.equal(r.ok, true, r.reason); return r; };

test("choosing sectors: unknown and attached packs are refused, the main one files the project, repeats collapse, empty clears", () => {
  assert.equal(applyOperation(draft(), { kind: "SET_SECTORS", sectorIds: ["NOPE"] }).ok, false);
  assert.equal(applyOperation(draft(), { kind: "SET_SECTORS", sectorIds: ["PROTECTION_AAP", "WASH"] }).ok, false);
  const d = ok(applyOperation(draft(), { kind: "SET_SECTORS", sectorIds: ["GBV", "HEALTH", "GBV"] })).draft;
  assert.deepEqual(d.extras.start.sectors, ["GBV", "HEALTH"]);
  assert.equal(d.extras.start.sector, "PROTECTION", "filed under the sector word a project stores");
  const cleared = ok(applyOperation(d, { kind: "SET_SECTORS", sectorIds: [] })).draft;
  assert.equal(cleared.extras.start.sectors, undefined);
});

test("assessment answers are kept per question and cleared by an empty answer", () => {
  let d = ok(applyOperation(draft(), { kind: "SET_LIBRARY_ANSWER", key: "season", value: " Rains in April " })).draft;
  assert.deepEqual(d.extras.libraryAnswers, { season: "Rains in April" });
  assert.equal(applyOperation(d, { kind: "SET_LIBRARY_ANSWER", key: "Bad Key!", value: "x" }).ok, false);
  d = ok(applyOperation(d, { kind: "SET_LIBRARY_ANSWER", key: "season", value: "  " })).draft;
  assert.deepEqual(d.extras.libraryAnswers, {});
});

test("the suggested results are added parents first, with codes, once", () => {
  const skeleton = BUILT_IN_CONTENT.WASH.logframe;
  const first = ok(applyResultOperation(emptyProposal(), { kind: "ADD_FROM_SKELETON", sectorId: "WASH", skeleton }));
  const nodes = first.proposal.logframe.map((n) => n.value);
  assert.equal(nodes.filter((n) => n.level === "GOAL").length, 1);
  assert.ok(nodes.every((n) => n.code));
  const outputs = nodes.filter((n) => n.level === "OUTPUT");
  assert.ok(outputs.every((o) => nodes.find((p) => p.code === o.parentCode)?.level === "OUTCOME"));
  assert.ok(nodes.filter((n) => n.level === "ACTIVITY").every((a) => nodes.find((p) => p.code === a.parentCode)?.level === "OUTPUT"));
  assert.ok(first.proposal.logframe.every((n) => n.status === "EDITED" && n.sourceQuote === null), "the person's own, no quote");
  const again = applyResultOperation(first.proposal, { kind: "ADD_FROM_SKELETON", sectorId: "WASH", skeleton });
  assert.equal(again.ok, false, "nothing twice");
  const few = ok(applyResultOperation(emptyProposal(), { kind: "ADD_FROM_SKELETON", sectorId: "NUTRITION", skeleton: BUILT_IN_CONTENT.NUTRITION.logframe, nodeKeys: ["out-screen"] }));
  assert.ok(few.proposal.logframe.some((n) => n.value.title.includes("acute malnutrition")), "an output brings the outcome and goal above it");
});

test("library indicators become the person's own indicators under the result they measure; no target or baseline; a reference only as text", () => {
  const skeleton = ok(applyResultOperation(emptyProposal(), { kind: "ADD_FROM_SKELETON", sectorId: "WASH", skeleton: BUILT_IN_CONTENT.WASH.logframe })).proposal;
  const entries = ["WASH-W-01", "WASH-S-03", "WASH-Q-02"].map(libraryIndicator);
  const r = ok(applyResultOperation(skeleton, { kind: "ADD_FROM_LIBRARY", entries, logframeCode: null, today: "2026-11-08" }));
  const by = Object.fromEntries(r.proposal.indicators.map((i) => [i.value.code, i]));
  const titleOf = (code) => r.proposal.logframe.find((n) => n.value.code === by[code].value.logframeCode).value.title;
  assert.equal(titleOf("WASH-S-03"), "Toilets are built, safe and used");
  assert.equal(titleOf("WASH-Q-02"), "Water is tested and treated to stay safe");
  const w = by["WASH-W-01"];
  assert.equal(w.status, "EDITED");
  assert.equal(w.value.target, null);
  assert.equal(w.value.baseline, null);
  assert.equal(w.value.type, "RATIO");
  assert.equal(w.value.direction, "higher is better");
  assert.match(w.value.referenceText, /at least 15 l\/p\/d/);
  assert.equal(w.value.libraryId, "WASH-W-01");
  assert.equal(JSON.parse(w.value.libraryLinkJson).snapshot.referenceStandard.verified, true);
  assert.equal(applyResultOperation(r.proposal, { kind: "ADD_FROM_LIBRARY", entries: [entries[0]], today: "2026-11-08" }).ok, false, "already there");
  assert.equal(applyResultOperation(r.proposal, { kind: "ADD_FROM_LIBRARY", entries: [libraryIndicator("WASH-H-01")], logframeCode: "NOT-A-CODE", today: "2026-11-08" }).ok, false);
  assert.equal(applyResultOperation(r.proposal, { kind: "ADD_FROM_LIBRARY", entries: [], today: "2026-11-08" }).ok, false);
  const bare = ok(applyResultOperation(emptyProposal(), { kind: "ADD_FROM_LIBRARY", entries: [libraryIndicator("WASH-H-01")], today: "2026-11-08" }));
  assert.equal(bare.proposal.indicators[0].value.logframeCode, null, "with no results yet it is added unlinked, and the wizard asks for a result");
});

test("a pack for every main sector: hand-written ones win, an organisation's general pack outranks the library's, the generic is the last resort", () => {
  assert.equal(resolvePack(BUILT_IN_PACKS, "WASH").id, "builtin:wash");
  assert.equal(resolvePack(BUILT_IN_PACKS, "GBV").id, "builtin:library:gbv");
  assert.equal(resolvePack(BUILT_IN_PACKS, "nonsense").id, "builtin:generic");
  const org = { id: "org:general", sector: null, source: "ORGANISATION", label: "Ours", reportRules: [], risks: [] };
  assert.equal(resolvePack([...BUILT_IN_PACKS, org], "GBV").id, "org:general");
  const libraryPack = BUILT_IN_PACKS.find((p) => p.id === "builtin:library:shelter_nfi");
  assert.ok(libraryPack.risks.length >= 3);
  assert.equal(libraryPack.dashboardTemplate, "tpl-lib-shelter-nfi", "the starting dashboard is the one built from the sector's headline indicators");
  assert.ok(BUILT_IN_PACKS.every((p) => p.sector === null || p.risks.length > 0));
});

test("launch writes the assessment answers into the project description and starts with the library link step", () => {
  assert.equal(LAUNCH_STEPS[0].key, "LIBRARY_LINKS");
  const d = ok(applyOperation(draft(), { kind: "SET_LIBRARY_ANSWER", key: "season", value: "Rains in April" })).draft;
  const full = { ...d, proposal: { ...d.proposal, facts: { ...d.proposal.facts, name: item("N"), code: item("C"), startDate: item("2027-01-01"), endDate: item("2027-12-31"), summary: item("Summary") } }, extras: { ...d.extras, start: { donor: "EU", country: "Uganda", sector: "WASH", withDocuments: false }, schedule: { cadence: "QUARTERLY", rules: [], reminders: true } } };
  const r = projectInputFromDraft(full, { organisationName: "Org", userId: "u1", userIdByEmail: new Map() });
  assert.equal(r.ok, true, r.reason);
  assert.match(r.input.description, /Summary\n\nStarting assessment\n- season: Rains in April/);
});
function item(value) { return { value, sourceQuote: null, sourceRef: null, confidence: "HIGH", status: "EDITED" }; }
