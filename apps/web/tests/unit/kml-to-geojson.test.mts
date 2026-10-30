import test from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { kmlFromKmz, kmlToGeoJson, overlayFileToGeoJson } from "../../src/features/maps/domain/kml-to-geojson.ts";

const KML = `<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document>
<Placemark><name>White &amp; Blue Nile</name><LineString><coordinates>32.5,13.1,0 32.6,13.2,0 32.7,13.3</coordinates></LineString></Placemark>
<Placemark><name><![CDATA[Camp A]]></name><Polygon><outerBoundaryIs><LinearRing><coordinates>32,13 33,13 33,14 32,13</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>
<Placemark><name>Well</name><Point><coordinates>32.55,13.15,0</coordinates></Point></Placemark>
<Placemark><name>Mixed</name><MultiGeometry><Point><coordinates>1,2</coordinates></Point><LineString><coordinates>1,2 3,4</coordinates></LineString></MultiGeometry></Placemark>
<Placemark><name>No shape</name></Placemark>
</Document></kml>`;

test("points, lines and polygon rings come through with their names; a placemark with no shape is left out", () => {
  const r = kmlToGeoJson(KML);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const f = JSON.parse(r.geojson).features;
  assert.deepEqual(f.map((x: { properties: { name: string }; geometry: { type: string } }) => [x.properties.name, x.geometry.type]), [["White & Blue Nile", "LineString"], ["Camp A", "Polygon"], ["Well", "Point"], ["Mixed", "Point"], ["Mixed", "LineString"]]);
  assert.deepEqual(f[0].geometry.coordinates[0], [32.5, 13.1], "altitude is dropped, longitude first");
});

test("a non-KML file, an empty KML and an oversize file are refused with a sentence", () => {
  assert.match((kmlToGeoJson("<html/>") as { reason: string }).reason, /does not look like a KML/);
  assert.match((kmlToGeoJson("<kml><Document/></kml>") as { reason: string }).reason, /nothing|no points/i);
  assert.match((kmlToGeoJson("<kml>" + "x".repeat(3 * 1024 * 1024 + 1)) as { reason: string }).reason, /larger than 3 MB/);
});

function zip(name: string, content: string, method: 0 | 8): Uint8Array {
  const data = Buffer.from(content), body = method === 8 ? deflateRawSync(data) : data, nm = Buffer.from(name);
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(method, 8); local.writeUInt32LE(body.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nm.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(method, 10); central.writeUInt32LE(body.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(nm.length, 28); central.writeUInt32LE(0, 42);
  const dir = Buffer.concat([central, nm]), head = Buffer.concat([local, nm, body]);
  const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10); eocd.writeUInt32LE(dir.length, 12); eocd.writeUInt32LE(head.length, 16);
  return new Uint8Array(Buffer.concat([head, dir, eocd]));
}

test("a KMZ (deflated or stored) is unpacked and read; one with no KML is refused", async () => {
  for (const method of [8, 0] as const) {
    const k = await kmlFromKmz(zip("doc.kml", KML, method));
    assert.equal(k.ok, true);
    const g = await overlayFileToGeoJson("rivers.kmz", zip("doc.kml", KML, method));
    assert.equal(g.ok && g.features, 5);
  }
  const none = await kmlFromKmz(zip("readme.txt", "hi", 0));
  assert.match((none as { reason: string }).reason, /no KML inside/);
  assert.match(((await kmlFromKmz(new Uint8Array(40))) as { reason: string }).reason, /does not look like a KMZ/);
});

test("GeoJSON passes through and other file types are refused by name", async () => {
  assert.equal((await overlayFileToGeoJson("a.geojson", new TextEncoder().encode("{}"))).ok, true);
  assert.match(((await overlayFileToGeoJson("a.shp", new Uint8Array(3))) as { reason: string }).reason, /KML, KMZ or GeoJSON/);
});
