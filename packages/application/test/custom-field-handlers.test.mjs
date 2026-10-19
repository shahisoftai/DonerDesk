import test from "node:test";
import assert from "node:assert/strict";
import { TenantId, PlannedActivity } from "@donordesk/domain";
import { DefineProjectFieldHandler, ListProjectFieldsHandler, GetPlanItemFieldsHandler, SetPlanItemFieldsHandler, PlanAccess } from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ctxFor = (userId, role) => ({ tenant: { tenantId, userId, role }, requestId: "r" });
const PM = ctxFor("pm", "PROJECT_MANAGER");
const LEAD = ctxFor("fo", "FIELD_OFFICER");
const OTHER = ctxFor("me", "VIEWER");
const ok = (value) => ({ ok: true, value });

function world() {
  const items = new Map();
  const fields = [];
  const values = new Map();
  const audit = [];
  let n = 0;
  const ids = { generate: () => `id${++n}` };
  const clock = { now: () => new Date("2026-03-01T09:00:00Z") };
  const itemRepo = {
    findById: async (id) => ok(items.get(id) ?? null),
    findByProject: async (p) => ok([...items.values()].filter((i) => i.projectId === p)),
  };
  const fieldRepo = {
    create: async (f) => {
      if (fields.some((x) => x.projectId === f.projectId && x.key === f.key)) return { ok: false, error: { code: "CONFLICT", message: "dup" } };
      fields.push(f);
      return ok(undefined);
    },
    findByProject: async (p) => ok(fields.filter((f) => f.projectId === p)),
  };
  const valueRepo = {
    setValues: async (entity, list) => {
      for (const v of list) {
        const key = `${v.fieldId}:${entity.entityId}`;
        if (v.value === null) values.delete(key);
        else values.set(key, v.value);
      }
      return ok(undefined);
    },
    findByEntity: async (entityId) => ok(Object.fromEntries([...values].filter(([k]) => k.endsWith(`:${entityId}`)).map(([k, v]) => [k.split(":")[0], v]))),
  };
  const auditLogger = { record: async (e) => void audit.push(e) };
  const access = new PlanAccess(itemRepo);
  const item = PlannedActivity.create({ id: "item1", tenantId: "tenant-a", projectId: "p", title: "Survey", plannedStart: "2026-03-10", plannedEnd: "2026-03-12", people: { ownerUserId: "fo", supportUserIds: [] }, createdById: "pm" }).value;
  items.set("item1", item);
  const other = PlannedActivity.create({ id: "item2", tenantId: "tenant-a", projectId: "q", title: "Elsewhere", plannedStart: "2026-03-10", plannedEnd: "2026-03-12", createdById: "pm" }).value;
  items.set("item2", other);
  return {
    fields, values, audit,
    define: new DefineProjectFieldHandler(fieldRepo, ids, auditLogger, clock),
    list: new ListProjectFieldsHandler(fieldRepo),
    get: new GetPlanItemFieldsHandler(access, fieldRepo, valueRepo),
    set: new SetPlanItemFieldsHandler(access, fieldRepo, valueRepo, auditLogger, clock),
  };
}

test("only a manager defines a field; the key is unique per project and the definition is audited", async () => {
  const w = world();
  assert.equal((await w.define.handle(LEAD, "p", { label: "Donor code", type: "TEXT" })).error.code, "FORBIDDEN");
  assert.equal((await w.define.handle(PM, "p", { label: "Donor code", type: "TEXT" })).ok, true);
  assert.equal((await w.define.handle(PM, "p", { label: "donor CODE", type: "NUMBER" })).ok, false, "same key");
  assert.equal((await w.define.handle(PM, "q", { label: "Donor code", type: "TEXT" })).ok, true, "a different project may use the name");
  assert.equal(w.audit.filter((e) => e.eventType === "workplan.field_defined").length, 2);
  assert.equal((await w.list.handle(PM, "p")).value.length, 1);
});

test("the lead fills the fields; a blank value clears the stored one; a bad value saves nothing", async () => {
  const w = world();
  const [code, count] = [(await w.define.handle(PM, "p", { label: "Donor code", type: "TEXT" })).value.id, (await w.define.handle(PM, "p", { label: "Children", type: "NUMBER" })).value.id];
  assert.equal((await w.set.handle(OTHER, "item1", { values: [{ fieldId: code, value: "X1" }] })).ok, false, "a stranger cannot fill it");
  assert.equal((await w.set.handle(LEAD, "item1", { values: [{ fieldId: code, value: "X1" }, { fieldId: count, value: "12" }] })).ok, true);
  assert.deepEqual((await w.get.handle(LEAD, "item1")).value.values, { [code]: "X1", [count]: "12" });

  assert.equal((await w.set.handle(LEAD, "item1", { values: [{ fieldId: code, value: "  " }] })).ok, true);
  assert.equal((await w.get.handle(LEAD, "item1")).value.values[code], undefined, "blank removes it; nothing reads as 0");

  const refused = await w.set.handle(LEAD, "item1", { values: [{ fieldId: code, value: "Changed" }, { fieldId: count, value: "lots" }] });
  assert.equal(refused.ok, false);
  assert.equal((await w.get.handle(LEAD, "item1")).value.values[code], undefined, "the valid change in the same save was not kept");
});

test("an unknown field is refused, and the fields shown are the item's own project's", async () => {
  const w = world();
  assert.equal((await w.set.handle(LEAD, "item1", { values: [{ fieldId: "nope", value: "1" }] })).error.code, "NOT_FOUND");
  await w.define.handle(PM, "q", { label: "Other project only", type: "TEXT" });
  const got = await w.get.handle(LEAD, "item1");
  assert.deepEqual(got.value.fields, []);
  assert.equal(w.audit.filter((e) => e.eventType === "workplan.fields_set").length, 0, "a refused save is not audited");
});
