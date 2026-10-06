import assert from "node:assert/strict";
import test from "node:test";
import { BulkVerifyEvidenceHandler } from "../dist/index.js";

const ok = { ok: true, value: undefined };
test("a month's files are verified in one action, one result each; a failure does not stop the rest (25.4)", async () => {
  const seen = [];
  const h = new BulkVerifyEvidenceHandler({ handle: async (_c, id) => { seen.push(id); return id === "e2" ? { ok: false, error: new Error("File not found") } : ok; } });
  const r = await h.handle({}, { evidenceIds: ["e1", "e2", "e3", "e1"] });
  assert.deepEqual(seen, ["e1", "e2", "e3"], "duplicates verified once");
  assert.deepEqual([r.succeeded, r.failed], [2, 1]);
  assert.deepEqual(r.results.find((x) => x.evidenceId === "e2"), { evidenceId: "e2", ok: false, error: "File not found" });
});

test("at most 100 files per action", async () => {
  let n = 0;
  const h = new BulkVerifyEvidenceHandler({ handle: async () => (n += 1, ok) });
  const r = await h.handle({}, { evidenceIds: Array.from({ length: 150 }, (_, i) => `e${i}`) });
  assert.equal(n, 100);
  assert.equal(r.succeeded, 100);
});
