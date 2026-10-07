import test from "node:test";
import assert from "node:assert/strict";
import { CHECKLIST_ITEM_TYPES, CHECKLIST_KIND, CHECKLIST_STATE_RULES, ChecklistItem, DATA_SETTLED_ATTESTATIONS, isAttestation, isConcernTracked, stateItemsToClose } from "../dist/index.js";

test("every item type is classified, and exactly the state types and the data-settled attestations have a rule", () => {
  assert.deepEqual(Object.keys(CHECKLIST_KIND).sort(), [...CHECKLIST_ITEM_TYPES].sort());
  const stateTypes = CHECKLIST_ITEM_TYPES.filter((t) => CHECKLIST_KIND[t] === "STATE" || DATA_SETTLED_ATTESTATIONS.has(t)).sort();
  assert.deepEqual(CHECKLIST_STATE_RULES.map((r) => r.type).sort(), stateTypes);
});

test("AI output review, sensitive-data handling and sign-off are attestations", () => {
  for (const t of ["UNREVIEWED_AI_OUTPUT", "SENSITIVE_DATA_WARNING", "MISSING_APPROVAL", "DONOR_REQUIREMENT", "MISSING_PROCUREMENT_DOCUMENT"]) assert.equal(isAttestation(t), true, t);
});

const open = (type, relatedEntityId, status = "OPEN") => ({ type, status, relatedEntityId });

test("each rule: satisfied, not satisfied, and not known", () => {
  const cases = [
    ["MISSING_EVIDENCE", undefined, { evidenceCount: 59, requiredEvidenceCount: 5 }, { evidenceCount: 2, requiredEvidenceCount: 5 }],
    ["UNVERIFIED_INDICATOR", undefined, { verifiedIndicatorCount: 8, totalIndicatorCount: 8 }, { verifiedIndicatorCount: 3, totalIndicatorCount: 8 }],
    ["LATE_ACTIVITY_UPDATE", undefined, { activityCount: 6 }, { activityCount: 0 }],
    ["MISSING_DISAGGREGATION", undefined, { missingBreakdownCount: 0 }, { missingBreakdownCount: 2 }],
    ["ACTIVITY_RECORD_ACCEPTED", "a1", { activityStatusById: new Map([["a1", "ACCEPTED"]]) }, { activityStatusById: new Map([["a1", "SUBMITTED"]]) }],
    ["INDICATOR_SEMANTICS_UNREVIEWED", "i1", { confirmedSemanticsIds: new Set(["i1"]) }, { confirmedSemanticsIds: new Set() }],
    ["FINANCE_FIGURES_PROVIDED", undefined, { financeStatus: "VERIFIED" }, { financeStatus: "UNVERIFIED" }],
    ["CUMULATIVE_DATA_COMPLETE", "i1", { cumulativeGapIds: new Set(["i2"]) }, { cumulativeGapIds: new Set(["i1"]) }],
    ["PRIOR_REPORT_LINKED", undefined, { priorReportLinked: true }, { priorReportLinked: false }],
  ];
  for (const [type, entity, good, bad] of cases) {
    assert.equal(stateItemsToClose([open(type, entity)], good).length, 1, `${type} satisfied`);
    assert.equal(stateItemsToClose([open(type, entity)], bad).length, 0, `${type} unsatisfied`);
    assert.equal(stateItemsToClose([open(type, entity)], {}).length, 0, `${type} unknown`);
  }
  assert.equal(stateItemsToClose([open("FINANCE_FIGURES_PROVIDED")], { financeStatus: "OFF" }).length, 1, "finance off is satisfied");
});

test("only open items close, and attestations never do", () => {
  const facts = { activityCount: 6, missingBreakdownCount: 0, evidenceCount: 9, requiredEvidenceCount: 5 };
  const items = [open("LATE_ACTIVITY_UPDATE", undefined, "RESOLVED"), open("UNREVIEWED_AI_OUTPUT"), open("SENSITIVE_DATA_WARNING"), open("MISSING_DISAGGREGATION", undefined, "IN_PROGRESS")];
  assert.deepEqual(stateItemsToClose(items, facts).map((c) => c.item.type), ["MISSING_DISAGGREGATION"]);
  assert.match(stateItemsToClose(items, facts)[0].reason, /^Closed automatically: every indicator that needs a breakdown has one\.$/);
});

test("a decided attestation is not raised again; a decided state item is; a different title is a new cause", () => {
  const decided = { type: "SENSITIVE_DATA_WARNING", status: "RESOLVED", title: "Sensitive data handling confirmed" };
  assert.equal(isConcernTracked([decided], { type: "SENSITIVE_DATA_WARNING", title: "Sensitive data handling confirmed" }), true);
  assert.equal(isConcernTracked([{ ...decided, status: "ACCEPTED_RISK" }], { type: "SENSITIVE_DATA_WARNING", title: "Sensitive data handling confirmed" }), true);
  assert.equal(isConcernTracked([decided], { type: "SENSITIVE_DATA_WARNING", title: "New evidence is flagged sensitive" }), false);
  const decidedState = { type: "LATE_ACTIVITY_UPDATE", status: "RESOLVED", title: "No activity updates submitted for this period" };
  assert.equal(isConcernTracked([decidedState], { type: "LATE_ACTIVITY_UPDATE", title: decidedState.title }), false);
  assert.equal(isConcernTracked([{ type: "LATE_ACTIVITY_UPDATE", status: "OPEN", title: "x" }], { type: "LATE_ACTIVITY_UPDATE", title: "other title" }), true);
  assert.equal(isConcernTracked([{ ...decided, relatedEntityId: "x" }], { type: "SENSITIVE_DATA_WARNING", title: decided.title }), false);
});

test("a resolved item can be reopened, and the note that justified the decision goes with it", () => {
  const item = ChecklistItem.create({ id: "c1", tenantId: "t", projectId: "p", reportingPeriodId: "rp", type: "SENSITIVE_DATA_WARNING", title: "Sensitive data handling confirmed", description: "d", severity: "HIGH" });
  assert.throws(() => item.reopen(), /Only a resolved item can be reopened/);
  item.resolve("Checked with the data officer.");
  assert.equal(item.status, "RESOLVED");
  item.reopen();
  assert.equal(item.status, "OPEN");
  assert.equal(item.resolutionNotes, undefined);
});

import { isSatisfiedByFacts as _sat, stateItemsToClose as _close } from "../dist/index.js";

test("a verified procurement document settles the procurement item, which stays an attestation otherwise (demo 7)", () => {
  assert.equal(_sat("MISSING_PROCUREMENT_DOCUMENT", { verifiedProcurementDocumentCount: 1 }, undefined), true);
  assert.equal(_sat("MISSING_PROCUREMENT_DOCUMENT", { verifiedProcurementDocumentCount: 0 }, undefined), false);
  assert.equal(_sat("MISSING_PROCUREMENT_DOCUMENT", {}, undefined), false);
  assert.equal(_sat("SENSITIVE_DATA_WARNING", { verifiedProcurementDocumentCount: 1 }, undefined), false);
  const out = _close([{ type: "MISSING_PROCUREMENT_DOCUMENT", status: "OPEN" }], { verifiedProcurementDocumentCount: 2 });
  assert.equal(out.length, 1);
});
