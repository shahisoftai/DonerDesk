import assert from "node:assert/strict";
import test from "node:test";
import { FRAMEWORK_CHANGE_KINDS, classifyFrameworkChange, formatChangeKinds, parseChangeKinds, checkPostApprovalChange, judgedFieldsChanged, POST_APPROVAL_RULES, buildLogframeSnapshot, diffLogframeSnapshots } from "../dist/index.js";

const item = (o = {}) => ({ id: "i1", level: "OUTPUT", code: "OUT-1", title: "Trained staff", sortOrder: 0, ...o });
const ind = (o = {}) => ({ id: "n1", logframeItemId: "i1", code: "IND-1", name: "People trained", type: "NUMBER", baseline: "0", target: "100", disaggregationRequired: false, isArchived: false, targetBreakdowns: [], ...o });
const approvedIndicator = (o = {}) => buildLogframeSnapshot([item()], [ind(o)]).indicators[0];

test("every change kind is placed, results are structure and indicators are measurement", () => {
  assert.deepEqual(Object.keys(FRAMEWORK_CHANGE_KINDS).sort(), ["INDICATOR_ADDED", "INDICATOR_CHANGED", "INDICATOR_REMOVED", "ITEM_ADDED", "ITEM_CHANGED", "ITEM_REMOVED"]);
  const before = buildLogframeSnapshot([item()], [ind()]);
  const after = buildLogframeSnapshot([item({ title: "Trained health staff" })], [ind({ target: "120" })]);
  const c = classifyFrameworkChange(diffLogframeSnapshots(before, after));
  assert.equal(c.structure.length, 1);
  assert.equal(c.measurement.length, 1);
  assert.deepEqual(c.kinds, ["STRUCTURE", "MEASUREMENT"]);
  assert.deepEqual(classifyFrameworkChange([]).kinds, []);
});

test("stored kinds round-trip and ignore anything unknown", () => {
  assert.equal(formatChangeKinds(["STRUCTURE", "MEASUREMENT"]), "STRUCTURE,MEASUREMENT");
  assert.deepEqual(parseChangeKinds("MEASUREMENT"), ["MEASUREMENT"]);
  assert.deepEqual(parseChangeKinds("junk,STRUCTURE,"), ["STRUCTURE"]);
  assert.deepEqual(parseChangeKinds(undefined), []);
  assert.deepEqual(parseChangeKinds(""), []);
});

test("rule 1: with no approved version, or an indicator the approved version lacks, anything goes", () => {
  assert.deepEqual(checkPostApprovalChange({ approved: null, patch: { target: "5", code: "X" }, reason: undefined, usedInApprovedReport: true }), { allowed: true });
});

test("rule 2: a code in an approved framework does not change; the same code is not a change", () => {
  const approved = approvedIndicator();
  const refused = checkPostApprovalChange({ approved, patch: { code: "IND-2" }, reason: "a long enough reason", usedInApprovedReport: false });
  assert.equal(refused.allowed, false);
  assert.equal(refused.code, "CODE_LOCKED");
  assert.equal(checkPostApprovalChange({ approved, patch: { code: "IND-1" }, reason: undefined, usedInApprovedReport: false }).allowed, true);
});

test("rule 3: a judged field used by an approved report needs a reason; the reason is returned to be kept", () => {
  const approved = approvedIndicator();
  const no = checkPostApprovalChange({ approved, patch: { target: "120" }, reason: undefined, usedInApprovedReport: true });
  assert.equal(no.allowed, false);
  assert.equal(no.code, "REASON_REQUIRED");
  assert.match(no.message, /target/);
  assert.equal(checkPostApprovalChange({ approved, patch: { target: "120" }, reason: "too short", usedInApprovedReport: true }).allowed, false);
  assert.deepEqual(checkPostApprovalChange({ approved, patch: { target: "120" }, reason: "  Donor revised the target in amendment 2  ", usedInApprovedReport: true }), { allowed: true, reason: "Donor revised the target in amendment 2" });
});

test("rule 3 does not fire when nothing judged changes, when no approved report used it, or when the value is the same", () => {
  const approved = approvedIndicator();
  for (const facts of [
    { patch: { name: "People trained in nutrition" }, usedInApprovedReport: true },
    { patch: { target: "120" }, usedInApprovedReport: false },
    { patch: { target: "100" }, usedInApprovedReport: true },
    { patch: { targetSchedule: [] }, usedInApprovedReport: true },
    { patch: { baseline: "" }, usedInApprovedReport: true, approved: approvedIndicator({ baseline: "" }) },
  ]) {
    assert.equal(checkPostApprovalChange({ approved, reason: undefined, ...facts }).allowed, true, JSON.stringify(facts));
  }
  assert.deepEqual(judgedFieldsChanged({ approved, patch: { target: "1", baseline: "0", targetSchedule: [{ asOf: "2027-01-01", target: "5" }] } }), ["target", "targetSchedule"]);
});

test("the rules are an ordered table with unique ids", () => {
  const ids = POST_APPROVAL_RULES.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids, ["NOT_IN_APPROVED_FRAMEWORK", "CODE_IS_FIXED", "JUDGED_FIELD_NEEDS_REASON"]);
});
