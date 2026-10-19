import test from "node:test";
import assert from "node:assert/strict";
import { checkEntryDueDays, DEFAULT_ENTRY_DUE_DAYS, MAX_ENTRY_DUE_DAYS } from "../dist/index.js";

test("due days are a whole number from 0 to 60; anything else is refused with the range", () => {
  assert.deepEqual(checkEntryDueDays(0), { ok: true, value: 0 });
  assert.deepEqual(checkEntryDueDays(DEFAULT_ENTRY_DUE_DAYS), { ok: true, value: 5 });
  assert.deepEqual(checkEntryDueDays(MAX_ENTRY_DUE_DAYS), { ok: true, value: 60 });
  for (const bad of [-1, 61, 2.5, "5", null, undefined, NaN]) {
    const res = checkEntryDueDays(bad);
    assert.equal(res.ok, false, `${String(bad)} is refused`);
    assert.match(res.error.message, /0 to 60/);
  }
});
