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
