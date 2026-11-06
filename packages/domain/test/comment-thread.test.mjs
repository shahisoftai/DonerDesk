import test from "node:test";
import assert from "node:assert/strict";
import { buildThreads, checkReply, commentRecipients, COMMENTABLE_TYPES } from "../dist/index.js";

const c = (id, over = {}) => ({ id, status: "OPEN", authorId: "a", commentText: id, createdAt: new Date(`2026-10-21T10:0${id.length}:00Z`), ...over });

test("replies sit under their first comment, oldest first, and the thread carries the state", () => {
  const first = c("1", { createdAt: new Date("2026-10-21T10:00:00Z"), status: "RESOLVED", resolvedById: "r", resolvedAt: new Date("2026-10-21T12:00:00Z") });
  const later = c("2", { createdAt: new Date("2026-10-21T11:00:00Z") });
  const r2 = c("r2", { parentId: "1", createdAt: new Date("2026-10-21T10:30:00Z") });
  const r1 = c("r1", { parentId: "1", createdAt: new Date("2026-10-21T10:10:00Z") });
  const threads = buildThreads([later, r2, first, r1]);
  assert.deepEqual(threads.map((t) => t.root.id), ["1", "2"]);
  assert.deepEqual(threads[0].replies.map((x) => x.id), ["r1", "r2"]);
  assert.equal(threads[0].status, "RESOLVED");
  assert.equal(threads[0].resolvedById, "r");
  assert.equal(threads[1].replies.length, 0);
});

test("a reply whose first comment is missing is not dropped", () => {
  const threads = buildThreads([c("x", { parentId: "gone" })]);
  assert.equal(threads.length, 1);
});

test("a reply must be one level deep, on the same thing, in an open thread", () => {
  const root = { status: "OPEN", entityType: "evidence", entityId: "e1" };
  assert.deepEqual(checkReply(root, { entityType: "evidence", entityId: "e1" }), { ok: true });
  assert.equal(checkReply({ ...root, parentId: "p" }, { entityType: "evidence", entityId: "e1" }).ok, false);
  assert.equal(checkReply({ ...root, status: "RESOLVED" }, { entityType: "evidence", entityId: "e1" }).ok, false);
  assert.equal(checkReply(root, { entityType: "evidence", entityId: "other" }).ok, false);
});

test("a reply also tells the person who started the thread, but never its own author", () => {
  assert.deepEqual(commentRecipients("evidence", "replier", undefined, ["owner"], "starter").sort(), ["owner", "starter"]);
  assert.deepEqual(commentRecipients("report_claim", "starter", undefined, [], "starter"), []);
});

test("a statement in a report can carry a comment", () => {
  assert.ok(COMMENTABLE_TYPES.includes("report_claim"));
});
