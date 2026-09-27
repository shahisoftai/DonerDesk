import assert from "node:assert/strict";
import test from "node:test";
import { buildAuthorInstructionBlock } from "../dist/llm/llm-report-draft-generator.js";

/**
 * Report Editor B7 — the author's instruction for a single-section regenerate
 * reaches the legacy narrator prompt only when present, so full-draft prompts
 * stay byte-identical.
 */

test("no instruction adds nothing to the section prompt", () => {
  assert.deepEqual(buildAuthorInstructionBlock(undefined), []);
  assert.deepEqual(buildAuthorInstructionBlock("   "), []);
});

test("an instruction is added verbatim (trimmed) under its own heading, subordinate to the rules", () => {
  const block = buildAuthorInstructionBlock("  Focus more on the flood response ");
  assert.equal(block[0], "# Author's instruction for this section");
  assert.match(block[1], /never invent facts or numbers/);
  assert.equal(block[2], "Focus more on the flood response");
});
