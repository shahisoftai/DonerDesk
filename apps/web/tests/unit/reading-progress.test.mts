import { test } from "node:test";
import assert from "node:assert/strict";
import { READING_PARTS, readingFileNames, readingProgress } from "../../src/features/project-setup/pcw/domain/reading-progress.ts";

test("with no runs every part is waiting and nothing is shown as done", () => {
  const p = readingProgress({});
  assert.equal(p.total, READING_PARTS.length);
  assert.ok(p.parts.every((x) => x.state === "WAITING"));
  assert.equal(p.percent, 0);
});

test("run states map to what the person sees, and a failed part counts as finished work", () => {
  const p = readingProgress({ FACTS: "FINISHED", LOGFRAME: "RUNNING", PLAN: "FAILED" });
  const by = Object.fromEntries(p.parts.map((x) => [x.part, x.state]));
  assert.equal(by.FACTS, "DONE");
  assert.equal(by.LOGFRAME, "READING");
  assert.equal(by.PLAN, "FAILED");
  assert.equal(by.RISKS, "WAITING");
  assert.equal(p.done, 1);
  assert.equal(p.failed, 1);
  assert.equal(p.percent, Math.round((2 / 8) * 100));
});

test("all parts finished is 100 percent; an unknown part in the record is ignored", () => {
  const all = Object.fromEntries(READING_PARTS.map((x) => [x, "FINISHED" as const]));
  assert.equal(readingProgress({ ...all, SOMETHING_ELSE: "RUNNING" }).percent, 100);
});

test("file names lose their folders and are capped", () => {
  assert.deepEqual(readingFileNames([{ name: "a/b/Part C.docx" }, { name: "x.xlsx" }], 1), ["Part C.docx"]);
});
