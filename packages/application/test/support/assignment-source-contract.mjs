// The contract every IAssignmentSource keeps, whatever it reads from. Run against the in-memory fakes in the application tests
// and against the Prisma sources in the infrastructure tests, so a source cannot quietly mean "due" or "late" differently.
import assert from "node:assert/strict";
import { ASSIGNMENT_KINDS, isPlainDate } from "@donordesk/domain";

/**
 * `make()` returns { source, query: { tenantId, today, assigneeId }, expectAtLeast } for a world that contains something for
 * the person; `makeOther()` (optional) a world whose tenant differs, to prove nothing leaks across tenants.
 */
export function assignmentSourceContract(test, name, { make, makeEmpty }) {
  test(`${name}: every item has the one assignment shape`, async () => {
    const { source, query, expectAtLeast = 1 } = await make();
    const out = await source.list(query);
    assert.equal(out.ok, true, out.error?.message);
    assert.ok(out.value.length >= expectAtLeast, `expected at least ${expectAtLeast} item(s)`);
    for (const a of out.value) {
      assert.equal(a.kind, source.kind, "kind is the source's");
      assert.ok(a.key.startsWith(`${source.kind}:`), `key ${a.key} starts with the kind`);
      assert.ok(a.projectId && a.projectTitle && a.title && a.assigneeId, "ids and words are present");
      assert.ok(a.dueDate === undefined || isPlainDate(a.dueDate), `dueDate ${a.dueDate} is a plain day`);
      assert.ok(a.state === "OPEN" || a.state === "LATE", `state ${a.state}`);
      assert.ok(a.href.startsWith("/projects/"), `href ${a.href} is an app path`);
      assert.ok(Number.isFinite(a.urgency), "urgency is a number");
      assert.equal(typeof a.urgent, "boolean");
      assert.equal(Boolean(a.because), ASSIGNMENT_KINDS[a.kind].becauseOfRole, "only role-based items explain themselves");
      assert.equal(a.assigneeId, query.assigneeId, "a personal query returns that person's items");
    }
  });

  test(`${name}: a past due date is always late; keys are stable and unique`, async () => {
    const { source, query } = await make();
    const first = await source.list(query);
    const again = await source.list(query);
    assert.deepEqual(first.value.map((a) => a.key), again.value.map((a) => a.key));
    assert.equal(new Set(first.value.map((a) => a.key)).size, first.value.length, "no duplicate key inside one source");
    for (const a of first.value) if (a.dueDate && a.dueDate < query.today) assert.equal(a.state, "LATE", `${a.key} is past due`);
  });

  test(`${name}: a person with nothing gets an empty list, not an error`, async () => {
    const { source, query } = await makeEmpty();
    const out = await source.list(query);
    assert.equal(out.ok, true);
    assert.deepEqual(out.value, []);
  });

  test(`${name}: a team query (no person) never returns another kind's or a role-based item`, async () => {
    const { source, query } = await make();
    const out = await source.list({ ...query, assigneeId: undefined });
    assert.equal(out.ok, true);
    for (const a of out.value) assert.equal(a.kind, source.kind);
    if (ASSIGNMENT_KINDS[source.kind].becauseOfRole) assert.deepEqual(out.value, [], "role-based items belong to nobody by name");
  });
}
