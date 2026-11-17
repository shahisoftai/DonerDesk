import test from "node:test";
import assert from "node:assert/strict";
import { collapseAll, expandAll, initialExpand, reconcileExpand, toggleExpand, MAX_AUTO_OPEN } from "../../src/lib/shared/expand-state.ts";
import { choiceKey, readChoice, writeChoice, type ChoiceStore } from "../../src/lib/shared/remembered-choice.ts";
import { filtersToRemember, isRestorable } from "../../src/lib/shared/remembered-filters.ts";
import { EMPTY_STATES, emptyView } from "../../src/lib/shared/empty-states.ts";

const rows = (ids: string[], attention: string[] = []) => ids.map((id) => ({ id, attention: attention.includes(id) }));

test("a list starts closed and opens only the first row that needs something", () => {
  const s = initialExpand(rows(["a", "b", "c"], ["b", "c"]));
  assert.deepEqual([...s.open], ["b"]);
  assert.equal(MAX_AUTO_OPEN, 1);
  assert.deepEqual([...initialExpand(rows(["a", "b"])).open], []);
});

test("toggle, expand all and collapse all", () => {
  const items = rows(["a", "b"]);
  let s = initialExpand(items);
  s = toggleExpand(s, "a");
  assert.deepEqual([...s.open], ["a"]);
  assert.deepEqual([...toggleExpand(s, "a").open], []);
  assert.deepEqual([...expandAll(s, items).open].sort(), ["a", "b"]);
  assert.equal(collapseAll(expandAll(s, items)).open.size, 0);
});

test("reconcile: one new row opens, a bulk arrival opens nothing, removed rows are forgotten, no change returns the same state", () => {
  const s0 = initialExpand(rows(["a"]));
  assert.equal(reconcileExpand(s0, rows(["a"])), s0, "same reference when nothing changed (an effect must not loop)");
  const one = reconcileExpand(s0, rows(["a", "b"]));
  assert.deepEqual([...one.open], ["b"]);
  const bulk = reconcileExpand(one, rows(["a", "b", "c", "d", "e"]));
  assert.deepEqual([...bulk.open], ["b"], "three new rows at once are not all opened");
  const gone = reconcileExpand(bulk, rows(["a"]));
  assert.deepEqual([...gone.open], []);
  assert.deepEqual([...gone.seen], ["a"]);
});

function memory(): ChoiceStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

test("a remembered choice is kept per person, validated on read, and cleared with null", () => {
  const store = memory();
  const mine = choiceKey("u1", "evidence");
  assert.notEqual(mine, choiceKey("u2", "evidence"));
  writeChoice(store, mine, "status=VERIFIED");
  assert.equal(readChoice(store, mine, () => true), "status=VERIFIED");
  assert.equal(readChoice(store, mine, (v) => v.startsWith("x")), null, "a value that is no longer allowed is ignored");
  assert.equal(readChoice(store, choiceKey("u2", "evidence"), () => true), null, "another person's key is empty");
  writeChoice(store, mine, null);
  assert.equal(readChoice(store, mine, () => true), null);
});

test("storage that throws, or is missing, remembers nothing and never throws", () => {
  const broken: ChoiceStore = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("full"); } };
  assert.equal(readChoice(broken, "k", () => true), null);
  assert.doesNotThrow(() => writeChoice(broken, "k", "v"));
  assert.equal(readChoice(null, "k", () => true), null);
  assert.doesNotThrow(() => writeChoice(null, "k", "v"));
});

test("only filters are kept, never the page, and only plain text is restored", () => {
  assert.equal(filtersToRemember("?status=VERIFIED&page=3&focus=search&q="), "status=VERIFIED");
  assert.equal(filtersToRemember(""), "");
  assert.equal(isRestorable("status=VERIFIED"), true);
  assert.equal(isRestorable(""), false);
  assert.equal(isRestorable("q=<script>"), false);
  assert.equal(isRestorable("a ".repeat(300)), false);
});

test("an empty page says why, and its button is left out without the capability", () => {
  const withUpload = emptyView("PROJECT_EVIDENCE_NONE", new Set(["evidence.upload"]), "p1");
  assert.equal(withUpload.action?.href, "/projects/p1/evidence/new");
  const without = emptyView("PROJECT_EVIDENCE_NONE", new Set(), "p1");
  assert.equal(without.action, null, "hidden, not disabled");
  assert.ok(without.reason.length > 10);
  for (const [key, def] of Object.entries(EMPTY_STATES)) {
    assert.ok(def.title && def.reason, `${key} names a title and a reason`);
    assert.doesNotMatch(`${def.title} ${def.reason}`, /[A-Z_]{4,}|[a-f0-9]{8}-/, `${key} has no raw code`);
  }
});
