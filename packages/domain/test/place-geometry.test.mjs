import test from "node:test";
import assert from "node:assert/strict";
import { validateGeometry, validatePlace, ringCrossing, GEOMETRY_MAX_VERTICES, GEOMETRY_PROBLEMS, PLACED_BY } from "../dist/index.js";

const sq = [[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]];
const poly = (ring) => ({ type: "Polygon", coordinates: [ring] });
const line = (coordinates) => ({ type: "LineString", coordinates });
const problem = (input) => { const r = validateGeometry(input); assert.equal(r.ok, false); return r.error.message; };

test("a square outline is accepted, rounded to six decimals, and described", () => {
  const r = validateGeometry(poly([[0.1234567891, 0], [4, 0], [4, 4], [0, 4], [0.1234567891, 0]]));
  assert.equal(r.ok, true);
  assert.equal(r.value.kind, "POLYGON");
  assert.equal(r.value.vertices, 4);
  assert.deepEqual(r.value.geometry.coordinates[0][0], [0.123457, 0]);
  assert.equal(JSON.parse(r.value.json).geometry.type, "Polygon");
  assert.equal(r.value.bytes, Buffer.byteLength(r.value.json));
});

test("an outline must be closed, have an area, three real corners and no holes", () => {
  assert.match(problem(poly([[0, 0], [4, 0], [4, 4], [0, 4]])), /come back to where it started/);
  assert.match(problem(poly([[0, 0], [1, 1], [0, 0]])), /at least three corners/);
  assert.match(problem(poly([[0, 0], [1, 1], [1, 1], [0, 0]])), /three different corners/);
  assert.match(problem(poly([[0, 0], [1, 1], [2, 2], [0, 0]])), /no area/);
  assert.match(problem({ type: "Polygon", coordinates: [sq, sq] }), /without holes/);
  assert.match(problem(poly([[0, 0], ["x", 0], [4, 4], [0, 0]])), /longitude and a latitude/);
});

test("an outline that crosses itself is refused; touching neighbours and a concave shape are fine", () => {
  assert.match(problem(poly([[0, 0], [4, 4], [4, 0], [0, 4], [0, 0]])), /crosses itself/);
  assert.equal(ringCrossing(sq), null);
  const concave = [[0, 0], [6, 0], [6, 6], [3, 2], [0, 6], [0, 0]];
  assert.equal(validateGeometry(poly(concave)).ok, true);
  assert.match(problem(poly([[0, 0], [4, 0], [2, 0], [2, 3], [0, 0]])), /crosses itself/); // an edge folded back over its neighbour
});

test("a route needs two different points; it may cross itself", () => {
  assert.equal(validateGeometry(line([[0, 0], [1, 1]])).value.kind, "LINE");
  assert.equal(validateGeometry(line([[0, 0], [4, 4], [4, 0], [0, 4]])).ok, true);
  assert.match(problem(line([[1, 1], [1, 1]])), /two different points/);
  assert.match(problem(line([[1, 1]])), /two different points/);
});

test("range, type and size limits", () => {
  assert.match(problem(poly([[0, 0], [200, 0], [4, 4], [0, 0]])), /outside the map/);
  assert.match(problem(line([[0, 95], [1, 1]])), /outside the map/);
  assert.match(problem({ type: "Point", coordinates: [1, 1] }), /outline \(polygon\) or a route/);
  assert.match(problem(null), /Draw an outline/);
  const many = Array.from({ length: GEOMETRY_MAX_VERTICES + 1 }, (_, i) => [i / 100, (i % 2) / 100]);
  assert.match(problem(line(many)), /at most 2000 points/);
  assert.equal(validateGeometry(line(many.slice(0, GEOMETRY_MAX_VERTICES))).ok, true);
});

test("only an area carries a shape, and placedBy is one of the known ways", () => {
  const base = { id: "a", name: "Camp", kind: "AREA", adminLevel: 4, aliases: [], archived: false };
  assert.equal(validatePlace({ ...base, geometryKind: "POLYGON", placedBy: "MAP_DRAWN" }, []).ok, true);
  const point = validatePlace({ ...base, kind: "POINT", geometryKind: "LINE" }, []);
  assert.match(point.error.message, /not an outline/);
  assert.match(validatePlace({ ...base, placedBy: "TELEPATHY" }, []).error.message, /not a way a place can be located/);
  assert.deepEqual([...PLACED_BY].sort(), ["GPS", "IMPORT", "MAP_DRAWN", "MAP_PIN", "SNAPPED", "TYPED"]);
});

test("every refusal carries a stable code (and its values) so a screen can say it in the person's language", () => {
  const code = (input) => { const r = validateGeometry(input); assert.equal(r.ok, false); return [r.error.details.code, r.error.details.params]; };
  const poly = (ring) => ({ type: "Polygon", coordinates: [ring] });
  assert.deepEqual(code(null), ["MISSING", {}]);
  assert.deepEqual(code({ type: "Point", coordinates: [1, 1] })[0], "WRONG_TYPE");
  assert.deepEqual(code({ type: "Polygon", coordinates: [[], []] })[0], "HOLES");
  assert.deepEqual(code(poly([[0, 0], ["x", 0], [4, 4], [0, 0]]))[0], "NO_COORDINATES");
  assert.deepEqual(code(poly([[0, 0], [1, 1], [0, 0]]))[0], "TOO_FEW_CORNERS");
  assert.deepEqual(code(poly([[0, 0], [4, 0], [4, 4], [0, 4]]))[0], "NOT_CLOSED");
  assert.deepEqual(code(poly([[0, 0], [1, 1], [1, 1], [0, 0]]))[0], "TOO_FEW_DISTINCT_CORNERS");
  assert.deepEqual(code(poly([[0, 0], [1, 1], [2, 2], [0, 0]]))[0], "NO_AREA");
  assert.deepEqual(code(poly([[0, 0], [4, 4], [4, 0], [0, 4], [0, 0]]))[0], "SELF_CROSSING");
  assert.deepEqual(code({ type: "LineString", coordinates: [[1, 1], [1, 1]] })[0], "ROUTE_TOO_SHORT");
  assert.deepEqual(code(poly([[0, 0], [200, 0], [4, 4], [0, 0]]))[0], "OUT_OF_RANGE");
  const many = Array.from({ length: GEOMETRY_MAX_VERTICES + 1 }, (_, i) => [i / 100, (i % 2) / 100]);
  assert.deepEqual(code({ type: "LineString", coordinates: many }), ["TOO_MANY_POINTS", { max: GEOMETRY_MAX_VERTICES }]);
  assert.deepEqual([...GEOMETRY_PROBLEMS].sort(), ["HOLES", "MISSING", "NOT_CLOSED", "NO_AREA", "NO_COORDINATES", "OUT_OF_RANGE", "ROUTE_TOO_SHORT", "SELF_CROSSING", "TOO_FEW_CORNERS", "TOO_FEW_DISTINCT_CORNERS", "TOO_LARGE", "TOO_MANY_POINTS", "WRONG_TYPE"]);
});
