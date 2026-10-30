import test from "node:test";
import assert from "node:assert/strict";
import { checkBookmark, isInAppAddress, MAX_BOOKMARKS } from "../dist/index.js";

test("only addresses inside the app are kept", () => {
  for (const ok of ["/projects/abc/maps", "/dashboards?x=1#top", "/"]) assert.equal(isInAppAddress(ok), true, ok);
  for (const bad of ["https://evil.example", "//evil.example", "/\\evil", "javascript:alert(1)", "projects/x", "/a b"]) assert.equal(isInAppAddress(bad), false, bad);
});

test("a bookmark is cleaned, and refused when empty, outside the app, repeated or too many", () => {
  const good = checkBookmark({ title: "  Kenya   maps ", href: "/projects/1/maps" }, []);
  assert.deepEqual(good, { ok: true, value: { title: "Kenya maps", href: "/projects/1/maps" } });
  const code = (i, e = []) => { const r = checkBookmark(i, e); return r.ok ? "OK" : r.problem.code; };
  assert.equal(code({ title: " ", href: "/a" }), "TITLE_EMPTY");
  assert.equal(code({ title: "x".repeat(81), href: "/a" }), "TITLE_TOO_LONG");
  assert.equal(code({ title: "x", href: "https://x.test" }), "HREF_NOT_IN_APP");
  assert.equal(code({ title: "x", href: "/a" }, ["/a"]), "ALREADY_SAVED");
  assert.equal(code({ title: "x", href: "/new" }, Array.from({ length: MAX_BOOKMARKS }, (_, i) => `/p${i}`)), "TOO_MANY");
});

test("home pins: only a known kind, one of a thing, twelve at most, and the order moves one pin", async () => {
  const { checkHomePin, reorderPins, MAX_HOME_PINS } = await import("../dist/index.js");
  assert.equal(checkHomePin({ kind: "NOPE", ref: "d1" }, []).ok, false);
  assert.equal(checkHomePin({ kind: "DASHBOARD", ref: "  " }, []).ok, false);
  assert.equal(checkHomePin({ kind: "DASHBOARD", ref: "d1" }, [{ kind: "DASHBOARD", ref: "d1" }]).problem.code, "ALREADY_PINNED");
  const full = Array.from({ length: MAX_HOME_PINS }, (_, i) => ({ kind: "DASHBOARD", ref: `d${i}` }));
  assert.equal(checkHomePin({ kind: "DASHBOARD", ref: "new" }, full).problem.code, "TOO_MANY");
  assert.deepEqual(checkHomePin({ kind: "DASHBOARD", ref: " d9 " }, []).value, { kind: "DASHBOARD", ref: "d9" });
  assert.deepEqual(reorderPins(["a", "b", "c"], "a", 2), ["b", "c", "a"]);
  assert.deepEqual(reorderPins(["a", "b", "c"], "c", 0), ["c", "a", "b"]);
  assert.deepEqual(reorderPins(["a", "b"], "zzz", 0), ["a", "b"]);
});
