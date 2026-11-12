import assert from "node:assert/strict";
import test from "node:test";
import { BUILT_IN_CONTENT, LIBRARY_SECTOR_IDS, MAX_LOGIC_TEXT } from "../dist/index.js";

test("52.5: every suggested outcome and output in every sector carries a starting assumption, and nothing else does", () => {
  for (const id of LIBRARY_SECTOR_IDS) {
    for (const node of BUILT_IN_CONTENT[id].logframe) {
      if (node.level === "OUTCOME" || node.level === "OUTPUT") {
        assert.ok(node.assumption && node.assumption.length >= 20 && node.assumption.length <= MAX_LOGIC_TEXT, `${id}/${node.key} has no usable assumption`);
      } else {
        assert.equal(node.assumption, undefined, `${id}/${node.key} (${node.level}) should not carry one`);
      }
    }
  }
});
