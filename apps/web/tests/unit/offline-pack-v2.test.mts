import test from "node:test";
import assert from "node:assert/strict";
import { packFromServer, packCanRecordNumbers, packCounts } from "../../src/features/offline/domain/offline-pack.ts";
import { OUTBOX_KIND_NAMES, isOutboxKind } from "../../src/features/offline/domain/outbox-kinds.ts";
import { RECORD_KINDS } from "../../src/features/record/domain/record-kinds.ts";

const base = { userId: "u", userName: "A", projectId: "p", projectName: "P", generatedAt: "2026-11-06T08:00:00.000Z", forms: [], places: [] };

test("a server answer with none of the v2 parts makes a v1 pack that cannot record numbers", () => {
  const pack = packFromServer(base);
  assert.equal(pack.version, 1);
  assert.equal("indicators" in pack, false);
  assert.equal(packCanRecordNumbers(pack), false);
});

test("a server answer with the v2 parts makes a v2 pack, and an empty list is still 'carried'", () => {
  const pack = packFromServer({ ...base, indicators: [], periods: [], plan: [] });
  assert.equal(pack.version, 2);
  assert.equal(packCanRecordNumbers(pack), true, "no indicators is a real answer, different from 'not on this phone'");
});

test("numbers need both the indicators and the periods", () => {
  assert.equal(packCanRecordNumbers({ indicators: [], periods: undefined }), false);
  assert.equal(packCanRecordNumbers({ indicators: undefined, periods: [] }), false);
});

test("counts are numbers only, and a missing part counts as none", () => {
  const pack = packFromServer({ ...base, forms: [{ id: "f", name: "F", fields: [] }], places: [{ id: "x", name: "X", path: "X" }], indicators: [{ id: "i", code: "A", name: "A", type: "NUMBER", disaggregationRequired: false }] });
  assert.deepEqual(packCounts(pack), { forms: 1, places: 1, indicators: 1, plan: 0 });
});

test("the generated time is read as a number, and a bad one is zero rather than NaN", () => {
  assert.equal(packFromServer(base).generatedAt, Date.parse("2026-11-06T08:00:00.000Z"));
  assert.equal(packFromServer({ ...base, generatedAt: "not a date" }).generatedAt, 0);
});

test("every record kind that names an outbox kind names one that exists", () => {
  for (const kind of RECORD_KINDS) if (kind.outboxKind !== null) assert.ok(isOutboxKind(kind.outboxKind), `${kind.key} -> ${kind.outboxKind}`);
  assert.equal(new Set(OUTBOX_KIND_NAMES).size, OUTBOX_KIND_NAMES.length);
});
