import test from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { overlayFileToGeoJson } from "../../src/features/maps/domain/kml-to-geojson.ts";
import { readDbfNames, readShp } from "../../src/features/maps/domain/shapefile-to-geojson.ts";

function shp(records: Buffer[]): Buffer {
  const head = Buffer.alloc(100); head.writeInt32BE(9994, 0); head.writeInt32LE(1000, 28);
  const recs = records.map((body, i) => { const h = Buffer.alloc(8); h.writeInt32BE(i + 1, 0); h.writeInt32BE(body.length / 2, 4); return Buffer.concat([h, body]); });
  const all = Buffer.concat([head, ...recs]); all.writeInt32BE(all.length / 2, 24); return all;
}
const pointRec = (x: number, y: number) => { const b = Buffer.alloc(20); b.writeInt32LE(1, 0); b.writeDoubleLE(x, 4); b.writeDoubleLE(y, 12); return b; };
function polyRec(type: 3 | 5, rings: Array<Array<[number, number]>>): Buffer {
  const pts = rings.flat(); const b = Buffer.alloc(44 + rings.length * 4 + pts.length * 16);
  b.writeInt32LE(type, 0); b.writeInt32LE(rings.length, 36); b.writeInt32LE(pts.length, 40);
  let s = 0; rings.forEach((r, i) => { b.writeInt32LE(s, 44 + i * 4); s += r.length; });
  pts.forEach(([x, y], i) => { b.writeDoubleLE(x, 44 + rings.length * 4 + i * 16); b.writeDoubleLE(y, 52 + rings.length * 4 + i * 16); });
  return b;
}
function dbf(names: string[]): Buffer {
  const headerLen = 32 + 32 + 1, recLen = 1 + 20, h = Buffer.alloc(headerLen);
  h.writeUInt32LE(names.length, 4); h.writeUInt16LE(headerLen, 8); h.writeUInt16LE(recLen, 10);
  h.write("NAME", 32); h.write("C", 43); h[48] = 20; h[64] = 0x0d;
  return Buffer.concat([h, ...names.map((n) => Buffer.concat([Buffer.from(" "), Buffer.from(n.padEnd(20))]))]);
}
function zip(files: Record<string, Buffer>): Uint8Array {
  const locals: Buffer[] = [], centrals: Buffer[] = []; let offset = 0;
  for (const [name, data] of Object.entries(files)) {
    const nm = Buffer.from(name), body = deflateRawSync(data);
    const l = Buffer.alloc(30); l.writeUInt32LE(0x04034b50, 0); l.writeUInt16LE(8, 8); l.writeUInt32LE(body.length, 18); l.writeUInt32LE(data.length, 22); l.writeUInt16LE(nm.length, 26);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(8, 10); c.writeUInt32LE(body.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(nm.length, 28); c.writeUInt32LE(offset, 42);
    const local = Buffer.concat([l, nm, body]); locals.push(local); centrals.push(Buffer.concat([c, nm])); offset += local.length;
  }
  const dir = Buffer.concat(centrals), eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(centrals.length, 8); eocd.writeUInt16LE(centrals.length, 10); eocd.writeUInt32LE(dir.length, 12); eocd.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, dir, eocd]));
}

const OUTER: Array<[number, number]> = [[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]]; // clockwise = outer boundary
const HOLE: Array<[number, number]> = [[2, 2], [8, 2], [8, 8], [2, 8], [2, 2]]; // counter-clockwise = hole

test("points, lines and polygons are read; a counter-clockwise ring is a hole of the outer ring before it", () => {
  const r = readShp(new Uint8Array(shp([pointRec(32.5, 13.1), polyRec(3, [[[1, 1], [2, 2]]]), polyRec(5, [OUTER, HOLE])])));
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.shapes[0], { type: "Point", coordinates: [32.5, 13.1] });
  assert.equal(r.shapes[1]!.type, "LineString");
  assert.equal(r.shapes[2]!.type, "Polygon");
  assert.equal((r.shapes[2]!.coordinates as unknown[]).length, 2, "outer ring plus one hole");
});

test("names come from the dbf's name column, record by record", () => {
  assert.deepEqual(readDbfNames(new Uint8Array(dbf(["Nile", "Camp A"])), 2), ["Nile", "Camp A"]);
  assert.deepEqual(readDbfNames(undefined, 2), ["", ""]);
});

test("a zip with .shp and .dbf becomes named GeoJSON; a projected .prj or metre coordinates are refused with the way to fix it", async () => {
  const ok = await overlayFileToGeoJson("camps.zip", zip({ "camps.shp": shp([pointRec(32.5, 13.1), pointRec(33, 14)]), "camps.dbf": dbf(["Camp A", "Camp B"]), "camps.prj": Buffer.from('GEOGCS["GCS_WGS_1984"]') }));
  assert.equal(ok.ok && ok.features, 2);
  if (ok.ok) assert.deepEqual(JSON.parse(ok.geojson).features.map((f: { properties: { name: string } }) => f.properties.name), ["Camp A", "Camp B"]);
  const prj = await overlayFileToGeoJson("camps.zip", zip({ "camps.shp": shp([pointRec(32.5, 13.1)]), "camps.prj": Buffer.from('PROJCS["WGS_1984_UTM_Zone_36N"]') }));
  assert.match((prj as { reason: string }).reason, /EPSG:4326/);
  const metres = await overlayFileToGeoJson("m.shp", new Uint8Array(shp([pointRec(500000, 1400000)])));
  assert.match((metres as { reason: string }).reason, /EPSG:4326/);
  assert.match(((await overlayFileToGeoJson("x.zip", zip({ "readme.txt": Buffer.from("hi") }))) as { reason: string }).reason, /no \.shp/);
  assert.match(((await overlayFileToGeoJson("x.shp", new Uint8Array(10))) as { reason: string }).reason, /does not look like a shapefile/);
});
