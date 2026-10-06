import { test } from "node:test";
import assert from "node:assert/strict";
import { findRawTokens } from "@donordesk/domain/core/copy-lint.js";
import * as labels from "../../src/lib/labels.ts";
import { fallbackReasonCopy, verificationReasonCopy, verificationResultCopy, flagClassCopy } from "../../src/lib/reporting-copy.ts";

/**
 * 25.7 — no raw code, id or snake_case key in any string a person reads. Every `*_LABEL` / `*_HINT` table in labels.ts
 * and every reporting-copy function is scanned, so a new entry that leaks a code fails here.
 */

function entries(): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const [name, value] of Object.entries(labels)) {
    if (!/_(LABEL|HINT)$/.test(name) || value === null || typeof value !== "object") continue;
    for (const [key, text] of Object.entries(value as Record<string, unknown>)) if (typeof text === "string") out.push([`${name}.${key}`, text]);
  }
  return out;
}

test("every label and hint table is free of raw codes, ids and snake_case", () => {
  const all = entries();
  assert.ok(all.length > 100, `only ${all.length} label strings were scanned`);
  const leaks = all.filter(([, text]) => findRawTokens(text).length > 0).map(([where, text]) => `${where}: ${text}`);
  assert.deepEqual(leaks, []);
});

test("the reporting copy functions never echo a code", () => {
  const reasons = ["AI_REPORTER_DISABLED", "PROVIDER_NOT_CONFIGURED", "PROVIDER_TIMEOUT", "PROVIDER_EMPTY_RESPONSE", "PROVIDER_MALFORMED_RESPONSE", "PROVIDER_HTTP_ERROR", "PII_REJECTED", "VALIDATOR_FAILED", "SOMETHING_NEW_AND_UNKNOWN"];
  for (const reason of reasons) assert.deepEqual(findRawTokens(fallbackReasonCopy(reason)), [], reason);
  for (const code of ["MISSING_QA", "UNGROUNDED_NUMBER", "UNKNOWN_CODE"]) assert.deepEqual(findRawTokens(verificationReasonCopy(code)), [], code);
  for (const result of ["PASSED", "FAILED", "ACCEPTED_WITH_LIMITATION", "EXCLUDED", "WHATEVER_ELSE"]) assert.deepEqual(findRawTokens(verificationResultCopy(result)), [], result);
  for (const flagClass of ["REPORT_ERROR", "NEEDS_DECISION", "UNCONFIRMED", undefined]) {
    const copy = flagClassCopy(flagClass);
    assert.deepEqual(findRawTokens(`${copy.title} ${copy.hint}`), [], String(flagClass));
  }
});
