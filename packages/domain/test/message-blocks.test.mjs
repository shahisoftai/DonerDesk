import { test } from "node:test";
import assert from "node:assert/strict";
import { messageBlocks, renderSummary } from "../dist/index.js";

test("a daily summary becomes headings and bullet lists, not one paragraph", () => {
  const summary = renderSummary([
    { rule: "LATE", text: "Enter the March value of IND-1" },
    { rule: "LATE", text: "Verify water test report" },
    { rule: "DUE_TODAY", text: "Approve the Q1 report" },
  ]);
  assert.deepEqual(messageBlocks(summary.message), [
    { kind: "HEADING", text: "Late" },
    { kind: "LIST", items: ["Enter the March value of IND-1", "Verify water test report"] },
    { kind: "HEADING", text: "Due today" },
    { kind: "LIST", items: ["Approve the Q1 report"] },
  ]);
});

test("plain sentences stay paragraphs; blank lines are dropped", () => {
  assert.deepEqual(messageBlocks("The report was approved.\n\nIt is ready to export."), [
    { kind: "PARAGRAPH", text: "The report was approved." },
    { kind: "PARAGRAPH", text: "It is ready to export." },
  ]);
  assert.deepEqual(messageBlocks(""), []);
});

test("a sentence before a list is not taken for a heading", () => {
  assert.deepEqual(messageBlocks("These values were sent back.\n- IND-1\n1. IND-2"), [
    { kind: "PARAGRAPH", text: "These values were sent back." },
    { kind: "LIST", items: ["IND-1", "IND-2"] },
  ]);
});
