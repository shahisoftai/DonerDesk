import test from "node:test";
import assert from "node:assert/strict";
import { normalizeLocationKey, locationGroup } from "../dist/index.js";

test("folding: diacritics, case, punctuation and whitespace collapse to one key", () => {
  assert.equal(normalizeLocationKey("Gulu"), normalizeLocationKey("gulu"));
  assert.equal(normalizeLocationKey("São Paulo"), normalizeLocationKey("sao paulo"));
  assert.equal(normalizeLocationKey("  GULU  "), "gulu");
  assert.equal(normalizeLocationKey("Al-Mukalla / Coast"), "al mukalla coast");
});

test("admin suffixes are stripped, repeatedly, but only as trailing words", () => {
  assert.equal(normalizeLocationKey("Gulu District"), "gulu");
  assert.equal(normalizeLocationKey("Gulu district municipality"), "gulu");
  assert.equal(normalizeLocationKey("B Sub-County District"), "b", "stripping repeats until no trailing suffix remains");
  assert.equal(normalizeLocationKey("County Line"), "county line", "a suffix that is not trailing stays");
  assert.equal(normalizeLocationKey("District"), "district", "a bare word is never erased to nothing");
});

test("an empty or blank value is an empty key, never a group", () => {
  assert.equal(normalizeLocationKey(""), "");
  assert.equal(normalizeLocationKey("   "), "");
});

test("locationGroup keeps the most frequent original spelling as the display name", () => {
  const groups = locationGroup([
    { location: "Gulu" },
    { location: "Gulu District" },
    { location: "gulu" },
    { location: "Gulu" },
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].group.key, "gulu");
  assert.equal(groups[0].group.display, "Gulu", "the typed spelling wins; grouping never rewrites");
  assert.equal(groups[0].group.count, 4);
  assert.equal(groups[0].members.length, 4);
});

test("locationGroup ties go to the first spelling seen, and blank locations are left out", () => {
  const groups = locationGroup([{ location: "Oyam North" }, { location: "Oyam north district" }, { location: "" }, { location: "   " }]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].group.display, "Oyam North");
  assert.equal(groups[0].group.count, 2);
});

test("locationGroup returns groups in a stable order (insertion) and members keep their references", () => {
  const first = { location: "Lira" };
  const second = { location: "Lira District" };
  const groups = locationGroup([first, second]);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].members, [first, second]);
});
