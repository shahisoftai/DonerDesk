import assert from "node:assert/strict";
import test from "node:test";
import { CreateAllPeriodsHandler } from "../dist/index.js";
import { TenantId } from "@donordesk/domain";

const ctx = { tenant: { tenantId: TenantId.create("tenant-a"), userId: "u", role: "ADMIN" }, requestId: "r" };
const ok = (value) => ({ ok: true, value });

function handler(created) {
  return new CreateAllPeriodsHandler(
    { findById: async () => ok({ reportingFrequency: "MONTHLY", duration: { start: new Date("2027-01-01"), end: new Date("2027-06-30") } }) },
    { findByProject: async () => ok(null) },
    { findByProject: async () => ok([]) },
    { handle: async (_ctx, input) => { created.push(input.startDate); return ok({ id: `p${created.length}` }); } },
  );
}

test("a limit creates only the first planned periods; no limit creates the whole plan", async () => {
  const one = [];
  const a = await handler(one).handle(ctx, "p", { limit: 1 });
  assert.equal(a.value.created.length, 1);
  assert.equal(one.length, 1);
  const all = [];
  const b = await handler(all).handle(ctx, "p");
  assert.ok(b.value.created.length > 1);
});
