import assert from "node:assert/strict";
import test from "node:test";
import { ListCommentsHandler } from "../dist/index.js";

const ctx = { tenant: { tenantId: "tenant-1" }, requestId: "r1" };
const rows = [
  { id: "c1", authorId: "u1", resolvedById: "u2", commentText: "first" },
  { id: "c2", authorId: "gone", commentText: "reply" },
];
const repo = { async findByEntity() { return { ok: true, value: rows }; } };
const users = { async findById(id) { return { ok: true, value: id === "u1" ? { name: "Ada Okafor" } : id === "u2" ? { name: "Ben Tesfaye" } : null }; } };

test("comments carry the author's and the resolver's name", async () => {
  const r = await new ListCommentsHandler(repo, users).handle(ctx, "evidence", "e1");
  assert.equal(r.ok, true);
  assert.equal(r.value[0].authorName, "Ada Okafor");
  assert.equal(r.value[0].resolvedByName, "Ben Tesfaye");
});

test("an author who no longer exists has no name, and the comment is still listed", async () => {
  const r = await new ListCommentsHandler(repo, users).handle(ctx, "evidence", "e1");
  assert.equal(r.value[1].id, "c2");
  assert.equal(r.value[1].authorName, undefined);
});

test("without a user repository the comments are returned unchanged", async () => {
  const r = await new ListCommentsHandler(repo).handle(ctx, "evidence", "e1");
  assert.deepEqual(r.value, rows);
});
