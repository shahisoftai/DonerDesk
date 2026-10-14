import assert from "node:assert/strict";
import test from "node:test";
import { ImportActivitiesHandler } from "../dist/index.js";
import { TenantId } from "@donordesk/domain";

const ctx = { tenant: { tenantId: TenantId.create("tenant-a"), userId: "u", role: "ADMIN" }, requestId: "r" };
const ok = (value) => ({ ok: true, value });
const period = (id, start, end) => ({ id, duration: { start: new Date(start), end: new Date(end) } });

function setup(periods) {
  const rows = [];
  let n = 0;
  const handler = new ImportActivitiesHandler(
    { generate: () => `a${++n}` },
    { async create(a) { rows.push(a); return ok(a); }, async findByProject() { return ok([]); } },
    { async findByProject() { return ok([]); } },
    { async findByProject() { return ok([]); } },
    { async findByProject() { return ok(periods); } },
    { async record() {} },
  );
  return { handler, rows };
}

const csv = [
  "Activity Title,Activity Date,Summary",
  "Jan clinic,2027-01-12,Held clinics",
  "Feb clinic,2027-02-09,Held clinics",
  "March clinic,2027-03-02,Held clinics",
].join("\n");

const periods = [period("jan", "2027-01-01", "2027-01-31"), period("feb", "2027-02-01", "2027-02-28")];

test("each row is placed in the period that contains its own date", async () => {
  const { handler, rows } = setup(periods);
  const out = await handler.handle(ctx, { projectId: "p", text: csv, reportingPeriodId: "feb" });
  assert.equal(out.ok, true);
  assert.deepEqual(rows.map((r) => [r.activityTitle, r.reportingPeriodId]), [["Jan clinic", "jan"], ["Feb clinic", "feb"], ["March clinic", "feb"]]);
});

test("a date in no period uses the fallback period when given, otherwise the row is skipped with a reason", async () => {
  const { handler, rows } = setup(periods);
  const out = await handler.handle(ctx, { projectId: "p", text: csv });
  assert.equal(out.ok, true);
  assert.equal(out.value.created, 2);
  assert.equal(out.value.skipped, 1);
  assert.equal(rows.length, 2);
  assert.match(out.value.warnings.join(" "), /March clinic.*2027-03-02/);
});

test("the template's 'Logframe Code (Output or Activity)' column links a planned activity and its output", async () => {
  const rows = [];
  const nodes = [
    { id: "out1", code: "1.1", level: "OUTPUT", title: "Water points" },
    { id: "act1", code: "A1.1", level: "ACTIVITY", parentId: "out1", title: "Drill" },
  ];
  const handler = new ImportActivitiesHandler(
    { generate: () => "a1" },
    { async create(a) { rows.push(a); return ok(a); }, async findByProject() { return ok([]); } },
    { async findByProject() { return ok(nodes); } },
    { async findByProject() { return ok([]); } },
    { async findByProject() { return ok(periods); } },
    { async record() {} },
  );
  const text = ["Activity Title,Activity Date,Logframe Code (Output or Activity),Summary", "Drilled,2027-01-12,A1.1,Two boreholes"].join("\n");
  const out = await handler.handle(ctx, { projectId: "p", text });
  assert.equal(out.ok, true);
  assert.equal(rows[0].logframeActivityId, "act1");
  assert.equal(rows[0].outputId, "out1");
  assert.deepEqual(out.value.warnings, []);
});

test("rows with no logframe code are reported in one sentence, not silently left unlinked", async () => {
  const { handler } = setup(periods);
  const out = await handler.handle(ctx, { projectId: "p", text: csv, reportingPeriodId: "feb" });
  assert.match(out.value.warnings.join(" "), /3 records have no logframe code, so they are not linked/);
});
