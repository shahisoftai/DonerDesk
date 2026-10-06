import assert from "node:assert/strict";
import test from "node:test";
import { ConfirmClaimMatchesIndicatorHandler } from "../dist/index.js";
import { TenantId } from "@donordesk/domain";

const ctx = { tenant: { tenantId: TenantId.create("tenant-a"), userId: "u", role: "PROJECT_MANAGER" }, requestId: "r" };
const ok = (value) => ({ ok: true, value });
const finding = { indicatorCode: "HL-1", status: "REPORTED", value: "2500", cumulativeValue: "7000", target: "8000", qualityFlags: [] };

function build(atoms) {
  const resolved = [];
  const h = new ConfirmClaimMatchesIndicatorHandler(
    { findById: async () => ok({ id: "c", sectionId: "s", numericAtoms: atoms }) },
    { findById: async () => ok({ reportDraftId: "d" }) },
    { findById: async () => ok({ reportingPeriodId: "per", projectId: "p" }) },
    { computeFindings: async () => ok([finding]) },
    { handle: async (_c, id, input) => (resolved.push({ id, ...input }), ok({ claimId: "c2" })) },
  );
  return { h, resolved };
}
const atom = (value, role = "ACHIEVEMENT", isPercent) => ({ value, role, isPercent });

test("a statement whose figures a verified indicator carries is accepted in one step, citing the indicator", async () => {
  const w = build([atom("7000"), atom("87.5", "PERCENT", true)]);
  const r = await w.h.handle(ctx, "c");
  assert.deepEqual(r.value, { claimId: "c2", indicators: ["HL-1"] });
  assert.equal(w.resolved[0].resolution, "ACCEPTED_WITH_LIMITATION");
  assert.equal(w.resolved[0].notes, "Confirmed against the verified indicator HL-1.");
});

test("an unexplained figure is refused with the reason and nothing is resolved", async () => {
  const w = build([atom("7000"), atom("91", "PERCENT", true)]);
  const r = await w.h.handle(ctx, "c");
  assert.equal(r.ok, false);
  assert.match(r.error.message, /not a verified indicator value/);
  assert.deepEqual(w.resolved, []);
});
