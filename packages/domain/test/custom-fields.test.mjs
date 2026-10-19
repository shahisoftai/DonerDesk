import test from "node:test";
import assert from "node:assert/strict";
import { customFieldKey, defineCustomField, checkCustomFieldValue, MAX_CUSTOM_FIELDS } from "../dist/index.js";

const field = (type, extra = {}) => ({ key: "k", label: "Donor code", type, choices: [], ...extra });

test("a field's key comes from its name, and a second field with the same key is refused", () => {
  assert.equal(customFieldKey("  Donor code (2026) "), "donor_code_2026");
  const made = defineCustomField({ label: "Donor code", type: "TEXT" }, []);
  assert.deepEqual(made.value, { key: "donor_code", label: "Donor code", type: "TEXT", choices: [] });
  assert.equal(defineCustomField({ label: "donor CODE", type: "TEXT" }, [{ key: "donor_code" }]).ok, false);
  assert.equal(defineCustomField({ label: "!!!", type: "TEXT" }, []).ok, false, "no usable characters");
  assert.equal(defineCustomField({ label: "   ", type: "TEXT" }, []).ok, false);
});

test("a choice field needs two different choices; other types take none", () => {
  assert.equal(defineCustomField({ label: "Phase", type: "CHOICE", choices: ["One"] }, []).ok, false);
  assert.equal(defineCustomField({ label: "Phase", type: "CHOICE", choices: ["One", "one "] }, []).ok, true, "trimmed, not case-folded");
  assert.equal(defineCustomField({ label: "Phase", type: "CHOICE", choices: ["A", "A"] }, []).ok, false);
  assert.equal(defineCustomField({ label: "Note", type: "TEXT", choices: ["x", "y"] }, []).ok, false);
});

test("a project holds a limited number of fields", () => {
  const full = Array.from({ length: MAX_CUSTOM_FIELDS }, (_, i) => ({ key: `f${i}` }));
  assert.equal(defineCustomField({ label: "One more", type: "NUMBER" }, full).ok, false);
});

test("blank stays blank: no value is stored as null, never 0 or an empty string", () => {
  assert.deepEqual(checkCustomFieldValue(field("NUMBER"), ""), { ok: true, value: null });
  assert.deepEqual(checkCustomFieldValue(field("TEXT"), "   "), { ok: true, value: null });
  assert.deepEqual(checkCustomFieldValue(field("NUMBER"), undefined), { ok: true, value: null });
});

test("numbers, dates and choices are checked; a number is written plainly", () => {
  assert.deepEqual(checkCustomFieldValue(field("NUMBER"), " 007.50 "), { ok: true, value: "7.5" });
  assert.equal(checkCustomFieldValue(field("NUMBER"), "twelve").ok, false);
  assert.equal(checkCustomFieldValue(field("DATE"), "2026-02-30").ok, false, "not a real day");
  assert.deepEqual(checkCustomFieldValue(field("DATE"), "2026-11-04"), { ok: true, value: "2026-11-04" });
  const phase = field("CHOICE", { choices: ["Pilot", "Scale up"] });
  assert.deepEqual(checkCustomFieldValue(phase, "Pilot"), { ok: true, value: "Pilot" });
  assert.equal(checkCustomFieldValue(phase, "Other").ok, false);
  assert.equal(checkCustomFieldValue(field("TEXT"), "x".repeat(501)).ok, false);
});
