import test from "node:test";
import assert from "node:assert/strict";
import { parseIndicatorText } from "../dist/index.js";

test("without a Logframe code column a row has none (the indicator's code names the item, as before)", () => {
  const r = parseIndicatorText("Code,Name,Type\nO1,People reached,NUMBER\n");
  assert.equal(r.rows[0].code, "O1");
  assert.equal(r.rows[0].logframeCode, undefined);
});

test("a Logframe code column (or its Output code alias) names the item, so one item can carry several indicators", () => {
  for (const header of ["Logframe code", "Output code"]) {
    const r = parseIndicatorText(`Code,${header},Name,Type\nIND1,O2.2,People with safe water,NUMBER\nIND2,O2.2,Water points,NUMBER\n`);
    assert.deepEqual(r.rows.map((x) => [x.code, x.logframeCode]), [["IND1", "O2.2"], ["IND2", "O2.2"]], header);
  }
});

test("an empty Logframe code cell falls back to nothing", () => {
  const r = parseIndicatorText("Code,Logframe code,Name,Type\nIND1,,People,NUMBER\n");
  assert.equal(r.rows[0].logframeCode, undefined);
});
