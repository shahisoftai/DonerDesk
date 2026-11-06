import test from "node:test";
import assert from "node:assert/strict";
import { AddCommentHandler, ResolveCommentHandler, ReopenCommentHandler } from "../dist/index.js";

const ok = (value) => ({ ok: true, value });
const tenantId = { toString: () => "t" };
const ctx = (userId) => ({ tenant: { tenantId, userId }, requestId: "r" });

function setup() {
  const store = new Map();
  const sent = [];
  const audits = [];
  const repo = {
    create: async (c) => (store.set(c.id, { ...c }), ok(c)),
    findById: async (id) => ok(store.get(id) ?? null),
    resolve: async (id, _t, by) => { const c = store.get(id); Object.assign(c, { status: "RESOLVED", resolvedById: by, resolvedAt: new Date() }); return ok(c); },
    reopen: async (id) => { const c = store.get(id); Object.assign(c, { status: "OPEN", resolvedById: undefined, resolvedAt: undefined }); return ok(c); },
  };
  let n = 0;
  const add = new AddCommentHandler({ generate: () => `c${++n}` }, repo, { record: async (e) => audits.push(e) }, { send: async (m) => sent.push(m) }, { resolve: async () => ({ title: "Wells", owners: ["owner"] }) });
  return { add, resolve: new ResolveCommentHandler(repo, { record: async (e) => audits.push(e) }), reopen: new ReopenCommentHandler(repo, { record: async (e) => audits.push(e) }), store, sent, audits };
}
const on = { entityType: "evidence", entityId: "e1" };

test("a reply goes under the first comment and tells the person who started the thread", async () => {
  const { add, sent } = setup();
  const first = await add.handle(ctx("ann"), { ...on, commentText: "Is this the signed copy?" });
  sent.length = 0;
  const reply = await add.handle(ctx("bob"), { ...on, commentText: "Yes, page 2 added.", parentId: first.value.id });
  assert.equal(reply.ok, true);
  assert.deepEqual(sent.map((m) => m.recipientId).sort(), ["ann", "owner"]);
});

test("a reply to a reply, to a resolved thread, or on something else is refused", async () => {
  const { add, resolve, reopen } = setup();
  const first = (await add.handle(ctx("ann"), { ...on, commentText: "q" })).value.id;
  const reply = (await add.handle(ctx("bob"), { ...on, commentText: "a", parentId: first })).value.id;
  assert.equal((await add.handle(ctx("ann"), { ...on, commentText: "x", parentId: reply })).ok, false);
  assert.equal((await add.handle(ctx("ann"), { entityType: "evidence", entityId: "other", commentText: "x", parentId: first })).ok, false);
  await resolve.handle(ctx("ann"), first);
  const refused = await add.handle(ctx("bob"), { ...on, commentText: "late", parentId: first });
  assert.equal(refused.ok, false);
  assert.match(refused.error.message, /Reopen/);
  await reopen.handle(ctx("ann"), first);
  assert.equal((await add.handle(ctx("bob"), { ...on, commentText: "late", parentId: first })).ok, true);
});

test("resolving records who and when; only a thread's first comment can be resolved or reopened", async () => {
  const { add, resolve, reopen, store, audits } = setup();
  const first = (await add.handle(ctx("ann"), { ...on, commentText: "q" })).value.id;
  const reply = (await add.handle(ctx("bob"), { ...on, commentText: "a", parentId: first })).value.id;
  assert.equal((await resolve.handle(ctx("carol"), reply)).ok, false);
  assert.equal((await resolve.handle(ctx("carol"), first)).ok, true);
  assert.equal(store.get(first).resolvedById, "carol");
  assert.ok(store.get(first).resolvedAt instanceof Date);
  assert.equal((await reopen.handle(ctx("ann"), first)).ok, true);
  assert.equal(store.get(first).resolvedById, undefined);
  assert.ok(audits.some((a) => a.eventType === "comment.reopened"));
  assert.equal((await reopen.handle(ctx("ann"), reply)).ok, false);
});
