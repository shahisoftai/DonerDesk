import test from "node:test";
import assert from "node:assert/strict";
import { ActivityUpdate, ACTIVITY_STATUSES, ACTIVITY_TRANSITIONS, canApplyActivityAction, isOpenActivity, splitReviewerNotes } from "../dist/index.js";

function activity(status) {
  return ActivityUpdate.rehydrate({
    id: "a1", tenantId: "t", projectId: "p", createdAt: new Date(),
    props: { reportingPeriodId: "rp", activityTitle: "T", activityDate: new Date("2026-03-06"), summary: "Held the session.", achievements: "", challenges: "", lessonsLearned: "", nextSteps: "", attachedEvidenceIds: [], status, submittedById: "u" },
  });
}

// Pins the behaviour before WITHDRAWN existed: these are the cells that were allowed.
const ALLOWED = {
  SUBMIT: ["DRAFT", "SUBMITTED", "NEEDS_REVISION", "REJECTED"],
  ACCEPT: ["SUBMITTED"],
  REQUEST_REVISION: ["DRAFT", "SUBMITTED", "NEEDS_REVISION", "ACCEPTED", "REJECTED"],
  REJECT: ["DRAFT", "SUBMITTED", "NEEDS_REVISION", "ACCEPTED", "REJECTED"],
  EDIT: ["DRAFT", "SUBMITTED", "NEEDS_REVISION", "REJECTED"],
  WITHDRAW: ["DRAFT", "SUBMITTED", "NEEDS_REVISION", "REJECTED"],
  RESTORE: ["WITHDRAWN"],
};

test("every status x action cell is as declared (and nothing is allowed from a withdrawn record except restore)", () => {
  for (const [action, allowed] of Object.entries(ALLOWED)) {
    for (const status of ACTIVITY_STATUSES) {
      assert.equal(canApplyActivityAction(status, action), allowed.includes(status), `${action} from ${status}`);
    }
  }
  assert.deepEqual(Object.keys(ACTIVITY_TRANSITIONS).sort(), Object.keys(ALLOWED).sort());
});

test("the aggregate enforces the table", () => {
  assert.throws(() => activity("ACCEPTED").submit(), /cannot be submitted/);
  assert.throws(() => activity("WITHDRAWN").submit());
  assert.throws(() => activity("DRAFT").accept(), /Only submitted activities can be accepted/);
  assert.throws(() => activity("WITHDRAWN").requestRevision("x"));
  assert.throws(() => activity("ACCEPTED").edit({ summary: "y" }), /accepted/);
  assert.throws(() => activity("WITHDRAWN").edit({ summary: "y" }), /withdrawn/);
  const a = activity("SUBMITTED");
  a.accept();
  assert.equal(a.status, "ACCEPTED");
});

test("withdraw keeps who replaced it, restore sends it back to review", () => {
  const a = activity("NEEDS_REVISION");
  a.withdraw("a2");
  assert.equal(a.status, "WITHDRAWN");
  assert.equal(a.supersededById, "a2");
  a.restore();
  assert.equal(a.status, "SUBMITTED");
  assert.equal(a.supersededById, undefined);
  assert.throws(() => activity("ACCEPTED").withdraw());
});

test("a revision request adds the note; resubmit removes it from the text and returns the record to review", () => {
  const a = activity("SUBMITTED");
  a.requestRevision("Please add the village name.");
  assert.equal(a.status, "NEEDS_REVISION");
  assert.match(a.summary, /\[Reviewer note\]: Please add the village name\./);
  a.resubmit();
  assert.equal(a.status, "SUBMITTED");
  assert.equal(a.summary, "Held the session.");
  assert.throws(() => activity("SUBMITTED").resubmit(), /sent back for revision/);
});

test("reviewer notes are separated from the text, several in order", () => {
  const out = splitReviewerNotes("Held the session.\n\n[Reviewer note]: Add the village.\n\n[Rejected]: Duplicate.");
  assert.equal(out.summary, "Held the session.");
  assert.deepEqual(out.notes, ["Add the village.", "Duplicate."]);
  assert.deepEqual(splitReviewerNotes("Plain."), { summary: "Plain.", notes: [] });
});

test("open records are those not yet accepted or withdrawn", () => {
  assert.deepEqual(ACTIVITY_STATUSES.filter(isOpenActivity), ["DRAFT", "SUBMITTED", "NEEDS_REVISION", "REJECTED"]);
});
