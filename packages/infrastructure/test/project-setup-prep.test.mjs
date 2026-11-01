import test from "node:test";
import assert from "node:assert/strict";
import { compactSheetText, dropNearDuplicates, overlapRatio } from "../dist/project-setup/document-prep.js";
import { readBudgetSheet } from "../dist/project-setup/budget-sheet-reader.js";
import { selectBlocks, runAreaExtraction, chunkBlocksText } from "../dist/project-setup/extractor-shared.js";
import { toBlocks } from "../dist/project-setup/source-reader.js";

const blocksOf = (text, documentId = "source-1", start = 0) => toBlocks(text).map((b, i) => ({ ...b, documentId, index: start + i }));

test("compactSheetText drops trailing empty cells and rounds float noise", () => {
  const out = compactSheetText("a\tb\t\t\t\n1.1000000000000001\tx\t\t");
  assert.equal(out, "a\tb\n1.1\tx");
});

test("compactSheetText turns Gantt marks into the weeks they cover", () => {
  const sheet = [
    "Code\tActivity\tTarget\tJuly\tAugust\t\t\t",
    "\t\t\tWk -4\tWk - 1\tWk - 2\tWk - 3\tWk - 4\tWk - 5",
    "1.1\tKick-off\t1 meeting\tx\t\t\t\t\t",
    "1.2\tHire staff\tOrganogram\tx\tx\tx\t\t\t",
    "1.3\tNo marks\t\t\t\t\t\t\t",
  ].join("\n");
  const out = compactSheetText(sheet).split("\n");
  assert.ok(out.some((l) => l === "1.1\tKick-off\t1 meeting\t[scheduled July Wk -4]"));
  assert.ok(out.some((l) => l.startsWith("1.2\tHire staff\tOrganogram\t[scheduled July Wk -4 to August Wk - 2]")));
  assert.ok(out.includes("1.3\tNo marks"));
});

test("dropNearDuplicates leaves out the shorter of two near-identical files and names it", () => {
  const body = Array.from({ length: 30 }, (_, i) => `This is a sufficiently long line number ${i} of the grant description.`).join("\n");
  const docs = [{ name: "a.docx", text: body }, { name: "b.docx", text: `${body}\nOne extra revised line that is also long enough.` }, { name: "c.xlsx", text: "completely different text that is long enough to count here" }];
  const { kept, dropped } = dropNearDuplicates(docs);
  assert.deepEqual(dropped, ["a.docx"]);
  assert.deepEqual(kept.map((d) => d.name), ["b.docx", "c.xlsx"]);
  assert.ok(overlapRatio(body, "nothing alike at all, not even close to the other text") < 0.1);
});

const SUMMARY = [
  "# Summary Budget", "\tPeriod of Performance:  \t10 Months", "\tBudgets developed in Pakistani Rupee (PKRs.)",
  "\tPersonnel\t\t100\t100", "\t     Local Staff\t\t100\t100", "\tSupplies\t\t0\t0", "\t Operation Costs\t\t50.5\t50.5",
  "\tTotal Direct Costs\t\t150.5\t150.5", "\tTOTAL PROJECT COSTS\t\t150.5\t150.5", "# Other sheet", "\tx\t1",
].join("\n");

test("budget sheet reader: top-level lines only, no totals, no zero lines, currency from the sheet, quote is the sheet line", () => {
  const read = readBudgetSheet(blocksOf(SUMMARY));
  assert.ok(read);
  const lines = read.fields.budget.map((b) => [b.value.category, b.value.amount, b.value.currency]);
  assert.deepEqual(lines, [["Personnel", "100", "PKR"], ["Operation Costs", "50.5", "PKR"]]);
  assert.match(read.fields.budget[0].sourceQuote, /^Personnel 100 100$/);
  assert.deepEqual(read.documentIds, ["source-1"]);
});

test("budget sheet reader: a currency the sheet does not name stays Not stated, and a document without the sheet is not read", () => {
  const read = readBudgetSheet(blocksOf(SUMMARY.replace("Pakistani Rupee (PKRs.)", "local money")));
  assert.equal(read.fields.budget[0].value.currency, null);
  assert.equal(readBudgetSheet(blocksOf("# Detailed Budget\n\tA\t1")), null);
});

test("selection ranks blocks by how many of the area's words they use and keeps reading order", () => {
  const blocks = [
    { documentId: "d", index: 0, text: "cover page" },
    { documentId: "d", index: 1, text: "weather and background of the region" },
    { documentId: "d", index: 2, text: "budget total cost" },
    { documentId: "d", index: 3, text: "budget funding grant contribution" },
    { documentId: "d", index: 4, text: "budget" },
    { documentId: "d", index: 5, text: "filler ".repeat(200) },
  ];
  const small = selectBlocks(blocks, ["budget", "total", "cost", "funding", "grant"], 120);
  assert.match(small.text, /\[2\]/);
  assert.match(small.text, /\[3\]/);
  assert.doesNotMatch(small.text, /\[1\]/);
  assert.ok(small.text.indexOf("[2]") < small.text.indexOf("[3]"));
  const withHead = selectBlocks(blocks, ["budget", "total", "cost", "funding", "grant"], 400, 1);
  assert.match(withHead.text, /\[0\] cover page/);
});

const llmReplying = (replies) => {
  let n = 0; const calls = [];
  return { calls, llm: { completeJson: async (input) => { calls.push(input); const r = replies[Math.min(n++, replies.length - 1)]; return r instanceof Error ? { ok: false, error: r } : { ok: true, value: { text: r, model: "m", promptVersion: "p", usage: { inputTokens: 10, outputTokens: 5 } } }; } } };
};
const base = (llm, blocks) => ({ llm, tenantId: "t", proposalId: "p", blocks, sourceText: "", prior: {}, maxTokens: 100, timeoutMs: 1000, keywords: ["word"], buildPrompt: (t) => ({ system: "s", user: t }), parseChunk: (raw) => raw, merge: (a, b) => ({ ...a, ...b }) });

test("an unreadable reply is retried once, then read", async () => {
  const { llm, calls } = llmReplying(["not json at all", '{"ok": 1}']);
  const run = await runAreaExtraction(base(llm, blocksOf("a word here")));
  assert.equal(run.ok, true);
  assert.equal(calls.length, 2);
  assert.deepEqual(run.value.fields, { ok: 1 });
});

test("chunks are asked at the same time and merged in reading order", async () => {
  const big = Array.from({ length: 40 }, (_, i) => `word ${i} ${"x".repeat(900)}`).join("\n");
  const blocks = blocksOf(big);
  assert.ok(chunkBlocksText(blocks.map((b) => `[${b.index}] ${b.text}`).join("\n")).chunks.length >= 2);
  let live = 0; let peak = 0;
  const llm = { completeJson: async ({ user }) => { live++; peak = Math.max(peak, live); await new Promise((r) => setTimeout(r, 20)); live--; const first = /\[(\d+)\]/.exec(user)[1]; return { ok: true, value: { text: JSON.stringify({ [`c${first}`]: 1 }), model: "m", promptVersion: "p", usage: { inputTokens: 1, outputTokens: 1 } } }; } };
  const run = await runAreaExtraction({ ...base(llm, blocks), budgetChars: 100_000 });
  assert.equal(run.ok, true);
  assert.ok(peak >= 2, `expected overlapping calls, peak was ${peak}`);
  const keys = Object.keys(run.value.fields);
  assert.deepEqual(keys, [...keys].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))));
});
