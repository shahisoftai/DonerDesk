import { shapefileToGeoJson } from "./shapefile-to-geojson.ts";

/**
 * KML and KMZ files to GeoJSON, in the browser, for map overlays (after DevResults' "Map Overlays": KML or KMZ, at most 3 MB, 10 MB once a KMZ is unpacked).
 * Pure text in, text out: no DOM, so the same code is tested in Node. It reads what an overlay draws -- points, lines and polygon rings with their names -- and
 * leaves styles, folders and extended data alone. A file it cannot read is refused in a sentence, never drawn half-way.
 */
export const KML_MAX_BYTES = 3 * 1024 * 1024;
export const KMZ_UNPACKED_MAX_BYTES = 10 * 1024 * 1024;

export type KmlResult = { ok: true; geojson: string; features: number } | { ok: false; reason: string };

const decode = (s: string): string =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'").replace(/&amp;/g, "&").trim();

type Pos = [number, number];
const ring = (text: string): Pos[] => {
  const out: Pos[] = [];
  for (const token of text.trim().split(/\s+/)) {
    if (!token) continue;
    const [lng, lat] = token.split(",").map(Number);
    if (lng === undefined || lat === undefined || !Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    out.push([lng, lat]);
  }
  return out;
};
const coordsIn = (block: string): Pos[] => ring(/<coordinates[^>]*>([\s\S]*?)<\/coordinates>/i.exec(block)?.[1] ?? "");

export function kmlToGeoJson(kml: string): KmlResult {
  if (Buffer_byteLength(kml) > KML_MAX_BYTES) return { ok: false, reason: "That file is larger than 3 MB. Simplify it in Google Earth first." };
  if (!/<kml[\s>]/i.test(kml)) return { ok: false, reason: "That does not look like a KML file." };
  const features: unknown[] = [];
  for (const m of kml.matchAll(/<Placemark[\s>][\s\S]*?<\/Placemark>/gi)) {
    const block = m[0];
    const name = decode(/<name[^>]*>([\s\S]*?)<\/name>/i.exec(block)?.[1] ?? "");
    const geoms: Array<{ type: string; coordinates: unknown }> = [];
    for (const g of block.matchAll(/<Point[\s>][\s\S]*?<\/Point>/gi)) { const c = coordsIn(g[0]); if (c[0]) geoms.push({ type: "Point", coordinates: c[0] }); }
    for (const g of block.matchAll(/<LineString[\s>][\s\S]*?<\/LineString>/gi)) { const c = coordsIn(g[0]); if (c.length >= 2) geoms.push({ type: "LineString", coordinates: c }); }
    for (const g of block.matchAll(/<Polygon[\s>][\s\S]*?<\/Polygon>/gi)) {
      const rings = [...g[0].matchAll(/<LinearRing[\s>][\s\S]*?<\/LinearRing>/gi)].map((r) => coordsIn(r[0])).filter((r) => r.length >= 4);
      if (rings.length > 0) geoms.push({ type: "Polygon", coordinates: rings });
    }
    const props = name ? { name } : {};
    if (geoms.length === 1) features.push({ type: "Feature", properties: props, geometry: geoms[0] });
    else if (geoms.length > 1) features.push({ type: "Feature", properties: props, geometry: { type: "GeometryCollection", geometries: geoms } });
  }
  // A GeometryCollection is split into plain features so every consumer (and the server's check) sees simple shapes.
  const flat = features.flatMap((f) => {
    const feature = f as { properties: Record<string, unknown>; geometry: { type: string; geometries?: unknown[] } };
    return feature.geometry.type === "GeometryCollection" ? (feature.geometry.geometries ?? []).map((geometry) => ({ type: "Feature", properties: feature.properties, geometry })) : [f];
  });
  if (flat.length === 0) return { ok: false, reason: "That KML has no points, lines or areas to draw." };
  return { ok: true, geojson: JSON.stringify({ type: "FeatureCollection", features: flat }), features: flat.length };
}

const Buffer_byteLength = (s: string): number => new TextEncoder().encode(s).length;

/** The first KML inside a KMZ (a zip), preferring doc.kml. Reads the zip's own directory; handles stored and deflated entries. */
export async function kmlFromKmz(bytes: Uint8Array): Promise<{ ok: true; kml: string } | { ok: false; reason: string }> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i -= 1) if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
  if (end < 0) return { ok: false, reason: "That does not look like a KMZ file." };
  const count = view.getUint16(end + 10, true);
  let p = view.getUint32(end + 16, true);
  const entries: Array<{ name: string; method: number; csize: number; usize: number; offset: number }> = [];
  for (let n = 0; n < count && p + 46 <= bytes.length; n += 1) {
    if (view.getUint32(p, true) !== 0x02014b50) break;
    const nameLen = view.getUint16(p + 28, true), extraLen = view.getUint16(p + 30, true), commentLen = view.getUint16(p + 32, true);
    entries.push({ method: view.getUint16(p + 10, true), csize: view.getUint32(p + 20, true), usize: view.getUint32(p + 24, true), offset: view.getUint32(p + 42, true), name: new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen)) });
    p += 46 + nameLen + extraLen + commentLen;
  }
  const kmls = entries.filter((e) => /\.kml$/i.test(e.name));
  const entry = kmls.find((e) => /(^|\/)doc\.kml$/i.test(e.name)) ?? kmls[0];
  if (!entry) return { ok: false, reason: "That KMZ has no KML inside it." };
  if (entry.usize > KMZ_UNPACKED_MAX_BYTES) return { ok: false, reason: "That KMZ is larger than 10 MB once unpacked. Simplify it in Google Earth first." };
  const start = entry.offset + 30 + view.getUint16(entry.offset + 26, true) + view.getUint16(entry.offset + 28, true);
  const raw = bytes.subarray(start, start + entry.csize);
  if (entry.method === 0) return { ok: true, kml: new TextDecoder().decode(raw) };
  if (entry.method !== 8) return { ok: false, reason: "That KMZ uses a compression this page cannot open." };
  try {
    const stream = new Blob([raw as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return { ok: true, kml: new TextDecoder().decode(await new Response(stream).arrayBuffer()) };
  } catch { return { ok: false, reason: "That KMZ could not be unpacked." }; }
}

/** Every file inside a zip, by name (stored or deflated entries). Refuses a zip that unpacks past `maxTotal` bytes. */
export async function unzipAll(bytes: Uint8Array, maxTotal = KMZ_UNPACKED_MAX_BYTES): Promise<{ ok: true; files: Map<string, Uint8Array> } | { ok: false; reason: string }> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i -= 1) if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
  if (end < 0) return { ok: false, reason: "That does not look like a zip file." };
  const count = view.getUint16(end + 10, true);
  let p = view.getUint32(end + 16, true);
  const files = new Map<string, Uint8Array>();
  let total = 0;
  for (let n = 0; n < count && p + 46 <= bytes.length; n += 1) {
    if (view.getUint32(p, true) !== 0x02014b50) break;
    const method = view.getUint16(p + 10, true), csize = view.getUint32(p + 20, true), usize = view.getUint32(p + 24, true), offset = view.getUint32(p + 42, true);
    const nameLen = view.getUint16(p + 28, true), extraLen = view.getUint16(p + 30, true), commentLen = view.getUint16(p + 32, true);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith("/")) continue;
    total += usize;
    if (total > maxTotal) return { ok: false, reason: "That zip is larger than 10 MB once unpacked. Simplify it first." };
    const start = offset + 30 + view.getUint16(offset + 26, true) + view.getUint16(offset + 28, true);
    const raw = bytes.subarray(start, start + csize);
    if (method === 0) files.set(name, raw);
    else if (method === 8) {
      try { files.set(name, new Uint8Array(await new Response(new Blob([raw as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer())); }
      catch { return { ok: false, reason: "That zip could not be unpacked." }; }
    } else return { ok: false, reason: "That zip uses a compression this page cannot open." };
  }
  return { ok: true, files };
}

/** Any overlay file by its name: GeoJSON is passed on as it is, KML converted, KMZ unpacked then converted. */
export async function overlayFileToGeoJson(name: string, bytes: Uint8Array): Promise<KmlResult> {
  if (/\.kmz$/i.test(name)) {
    if (bytes.length > KML_MAX_BYTES) return { ok: false, reason: "That file is larger than 3 MB. Simplify it in Google Earth first." };
    const k = await kmlFromKmz(bytes);
    return k.ok ? kmlToGeoJson(k.kml) : k;
  }
  if (/\.(zip|shp)$/i.test(name)) {
    if (bytes.length > KML_MAX_BYTES * 3) return { ok: false, reason: "That file is larger than 9 MB. Simplify it first." };
    return shapefileToGeoJson(name, bytes);
  }
  const text = new TextDecoder().decode(bytes);
  if (/\.kml$/i.test(name)) return kmlToGeoJson(text);
  if (/\.(geo)?json$/i.test(name)) return bytes.length > KML_MAX_BYTES * 2 ? { ok: false, reason: "That file is larger than 6 MB. Simplify it first." } : { ok: true, geojson: text, features: 0 };
  return { ok: false, reason: "Use a KML, KMZ, GeoJSON or shapefile (.zip) file." };
}
