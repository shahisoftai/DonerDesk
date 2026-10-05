import test from "node:test";
import assert from "node:assert/strict";
import { resolveActivityNodeLink, recordParticipantHints, indicatorCountsPeople, indicatorParticipantHint } from "../dist/index.js";

const tree = [
  { id: "g", level: "GOAL" },
  { id: "oc", parentId: "g", level: "OUTCOME" },
  { id: "o1", parentId: "oc", level: "OUTPUT", title: "Teachers trained" },
  { id: "o2", parentId: "oc", level: "OUTPUT", title: "Classrooms built" },
  { id: "a1", parentId: "o1", level: "ACTIVITY" },
];

test("only the node: the output is derived from its ancestry", () => {
  assert.deepEqual(resolveActivityNodeLink(tree, { logframeActivityId: "a1" }), { ok: true, value: { logframeActivityId: "a1", outputId: "o1" } });
});
test("node and its own output agree", () => {
  assert.equal(resolveActivityNodeLink(tree, { logframeActivityId: "a1", outputId: "o1" }).ok, true);
});
test("node under a different output is refused with the output's name", () => {
  const r = resolveActivityNodeLink(tree, { logframeActivityId: "a1", outputId: "o2" });
  assert.equal(r.ok, false);
  assert.match(r.message, /Teachers trained/);
});
test("a node that is not an activity, or not in the project, is refused", () => {
  assert.match(resolveActivityNodeLink(tree, { logframeActivityId: "o1" }).message, /Activity level/);
  assert.match(resolveActivityNodeLink(tree, { logframeActivityId: "zzz" }).message, /not part of this project/);
  assert.match(resolveActivityNodeLink(tree, { outputId: "a1" }).message, /Output level/);
  assert.match(resolveActivityNodeLink(tree, { outputId: "zzz" }).message, /not part of this project/);
});
test("nothing given is fine; only an output stays as before", () => {
  assert.deepEqual(resolveActivityNodeLink(tree, {}), { ok: true, value: {} });
  assert.deepEqual(resolveActivityNodeLink(tree, { outputId: "o2" }), { ok: true, value: { outputId: "o2" } });
});
test("an activity node with no output ancestor links without inventing one", () => {
  assert.deepEqual(resolveActivityNodeLink([{ id: "a", level: "ACTIVITY" }], { logframeActivityId: "a" }), { ok: true, value: { logframeActivityId: "a" } });
});
test("a cyclic parent chain cannot loop forever", () => {
  const cyc = [{ id: "a", parentId: "b", level: "ACTIVITY" }, { id: "b", parentId: "a", level: "OUTCOME" }];
  assert.equal(resolveActivityNodeLink(cyc, { logframeActivityId: "a" }).ok, true);
});

test("record hints: sex split vs total, subgroups vs total, missing numbers are silent", () => {
  assert.deepEqual(recordParticipantHints({}), []);
  assert.deepEqual(recordParticipantHints({ participantsTotal: 100, participantsMale: 40, participantsFemale: 60 }), []);
  assert.equal(recordParticipantHints({ participantsTotal: 100, participantsMale: 70, participantsFemale: 60 })[0].code, "SEX_SPLIT_EXCEEDS_TOTAL");
  assert.equal(recordParticipantHints({ participantsTotal: 100, participantsMale: 20, participantsFemale: 60 })[0].code, "SEX_SPLIT_BELOW_TOTAL");
  assert.equal(recordParticipantHints({ participantsTotal: 10, participantsChildren: 12 })[0].code, "SUBGROUP_EXCEEDS_TOTAL");
  assert.equal(recordParticipantHints({ participantsTotal: 10, participantsDisability: 3 }).length, 0);
});

test("indicators that count people are recognised by name or unit", () => {
  assert.equal(indicatorCountsPeople({ name: "Children enrolled", type: "NUMBER" }), true);
  assert.equal(indicatorCountsPeople({ name: "Reach", unit: "households" }), true);
  assert.equal(indicatorCountsPeople({ name: "Budget spent", type: "CURRENCY" }), false);
  assert.equal(indicatorCountsPeople({ name: "Attendance rate", type: "PERCENTAGE" }), false);
});

test("indicator hint only beyond tolerance, with the may-overlap caveat; silent on no data", () => {
  const ind = { name: "People reached", type: "NUMBER" };
  assert.equal(indicatorParticipantHint({ indicator: ind, reportedValue: "100", activityTotals: [50, 55] }), undefined);
  const h = indicatorParticipantHint({ indicator: ind, reportedValue: "380", activityTotals: [200, 212] });
  assert.equal(h.code, "ACTIVITIES_EXCEED_INDICATOR");
  assert.match(h.message, /412 participants; the indicator says 380\. People may attend more than one activity/);
  assert.equal(indicatorParticipantHint({ indicator: ind, reportedValue: "400", activityTotals: [100] }).code, "ACTIVITIES_BELOW_INDICATOR");
  assert.equal(indicatorParticipantHint({ indicator: ind, reportedValue: "", activityTotals: [100] }), undefined);
  assert.equal(indicatorParticipantHint({ indicator: ind, reportedValue: "abc", activityTotals: [100] }), undefined);
  assert.equal(indicatorParticipantHint({ indicator: ind, reportedValue: "100", activityTotals: [undefined] }), undefined);
  assert.equal(indicatorParticipantHint({ indicator: { name: "Budget", type: "CURRENCY" }, reportedValue: "1", activityTotals: [500] }), undefined);
});

import { summariseActivityDelivery } from "../dist/index.js";

test("delivery per node counts records, accepted records, latest date and accepted participants", () => {
  const m = summariseActivityDelivery([
    { logframeActivityId: "a1", status: "ACCEPTED", activityDate: new Date("2026-02-01"), participantsTotal: 30 },
    { logframeActivityId: "a1", status: "SUBMITTED", activityDate: new Date("2026-03-01"), participantsTotal: 99 },
    { logframeActivityId: "a2", status: "ACCEPTED", activityDate: new Date("2026-01-01") },
    { status: "ACCEPTED", activityDate: new Date("2026-04-01"), participantsTotal: 5 },
  ]);
  assert.deepEqual(m.get("a1"), { recordedCount: 2, acceptedCount: 1, lastActivityDate: "2026-03-01T00:00:00.000Z", participantsTotal: 30 });
  assert.equal(m.get("a2").participantsTotal, 0);
  assert.equal(m.size, 2);
});
