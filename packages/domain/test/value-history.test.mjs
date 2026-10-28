import assert from "node:assert/strict";
import test from "node:test";
import { describeValueHistory, VALUE_EVENT_WORDS } from "../dist/index.js";

const at = (d) => new Date(`2026-10-${d}T08:00:00Z`);
const ev = (eventType, day, extra = {}) => ({ eventType, actorId: "u", actorName: "Amina", at: at(day), ...extra });

test("a value's life reads newest first, in plain words, with the figure before and after", () => {
  const h = describeValueHistory([
    ev("logframe.indicator.updated", "01", { oldValue: "", newValue: "10" }),
    ev("logframe.indicator.updated", "03", { oldValue: "10", newValue: "12" }),
    ev("logframe.indicator.submitted", "04"),
    ev("logframe.indicator.correction_requested", "05"),
    ev("logframe.indicator.verified", "06"),
  ]);
  assert.deepEqual(h.map((e) => e.what), ["Verified", "Returned for changes", "Handed in for review", "Saved", "Saved"]);
  assert.deepEqual(h.map((e) => e.change), [undefined, undefined, undefined, "10 → 12", "empty → 10"]);
  assert.equal(h[0].by, "Amina");
  assert.ok(h[0].at > h[4].at);
});

test("events that do not describe a value are left out; an unchanged figure shows no change; a system step has no name", () => {
  const h = describeValueHistory([
    ev("logframe.indicator.moved", "01"),
    ev("evidence.verify", "02"),
    ev("logframe.indicator.updated", "03", { oldValue: "7", newValue: "7" }),
    { eventType: "logframe.indicator.updated", actorId: "sys", at: at("04"), oldValue: "7", newValue: "not applicable: Clinics closed" },
  ]);
  assert.equal(h.length, 2);
  assert.equal(h[0].by, "");
  assert.equal(h[0].change, "7 → not applicable: Clinics closed");
  assert.equal(h[1].change, undefined);
});

test("the list is capped, and every described event has words", () => {
  const many = Array.from({ length: 80 }, (_, i) => ev("logframe.indicator.updated", String((i % 27) + 1).padStart(2, "0"), { oldValue: String(i), newValue: String(i + 1) }));
  assert.equal(describeValueHistory(many).length, 50);
  assert.equal(describeValueHistory(many, 5).length, 5);
  assert.ok(Object.values(VALUE_EVENT_WORDS).every((w) => w.length > 3));
  assert.deepEqual(describeValueHistory([]), []);
});
