import { test } from "node:test";
import assert from "node:assert/strict";
import { DataSheetResponseSchema } from "../../src/lib/server/schemas.ts";

const indicator = { id: "i1", code: "OP1-3", name: "Stock-out days", level: "OUTPUT", type: "NUMBER", baseline: "4", target: "2", isRate: false };

test("the data sheet keeps the lower-is-better flag the server sends (the page must not read a share of target without it)", () => {
  const parsed = DataSheetResponseSchema.parse({ projectId: "p1", financeEnabled: false, periods: [], indicators: [{ ...indicator, lowerIsBetter: true }], cells: [], finance: [] });
  assert.equal(parsed.indicators[0]?.lowerIsBetter, true);
});

test("an indicator without the flag parses as before", () => {
  const parsed = DataSheetResponseSchema.parse({ projectId: "p1", financeEnabled: false, periods: [], indicators: [indicator], cells: [], finance: [] });
  assert.equal(parsed.indicators[0]?.lowerIsBetter, undefined);
});
