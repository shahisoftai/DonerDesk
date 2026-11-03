import test from "node:test";
import assert from "node:assert/strict";
import { guideBoundaryFields, validateBoundaryLayer, BOUNDARY_LAYER_MAX_FEATURES } from "../dist/index.js";

const sq = (x, y, s = 1) => ({ type: "Polygon", coordinates: [[[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]]] });
const feature = (props, geometry = sq(32, 2)) => ({ type: "Feature", properties: props, geometry });
const file = (...features) => JSON.stringify({ type: "FeatureCollection", features });
const input = (over = {}) => ({ iso: "uga", countryName: "Uganda", adminLevel: 4, fileName: "kampala-wards.geojson", nameField: "WARD", pcodeField: "CODE", parentPcodeField: "PARENT", ...over });
const problem = (raw, over) => { const r = validateBoundaryLayer(raw, input(over)); assert.equal(r.ok, false, "expected a refusal"); return r.error.message; };

test("a good file is normalised to the app's own format: name, code, parent code, polygons rounded to five decimals", () => {
  const raw = file(feature({ WARD: " Kisenyi ", CODE: "UG0101", PARENT: "UG01", EXTRA: "ignored" }, sq(32.123456789, 0.3)), feature({ WARD: "Nakawa", CODE: 2, PARENT: "UG01" }, sq(32.5, 0.3)));
  const r = validateBoundaryLayer(raw, input());
  assert.equal(r.ok, true);
  assert.deepEqual([r.value.iso, r.value.adminLevel, r.value.name, r.value.featureCount], ["UGA", 4, "kampala-wards", 2]);
  const out = JSON.parse(r.value.json);
  assert.deepEqual(out.features[0].properties, { name: "Kisenyi", id: "UG0101", parentId: "UG01" });
  assert.equal(out.features[1].properties.id, "2");
  assert.deepEqual(out.features[0].geometry.coordinates[0][0], [32.12346, 0.3]);
  assert.equal(JSON.stringify(out).includes("EXTRA"), false);
});

test("a file with no code columns is fine: ids are empty and the names carry the join", () => {
  const r = validateBoundaryLayer(file(feature({ WARD: "A" }), feature({ WARD: "A" }, sq(40, 2))), input({ pcodeField: null, parentPcodeField: undefined }));
  assert.equal(r.ok, true);
  assert.deepEqual(JSON.parse(r.value.json).features.map((f) => f.properties.id), ["", ""]);
});

test("any bad feature blocks the whole file and is named", () => {
  assert.match(problem(file(feature({ WARD: "A", CODE: "1" }), feature({ CODE: "2" }))), /Boundary 2 has no value in "WARD"/);
  assert.match(problem(file(feature({ WARD: "A", CODE: "1" }), feature({ WARD: "B" }))), /Boundary 2 \(B\) has no value in "CODE"/);
  assert.match(problem(file(feature({ WARD: "A", CODE: "1" }), feature({ WARD: "B", CODE: "1" }))), /code 1 is used by two boundaries: A and B/);
  assert.match(problem(file(feature({ WARD: "A", CODE: "1" }, { type: "Point", coordinates: [1, 1] }))), /Boundary 1 \(A\) is not a polygon/);
  assert.match(problem(file(feature({ WARD: "A", CODE: "1" }, sq(179.5, 0, 2)))), /outside the map/);
  assert.match(problem(file(feature({ WARD: "A", CODE: "1" }, { type: "Polygon", coordinates: [] }))), /no shape drawn|is not a polygon/);
});

test("the country, the level and the name column are required and checked", () => {
  const raw = file(feature({ WARD: "A", CODE: "1" }));
  assert.match(problem(raw, { iso: "UG" }), /three-letter code/);
  assert.match(problem(raw, { countryName: " " }), /country's name/);
  assert.match(problem(raw, { adminLevel: 0 }), /which level/);
  assert.match(problem(raw, { adminLevel: 5 }), /which level/);
  assert.match(problem(raw, { nameField: "" }), /column that holds each boundary's name/);
});

test("the file itself: JSON, a FeatureCollection with something in it, within the size and count limits", () => {
  assert.match(problem("not json"), /not valid JSON/);
  assert.match(problem(JSON.stringify({ type: "Feature" })), /FeatureCollection/);
  assert.match(problem(file()), /at least one boundary/);
  assert.match(problem(file(feature({ WARD: "A", CODE: "1" })).padEnd(13 * 1024 * 1024, " ")), /too large/);
  assert.equal(BOUNDARY_LAYER_MAX_FEATURES, 20000);
});

test("field guide: finds the columns, suggests name, code and parent for the level, and shows a sample", () => {
  const raw = file(feature({ ADM4_EN: "Kisenyi", ADM4_PCODE: "UG0101", ADM3_PCODE: "UG01", AREA: 4.2 }), feature({ ADM4_EN: "Nakawa", ADM4_PCODE: "UG0102", ADM3_PCODE: "UG01", AREA: 1 }));
  const g = guideBoundaryFields(raw, 4);
  assert.equal(g.ok, true);
  assert.deepEqual(g.value.fields, ["ADM4_EN", "ADM4_PCODE", "ADM3_PCODE", "AREA"]);
  assert.deepEqual(g.value.suggested, { nameField: "ADM4_EN", pcodeField: "ADM4_PCODE", parentPcodeField: "ADM3_PCODE" });
  assert.deepEqual(g.value.sample[0], { ADM4_EN: "Kisenyi", ADM4_PCODE: "UG0101", ADM3_PCODE: "UG01", AREA: "4.2" });
  assert.equal(g.value.featureCount, 2);
  const geo = guideBoundaryFields(file(feature({ shapeName: "Gulu", shapeID: "gb-1" })), 2);
  assert.deepEqual(geo.value.suggested, { nameField: "shapeName", pcodeField: "shapeID", parentPcodeField: null });
  assert.equal(guideBoundaryFields(file(feature({ foo: "x" })), 2).value.suggested.nameField, null);
  assert.equal(guideBoundaryFields("nope").ok, false);
});
