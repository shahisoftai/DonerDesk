import assert from "node:assert/strict";
import test from "node:test";
import { LogframeItem, TenantId } from "@donordesk/domain";
import { ImportIndicatorsHandler } from "../dist/index.js";

const ctx = { tenant: { tenantId: TenantId.create("tenant-a"), userId: "u-1", role: "ADMIN" }, requestId: "r" };
const item = (id, code) => LogframeItem.create({ id, tenantId: "tenant-a", projectId: "p-1", level: "OUTPUT", code, title: `Output ${code}` });

function setup(existing = []) {
  const created = [];
  let n = 0;
  const handler = new ImportIndicatorsHandler(
    { generate: () => `ind-${++n}` },
    { findByProject: async () => ({ ok: true, value: [item("item-1", "O1"), item("item-2", "O2.2")] }) },
    { findByProject: async (_p, _t, options) => ({ ok: true, value: options?.includeArchived ? existing : [] }), create: async (i) => { created.push(i); return { ok: true, value: i }; } },
    { record: async () => {} },
  );
  return { handler, created };
}
const text = (rows) => `Code,Logframe code,Name,Type\n${rows.join("\n")}\n`;

test("two indicators can be imported under one logframe item", async () => {
  const { handler, created } = setup();
  const r = await handler.handle(ctx, { projectId: "p-1", text: text(["IND1,O2.2,People with safe water,NUMBER", "IND2,O2.2,Water points,NUMBER"]) });
  assert.equal(r.ok, true);
  assert.equal(r.value.created, 2);
  assert.deepEqual(created.map((i) => [i.code, i.logframeItemId]), [["IND1", "item-2"], ["IND2", "item-2"]]);
});

test("without the column the code still names the item (existing files keep working)", async () => {
  const { handler, created } = setup();
  const r = await handler.handle(ctx, { projectId: "p-1", text: "Code,Name,Type\nO1,People reached,NUMBER\n" });
  assert.equal(r.value.created, 1);
  assert.equal(created[0].logframeItemId, "item-1");
});

test("an unknown logframe code is skipped with a warning naming it", async () => {
  const { handler, created } = setup();
  const r = await handler.handle(ctx, { projectId: "p-1", text: text(["IND1,NOPE,People,NUMBER"]) });
  assert.equal(r.value.created, 0);
  assert.equal(r.value.skipped, 1);
  assert.match(r.value.warnings.join(" "), /NOPE/);
  assert.equal(created.length, 0);
});

test("a code already used by an archived indicator is not imported again", async () => {
  const { handler, created } = setup([{ code: "IND1" }]);
  const r = await handler.handle(ctx, { projectId: "p-1", text: text(["IND1,O2.2,People,NUMBER"]) });
  assert.equal(r.value.created, 0);
  assert.equal(created.length, 0);
});
