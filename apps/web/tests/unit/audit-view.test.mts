import { test } from "node:test";
import assert from "node:assert/strict";
import {
  redactSensitive,
  readableChange,
  filterAudit,
  paginate,
  type AuditRecord,
} from "../../src/features/audit/application/audit-view.ts";

function record(partial: Partial<AuditRecord>): AuditRecord {
  return {
    id: "a1",
    actorId: "user-1",
    eventType: "project.created",
    entityType: "project",
    entityId: "p1",
    createdAt: "2026-01-01T00:00:00Z",
    ...partial,
  };
}

test("redactSensitive masks emails and long tokens", () => {
  const out = redactSensitive("contact alice@example.org token abcdefghijklmnopqrstuvwxyz123456");
  assert.ok(!out.includes("alice@example.org"));
  assert.ok(!out.includes("abcdefghijklmnopqrstuvwxyz123456"));
  assert.ok(out.includes("***"));
});

test("readableChange combines old and new with redaction", () => {
  const out = readableChange(record({ oldValue: "alice@example.org", newValue: "new-role" }));
  assert.ok(out.startsWith("from "));
  assert.ok(out.includes("to new-role"));
  assert.ok(!out.includes("alice@example.org"));
});

test("readableChange returns no detail when no values", () => {
  assert.equal(readableChange(record({})), "no detail");
});

test("filterAudit filters by actor, event, entity, and date range", () => {
  const records = [
    record({ id: "1", actorId: "u1", eventType: "a.x", entityId: "e1", createdAt: "2026-01-01T00:00:00Z" }),
    record({ id: "2", actorId: "u2", eventType: "b.y", entityId: "e2", createdAt: "2026-02-01T00:00:00Z" }),
    record({ id: "3", actorId: "u1", eventType: "a.x", entityId: "e1", createdAt: "2026-03-01T00:00:00Z" }),
  ];
  assert.equal(filterAudit(records, { actorId: "u1" }).length, 2);
  assert.equal(filterAudit(records, { eventType: "b.y" }).length, 1);
  assert.equal(filterAudit(records, { entityId: "e2" }).length, 1);
  assert.equal(filterAudit(records, { dateFrom: "2026-02-01" }).length, 2);
  assert.equal(filterAudit(records, { dateTo: "2026-01-02" }).length, 1);
});

test("paginate slices by page", () => {
  const items = [1, 2, 3, 4, 5];
  assert.deepEqual(paginate(items, 1, 2), [1, 2]);
  assert.deepEqual(paginate(items, 3, 2), [5]);
  assert.deepEqual(paginate(items, 9, 2), []);
});
