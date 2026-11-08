import test from "node:test";
import assert from "node:assert/strict";
import { TenantId } from "@donordesk/domain";
import { CheckProjectCodeHandler } from "../dist/index.js";

const ctx = { tenant: { tenantId: TenantId.create("tenant-a"), userId: "u1", role: "ADMIN" }, requestId: "r" };
const repo = (codes, fail) => ({ asked: [], async findByCode(_t, code) { this.asked.push(code); return fail ? { ok: false, error: new Error("db") } : { ok: true, value: codes.includes(code) ? { id: "p" } : null }; } });

test("a blank code is free and the repository is not asked", async () => {
  const r = repo(["A-1"]);
  assert.deepEqual((await new CheckProjectCodeHandler(r).handle(ctx, "   ")).value, { available: true });
  assert.deepEqual(r.asked, []);
});

test("a code the workspace already holds is not available, a new one is, and the answer is only yes or no", async () => {
  const h = new CheckProjectCodeHandler(repo(["ZZT-WASH"]));
  const taken = await h.handle(ctx, " ZZT-WASH ");
  assert.deepEqual(taken.value, { available: false });
  assert.deepEqual((await h.handle(ctx, "ZZT-NEW")).value, { available: true });
});

test("a failed lookup is passed on, never turned into an answer", async () => {
  const r = await new CheckProjectCodeHandler(repo([], true)).handle(ctx, "X-1");
  assert.equal(r.ok, false);
});
