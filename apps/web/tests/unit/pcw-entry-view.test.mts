// Phase 38.6: the Data entry slide's pure rules.
import test from "node:test";
import assert from "node:assert/strict";
import { METHODS, METHOD_LABEL, REVIEW_LABEL, REVIEW_MODES, formCount, methodRows, parseDays, participantActivities, windowPatch } from "../../src/features/project-setup/pcw/domain/entry-view.ts";
import { PCW_COPY } from "../../src/features/project-setup/pcw/copy.ts";
import { findRawTokens } from "@donordesk/domain/core/copy-lint.js";

const view = {
  indicators: [{ value: { code: "I1", title: "Trained" } }, { value: { code: "I2", title: null } }, { value: { code: null, title: "No code" } }],
  methodSuggestions: [{ id: "METHOD:I2:MANUAL", indicatorCode: "I2", method: "MANUAL", reason: "r" }],
  extras: { indicatorSetup: { I1: { method: "FORM" } }, planSetup: { a: { recordsParticipants: true }, b: { recordsParticipants: false }, c: { recordsParticipants: true } } },
} as never;

test("each coded indicator is a row with its method, and the open suggestion beside it", () => {
  const rows = methodRows(view);
  assert.deepEqual(rows.map((r) => [r.code, r.title, r.method, r.suggestion?.id ?? null]), [["I1", "Trained", "FORM", null], ["I2", "I2", "", "METHOD:I2:MANUAL"]]);
});

test("forms and participant registration are counted from the decisions", () => {
  assert.equal(formCount(view), 1);
  assert.equal(participantActivities(view), 2);
});

test("an entry window is whole days from 0 to 365, and half an answer saves nothing", () => {
  assert.equal(parseDays(" 10 "), 10);
  for (const bad of ["", "-1", "1.5", "366", "ten", "1000"]) assert.equal(parseDays(bad), null, bad);
  assert.deepEqual(windowPatch("10", "0"), { ok: true, windowRule: { opensDaysBefore: 10, closesDaysAfter: 0 } });
  assert.equal(windowPatch("10", "").ok, false);
});

test("the methods and modes all have words, and no evidence levels are offered (the product has no project default)", () => {
  assert.deepEqual([...METHODS].sort(), ["CALCULATED", "CONNECTOR", "FORM", "MANUAL"]);
  assert.deepEqual([...REVIEW_MODES].sort(), ["FULL", "SIMPLE"]);
});

test("the words on this slide are plain language", () => {
  const c = PCW_COPY.entry;
  const texts = [...Object.values(c).filter((v): v is string => typeof v === "string"), c.useAll(3), c.formsNote(0), c.formsNote(2), c.participants(0), c.participants(1), c.participants(3),
    ...Object.values(METHOD_LABEL), ...Object.values(REVIEW_LABEL)];
  for (const t of texts) assert.deepEqual(findRawTokens(t), [], t);
});
