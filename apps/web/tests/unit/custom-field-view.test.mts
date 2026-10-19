import { test } from "node:test";
import assert from "node:assert/strict";
import { fieldDraft, fieldPayload, parseChoiceLines } from "../../src/features/workplan/domain/custom-field-view.ts";

const fields = [
  { id: "f1", type: "TEXT" as const, choices: [] },
  { id: "f2", type: "NUMBER" as const, choices: [] },
];

test("a blank field is sent as null, never 0 or an empty string", () => {
  assert.deepEqual(fieldPayload(fields, { f1: "  ", f2: " 12 " }), [{ fieldId: "f1", value: null }, { fieldId: "f2", value: "12" }]);
  assert.deepEqual(fieldDraft(fields, { f1: "X1" }), { f1: "X1", f2: "" });
});

test("choices are read one per line, blank lines dropped", () => {
  assert.deepEqual(parseChoiceLines(" Pilot \n\n Scale up \n"), ["Pilot", "Scale up"]);
});
