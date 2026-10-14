import { test } from "node:test";
import assert from "node:assert/strict";
import { applyNarrativeProposal } from "../../src/features/activities/domain/apply-narrative-proposal.ts";
import { emptyActivityDraft } from "../../src/features/activities/domain/activity-draft.ts";

test("only empty fields are filled; typed ones are kept and reported", () => {
  const current = { ...emptyActivityDraft(), activityTitle: "My own title" };
  const { next, filled, kept } = applyNarrativeProposal(current, { activityTitle: "Proposed", location: "Kisumu", participantsFemale: 40 });
  assert.equal(next.activityTitle, "My own title");
  assert.equal(next.location, "Kisumu");
  assert.equal(next.participantsFemale, "40");
  assert.deepEqual(filled, ["location", "participantsFemale"]);
  assert.deepEqual(kept, ["activityTitle"]);
});

test("an empty proposal changes nothing", () => {
  const current = emptyActivityDraft();
  const out = applyNarrativeProposal(current, {});
  assert.deepEqual(out.filled, []);
  assert.deepEqual(out.next.summary, "");
});
