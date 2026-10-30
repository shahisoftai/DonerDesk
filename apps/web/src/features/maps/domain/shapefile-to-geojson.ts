/**
 * ESRI shapefiles to GeoJSON, in the browser, for map overlays. A shapefile arrives as a zip holding the .shp (shapes), the .dbf (names) and ideally the .prj
 * (coordinate system), or as a bare .shp. Pure bytes in, text out. Only longitude/latitude (WGS84-style) files are drawn: a projected file is refused with the way to
 * export it, never drawn in the wrong place. Points, lines, polygons (holes kept) and multipoints are read; Z and M values are ignored.
 */
import type { KmlResult } from "./kml-to-geojson.ts";
import { unzipAll } from "./kml-to-geojson.ts";

type Pos = [number, number];
const POINT = new Set([1, 11, 21]), LINE = new Set([3, 13, 23]), POLY = new Set([5, 15, 25]), MULTI = new Set([8, 18, 28]);
const PROJECTED = "That shapefile uses a projected coordinate system (metres), not longitude and latitude. In QGIS or ArcGIS, export it again as WGS 84 (EPSG:4326).";

/** Clockwise rings are outer boundaries in a shapefile; counter-clockwise ones are holes. */
const clockwise = (ring: Pos[]): boolean => { let a = 0; for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) a += (ring[i]![0] - ring[j]![0]) * (ring[i]![1] + ring[j]![1]); return a > 0; };

export function readShp(bytes: Uint8Array): { ok: true; shapes: Array<{ type: string; coordinates: unknown } | null> } | { ok: false; reason: string } {
  if (bytes.length < 100) return { ok: false, reason: "That does not look like a shapefile." };
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (v.getInt32(0, false) !== 9994) return { ok: false, reason: "That does not look like a shapefile." };
  const shapes: Array<{ type: string; coordinates: unknown } | null> = [];
  let p = 100;
  while (p + 12 <= bytes.length) {
    const words = v.getInt32(p + 4, false);
    const body = p + 8, end = body + words * 2;
    if (words < 2 || end > bytes.length) break;
    const type = v.getInt32(body, true);
    const xy = (at: number): Pos => [v.getFloat64(at, true), v.getFloat64(at + 8, true)];
    if (type === 0) shapes.push(null);
    else if (POINT.has(type)) shapes.push({ type: "Point", coordinates: xy(body + 4) });
    else if (MULTI.has(type)) {
      const n = v.getInt32(body + 36, true);
      shapes.push({ type: "MultiPoint", coordinates: Array.from({ length: n }, (_, i) => xy(body + 40 + i * 16)) });
    } else if (LINE.has(type) || POLY.has(type)) {
      const nParts = v.getInt32(body + 36, true), nPts = v.getInt32(body + 40, true);
      const partsAt = body + 44, ptsAt = partsAt + nParts * 4;
      const starts = Array.from({ length: nParts }, (_, i) => v.getInt32(partsAt + i * 4, true));
      const rings: Pos[][] = starts.map((s, i) => { const e = i + 1 < nParts ? starts[i + 1]! : nPts; return Array.from({ length: e - s }, (_, k) => xy(ptsAt + (s + k) * 16)); });
      if (LINE.has(type)) shapes.push(rings.length === 1 ? { type: "LineString", coordinates: rings[0] } : { type: "MultiLineString", coordinates: rings });
      else {
        const polys: Pos[][][] = [];
        for (const r of rings) { if (clockwise(r) || polys.length === 0) polys.push([r]); else polys[polys.length - 1]!.push(r); }
        shapes.push(polys.length === 1 ? { type: "Polygon", coordinates: polys[0] } : { type: "MultiPolygon", coordinates: polys });
      }
    } else return { ok: false, reason: "That shapefile holds a kind of shape this page cannot draw." };
    p = end;
  }
  return { ok: true, shapes };
}

/** The first text column named like a name (else the first text column) of each record. */
export function readDbfNames(bytes: Uint8Array | undefined, count: number): string[] {
  const none = Array.from({ length: count }, () => "");
  if (!bytes || bytes.length < 33) return none;
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const records = v.getUint32(4, true), headerLen = v.getUint16(8, true), recLen = v.getUint16(10, true);
  const fields: Array<{ name: string; type: string; len: number; at: number }> = [];
  let at = 1;
  for (let p = 32; p + 32 <= headerLen && bytes[p] !== 0x0d; p += 32) {
    const name = new TextDecoder().decode(bytes.subarray(p, p + 11)).replace(/\0.*$/, "");
    const len = bytes[p + 16]!;
    fields.push({ name, type: String.fromCharCode(bytes[p + 11]!), len, at });
    at += len;
  }
  const text = fields.filter((f) => f.type === "C");
  const pick = text.find((f) => /^(name|nom|nombre|label|title)$/i.test(f.name)) ?? text.find((f) => /name/i.test(f.name)) ?? text[0];
  if (!pick) return none;
  return Array.from({ length: count }, (_, i) => i >= records ? "" : new TextDecoder().decode(bytes.subarray(headerLen + i * recLen + pick.at, headerLen + i * recLen + pick.at + pick.len)).trim());
}

const inRange = (c: unknown): boolean => Array.isArray(c) ? (typeof c[0] === "number" ? Math.abs(c[0] as number) <= 180 && Math.abs((c[1] as number)) <= 90 : c.every(inRange)) : true;

export async function shapefileToGeoJson(name: string, bytes: Uint8Array): Promise<KmlResult> {
  let shp = bytes, dbf: Uint8Array | undefined, prj = "";
  if (/\.zip$/i.test(name)) {
    const z = await unzipAll(bytes);
    if (!z.ok) return z;
    const find = (ext: string) => [...z.files.entries()].find(([n]) => n.toLowerCase().endsWith(ext) && !n.startsWith("__MACOSX"))?.[1];
    const found = find(".shp");
    if (!found) return { ok: false, reason: "That zip has no .shp file inside it." };
    shp = found; dbf = find(".dbf"); prj = new TextDecoder().decode(find(".prj") ?? new Uint8Array());
  }
  if (/PROJCS\[/i.test(prj)) return { ok: false, reason: PROJECTED };
  const read = readShp(shp);
  if (!read.ok) return read;
  const names = readDbfNames(dbf, read.shapes.length);
  const features = read.shapes.flatMap((g, i) => (g ? [{ type: "Feature", properties: names[i] ? { name: names[i] } : {}, geometry: g }] : []));
  if (features.length === 0) return { ok: false, reason: "That shapefile has no shapes to draw." };
  if (!features.every((f) => inRange((f.geometry as { coordinates: unknown }).coordinates))) return { ok: false, reason: PROJECTED };
  return { ok: true, geojson: JSON.stringify({ type: "FeatureCollection", features }), features: features.length };
}
