import test from "node:test";
import assert from "node:assert/strict";
import { parseCaseCodes } from "../dist/index.js";

test("case codes are read from commas, spaces and new lines; blanks and repeats are dropped; case is kept", () => {
  assert.deepEqual(parseCaseCodes("NG-0001, NG-0002;\nNG-0001   ng-0003\n\n"), ["NG-0001", "NG-0002", "ng-0003"]);
  assert.deepEqual(parseCaseCodes("  "), []);
});
