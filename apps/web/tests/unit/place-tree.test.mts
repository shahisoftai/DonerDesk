import test from "node:test";
import assert from "node:assert/strict";
import { ancestorsOf, buildPlaceTree, visibleNodes, type TreePlace } from "../../src/features/maps/domain/place-tree.ts";
import { pathForPlace, refOfPlace } from "../../src/features/maps/domain/drill/place-path.ts";

const p = (id: string, name: string, adminLevel: number, parentId?: string, extra: Partial<TreePlace> = {}): TreePlace => ({ id, name, adminLevel, parentId, archived: false, ...extra });
const places = [
  p("ug", "Uganda", 0), p("n", "Northern", 1, "ug"), p("gulu", "Gulu", 2, "n", { code: "UG3064" }), p("kit", "Kitgum", 2, "n"), p("w", "Pece ward", 3, "gulu"),
  p("e", "Eastern", 1, "ug"), p("mbale", "Mbale", 2, "e"),
];
const counts = { activities: new Map([["w", 2], ["kit", 1]]), figures: new Set(["gulu", "mbale"]) };

test("counts roll up and only touched places are listed", () => {
  const roots = buildPlaceTree(places, counts);
  assert.equal(roots.length, 1);
  const uganda = roots[0]!;
  assert.equal(uganda.activities, 3);
  assert.equal(uganda.figures, 2);
  const names = (n: typeof uganda): string[] => [n.name, ...n.children.flatMap(names)];
  assert.deepEqual(names(uganda), ["Uganda", "Eastern", "Mbale", "Northern", "Gulu", "Pece ward", "Kitgum"]);
});

test("untouched places are listed only on request", () => {
  const none = { activities: new Map<string, number>(), figures: new Set<string>() };
  assert.deepEqual(buildPlaceTree(places, none), []);
  assert.equal(buildPlaceTree(places, none, { all: true })[0]!.children.length, 2);
});

test("retired places are never listed, and a cycle in the data is cut", () => {
  const retired = places.map((x) => (x.id === "gulu" ? { ...x, archived: true } : x));
  const roots = buildPlaceTree(retired, counts);
  assert.ok(!JSON.stringify(roots).includes("Gulu"));
  const loop = [p("a", "A", 1, "b"), p("b", "B", 2, "a")];
  assert.doesNotThrow(() => buildPlaceTree(loop, { activities: new Map([["a", 1]]), figures: new Set() }, { all: true }));
});

test("visible nodes follow what is open; ancestors say what to open for a place", () => {
  const roots = buildPlaceTree(places, counts);
  assert.deepEqual(visibleNodes(roots, new Set()).map((n) => n.name), ["Uganda"]);
  assert.deepEqual(visibleNodes(roots, new Set(["ug"])).map((n) => n.name), ["Uganda", "Eastern", "Northern"]);
  assert.deepEqual(ancestorsOf(roots, "w"), ["ug", "n", "gulu"]);
  assert.deepEqual(ancestorsOf(roots, "nope"), []);
});

test("a place becomes a path of its ancestors and its own ref (code first, else name key)", () => {
  const hit = pathForPlace(places, "w")!;
  assert.deepEqual(hit.path.map((c) => [c.level, c.name, c.ref]), [[0, "Uganda", "name:uganda"], [1, "Northern", "name:northern"], [2, "Gulu", "UG3064"]]);
  assert.equal(hit.ref, "name:pece");
  assert.equal(hit.level, 3);
  assert.equal(refOfPlace(places[2]!), "UG3064");
  assert.deepEqual(pathForPlace(places, "ug")!.path, []);
  assert.equal(pathForPlace(places, "missing"), null);
});

test("a chain whose levels do not increase gives no path", () => {
  assert.equal(pathForPlace([p("a", "A", 2), p("b", "B", 2, "a")], "b"), null);
});
