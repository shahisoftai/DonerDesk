import { test } from "node:test";
import assert from "node:assert/strict";
import { validateParticipantBreakdown } from "../../src/lib/shared/participants.ts";

test("valid breakdown has no errors", () => {
  const errors = validateParticipantBreakdown({
    participantsTotal: 100,
    participantsMale: 40,
    participantsFemale: 60,
  });
  assert.deepEqual(errors, {});
});

test("male+female exceeding total produces field errors", () => {
  const errors = validateParticipantBreakdown({
    participantsTotal: 50,
    participantsMale: 40,
    participantsFemale: 40,
  });
  assert.ok(errors.participantsMale);
  assert.ok(errors.participantsFemale);
});

test("child count exceeding total produces an error", () => {
  const errors = validateParticipantBreakdown({
    participantsTotal: 30,
    participantsChildren: 35,
  });
  assert.ok(errors.participantsChildren);
});

test("negative total is rejected", () => {
  const errors = validateParticipantBreakdown({ participantsTotal: -1 });
  assert.ok(errors.participantsTotal);
});

test("negative disaggregation values are rejected", () => {
  const errors = validateParticipantBreakdown({ participantsFemale: -2 });
  assert.ok(errors.participantsFemale);
});

test("empty and null fields are valid", () => {
  assert.deepEqual(validateParticipantBreakdown({}), {});
  assert.deepEqual(validateParticipantBreakdown({ participantsTotal: null, participantsMale: null }), {});
});
