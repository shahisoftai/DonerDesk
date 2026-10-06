import test from "node:test";
import assert from "node:assert/strict";
import { VERIFICATION_REASON_CODES, VERIFICATION_REASON_PLAIN, plainVerificationReason, CHECKLIST_ITEM_TYPES, checklistTemplateForReportType } from "../dist/index.js";

const RAW_CODE = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/;

test("every reason code has plain words, and none of them contains a raw code", () => {
  assert.deepEqual(Object.keys(VERIFICATION_REASON_PLAIN).sort(), [...VERIFICATION_REASON_CODES].sort());
  for (const code of VERIFICATION_REASON_CODES) {
    assert.doesNotMatch(plainVerificationReason(code), RAW_CODE, code);
    assert.ok(plainVerificationReason(code).length > 5, code);
  }
});

test("an unknown or missing code never leaks as a raw value", () => {
  for (const code of [undefined, null, "", "SOMETHING_NEW"]) {
    const text = plainVerificationReason(code);
    assert.doesNotMatch(text, RAW_CODE);
    assert.match(text, /checked/);
  }
});

test("checklist template titles and descriptions carry no raw codes", () => {
  for (const type of ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL", "FINAL", "ACTIVITY", "SITUATION", "CUSTOM"]) {
    for (const item of checklistTemplateForReportType(type).items) {
      assert.doesNotMatch(`${item.title} ${item.description}`, RAW_CODE, `${type}: ${item.title}`);
      assert.ok(CHECKLIST_ITEM_TYPES.includes(item.type));
    }
  }
});
