import type { DatasetPlace } from "./dataset-query.js";

/**
 * Places with a value as files other tools open (Phase 34.4): GeoJSON for GIS tools and KML for Google Earth and the like. Only places
 * with a pin can be put on a map, so only those are written; a place with a value and no pin is not dropped silently, the screen lists
 * it. Pure; every text is escaped for the format it goes into.
 */

export interface PlaceFileOptions { title: string; valueLabel: string; unit?: string | undefined }

const pinned = (p: DatasetPlace): p is DatasetPlace & { latitude: number; longitude: number } => p.latitude !== undefined && p.longitude !== undefined && Number.isFinite(p.latitude) && Number.isFinite(p.longitude);

/** Places a file can hold, and the ones with a value that have no pin (so the screen can say so). */
export function splitPinned(places: ReadonlyArray<DatasetPlace>): { pinned: Array<DatasetPlace & { latitude: number; longitude: number }>; unpinned: DatasetPlace[] } {
  return { pinned: places.filter(pinned), unpinned: places.filter((p) => !pinned(p) && p.value !== null) };
}

export function placesToGeoJson(places: ReadonlyArray<DatasetPlace>, options: PlaceFileOptions): string {
  const features = splitPinned(places).pinned.map((p) => ({
    type: "Feature" as const,
    // GeoJSON orders longitude first.
    geometry: { type: "Point" as const, coordinates: [p.longitude, p.latitude] },
    properties: { name: p.name, path: p.path, level: p.level, [options.valueLabel]: p.value, ...(options.unit ? { unit: options.unit } : {}), partlyReported: p.partly },
  }));
  return JSON.stringify({ type: "FeatureCollection", name: options.title, features }, null, 2);
}

const xml = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export function placesToKml(places: ReadonlyArray<DatasetPlace>, options: PlaceFileOptions): string {
  const marks = splitPinned(places).pinned.map((p) => {
    const value = p.value === null ? "no value recorded" : `${p.value}${options.unit ? ` ${options.unit}` : ""}`;
    return [
      "    <Placemark>",
      `      <name>${xml(p.name)}</name>`,
      `      <description>${xml(`${options.valueLabel}: ${value}. ${p.path}${p.partly ? ". Partly reported." : ""}`)}</description>`,
      `      <Point><coordinates>${p.longitude},${p.latitude},0</coordinates></Point>`,
      "    </Placemark>",
    ].join("\n");
  });
  return ['<?xml version="1.0" encoding="UTF-8"?>', '<kml xmlns="http://www.opengis.net/kml/2.2">', "  <Document>", `    <name>${xml(options.title)}</name>`, ...marks, "  </Document>", "</kml>", ""].join("\n");
}
