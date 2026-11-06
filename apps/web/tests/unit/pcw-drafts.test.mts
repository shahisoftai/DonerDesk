// Resuming the wizard: which of a person's setups it carries on with.
import test from "node:test";
import assert from "node:assert/strict";
import { latestOpenBlankDraft } from "../../src/features/project-setup/pcw/domain/drafts.ts";

const d = (id: string, extra = {}) => ({ id, status: "READY", sourceName: "", appliedProjectId: null, updatedAt: "2026-11-01T10:00:00Z", ...extra });

test("it carries on with the latest open draft that was started with no documents", () => {
  assert.equal(latestOpenBlankDraft([d("a"), d("b", { updatedAt: "2026-11-02T10:00:00Z" }), d("c", { updatedAt: "2026-10-30T10:00:00Z" })])?.id, "b");
});

test("a setup that read documents, one that was started as a project, and one still being read are not resumed", () => {
  const list = [d("docs", { sourceName: "proposal.pdf" }), d("done", { status: "APPLIED", appliedProjectId: "p1" }), d("reading", { status: "EXTRACTING" }), d("failed", { status: "FAILED" }), d("partial", { status: "PARTIAL", appliedProjectId: "p2" })];
  assert.equal(latestOpenBlankDraft(list), null);
});

test("with nothing to resume it says so, and a list is never changed", () => {
  const list = [d("a"), d("b")];
  const before = JSON.stringify(list);
  assert.equal(latestOpenBlankDraft([]), null);
  latestOpenBlankDraft(list);
  assert.equal(JSON.stringify(list), before);
});
