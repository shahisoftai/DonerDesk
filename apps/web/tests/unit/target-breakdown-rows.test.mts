import { test } from "node:test";
import assert from "node:assert/strict";
import { completeBreakdownRows } from "../../src/features/logframe/domain/target-breakdown-rows.ts";

test("only rows with a group and a target are sent; names and values are trimmed", () => {
  const rows = [
    { dimension: "SEX", category: " Women ", value: " 150 " },
    { dimension: "SEX", category: "Men", value: "" },
    { dimension: "AGE_GROUP", category: "", value: "40" },
    { dimension: "DISABILITY", category: "Persons with disability", value: "20" },
  ];
  assert.deepEqual(completeBreakdownRows(rows), [
    { dimension: "SEX", category: "Women", value: "150" },
    { dimension: "DISABILITY", category: "Persons with disability", value: "20" },
  ]);
  assert.deepEqual(completeBreakdownRows([]), []);
});
