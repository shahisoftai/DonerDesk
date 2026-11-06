import test from "node:test";
import assert from "node:assert/strict";
import { TenantId } from "@donordesk/domain";
import { GetSubmissionMappingHandler, SaveSubmissionMappingHandler, ImportSubmissionsHandler } from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ctxFor = (userId, role) => ({ tenant: { tenantId, userId, role }, requestId: "r" });
const PM = ctxFor("pm", "PROJECT_MANAGER");
const FIELD = ctxFor("fo", "FIELD_OFFICER");
const ok = (value) => ({ ok: true, value });

function world() {
  const saved = new Map();
  const rows = [];
  const audit = [];
  let n = 0;
  const mappings = {
    find: async (p) => ok(saved.get(p) ?? null),
    save: async (p, m) => (saved.set(p, m), ok(undefined)),
  };
  const repo = { add: async () => ok(undefined), addMany: async (list) => (rows.push(...list), ok(undefined)), findByProject: async () => ok(rows) };
  const context = { activeMemberIds: async () => ok(new Set(["pm", "fo"])) };
  const ids = { generate: () => `b${++n}` };
  const clock = { now: () => new Date("2026-10-19T09:00:00Z") };
  const auditLogger = { record: async (e) => void audit.push(e) };
  return {
    saved, rows, audit,
    get: new GetSubmissionMappingHandler(mappings),
    save: new SaveSubmissionMappingHandler(mappings, auditLogger, clock),
    importer: new ImportSubmissionsHandler(repo, context, ids, auditLogger, clock, mappings),
  };
}

const mapping = { case_code: "Form/Case ID", sex: "Gender", age_group: "Age band", location: "Ward", date: "Visit date", consent: "Agreed" };
const csv = ["Form/Case ID,Gender,Age band,Ward,Visit date,Agreed", "NG-7,F,under 5,Ward 3,2026-10-14,yes"].join("\n");

test("only a manager saves a mapping; a mapping missing a required field is refused and nothing is stored", async () => {
  const w = world();
  assert.equal((await w.save.handle(FIELD, "p", mapping)).error.code, "FORBIDDEN");
  const { case_code: _c, ...incomplete } = mapping;
  assert.equal((await w.save.handle(PM, "p", incomplete)).ok, false);
  assert.equal(w.saved.size, 0);
  assert.equal((await w.save.handle(PM, "p", mapping)).ok, true);
  assert.equal(w.audit.filter((e) => e.eventType === "beneficiary.mapping_saved").length, 1);
});

test("an import uses the project's saved mapping, so a file with other column names is read", async () => {
  const w = world();
  await w.save.handle(PM, "p", mapping);
  assert.deepEqual((await w.get.handle(FIELD, "p")).value, { mapping });
  const res = await w.importer.handle(FIELD, "p", csv);
  assert.equal(res.ok, true, res.error?.message);
  assert.equal(w.rows[0].caseCode, "NG-7");
});

test("without a saved mapping, matching headers still import; a file with unusable headers names what is missing", async () => {
  const w = world();
  const plain = ["case_code,sex,age_group,date,consent", "NG-8,male,18 to 59,2026-10-14,yes"].join("\n");
  assert.equal((await w.importer.handle(FIELD, "p", plain)).ok, true);
  const bad = await w.importer.handle(FIELD, "q", "name,age\nA,4");
  assert.equal(bad.ok, false);
});
