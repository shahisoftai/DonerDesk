/**
 * Photos on the map (after DevResults' "Geotagged Photos Map"): the project's image evidence, put where its location says. Pure.
 * A photo's place is read from the location written on the evidence: first the organisation's own places list (a place with a pin), then the bundled gazetteer, the
 * same words the plan map uses. A photo with a location nothing matches is listed apart; a photo with no location is counted apart. Nothing is guessed.
 */
import { normalizeLocationKey } from "@donordesk/domain/contexts/workplan/index.js";
import { resolveSitePoint, type SiteMapPoint } from "../../workplan/domain/site-map.ts";

export interface PhotoInput { id: string; title: string; fileName: string; fileType: string; fileUrl: string; storageProvider?: string | undefined; location?: string | null | undefined; activityDate?: string | undefined }
export interface PlaceWithPin { name: string; aliases: readonly string[]; latitude?: number | undefined; longitude?: number | undefined; archived?: boolean | undefined }

export const isPhoto = (e: Pick<PhotoInput, "fileType">): boolean => e.fileType.toLowerCase().startsWith("image/");

export interface PhotoSite { name: string; lat: number; lng: number; photos: PhotoInput[] }
export interface PhotoMapData {
  sites: PhotoSite[];
  /** Photos whose written location matched nothing. */
  unplaced: PhotoInput[];
  /** Photos with no location written at all. */
  withoutLocation: number;
  total: number;
}

export function photoMapData(evidence: ReadonlyArray<PhotoInput>, places: ReadonlyArray<PlaceWithPin>, country?: string): PhotoMapData {
  const photos = evidence.filter(isPhoto);
  const byKey = new Map<string, PlaceWithPin>();
  for (const p of places) {
    if (p.archived || p.latitude === undefined || p.longitude === undefined) continue;
    for (const text of [p.name, ...p.aliases]) { const k = normalizeLocationKey(text); if (k && !byKey.has(k)) byKey.set(k, p); }
  }
  const sites = new Map<string, PhotoSite>();
  const unplaced: PhotoInput[] = [];
  let withoutLocation = 0;
  for (const photo of photos) {
    const text = photo.location?.trim() ?? "";
    if (!text) { withoutLocation += 1; continue; }
    const own = byKey.get(normalizeLocationKey(text));
    const found = own ? { name: own.name, lat: own.latitude!, lng: own.longitude! } : (() => { const g = resolveSitePoint(text, country); return g ? { name: g.name, lat: g.lat, lng: g.lng } : null; })();
    if (!found) { unplaced.push(photo); continue; }
    const key = `${found.lat.toFixed(3)}|${found.lng.toFixed(3)}`;
    const site = sites.get(key) ?? { name: found.name, lat: found.lat, lng: found.lng, photos: [] };
    site.photos.push(photo);
    sites.set(key, site);
  }
  return { sites: [...sites.values()].sort((a, b) => b.photos.length - a.photos.length || a.name.localeCompare(b.name)), unplaced, withoutLocation, total: photos.length };
}

/** The dots for the map figure: one per place, bigger with more photos, worded as a count. */
export function photoPoints(d: PhotoMapData): SiteMapPoint[] {
  return d.sites.map((s) => ({
    name: s.name, lat: s.lat, lng: s.lng, worst: "DONE", risks: [],
    items: s.photos.map((p) => ({ id: p.id, title: p.title || p.fileName, signal: "DONE" as const, label: "photo" })),
  }));
}

export function photoMapSummary(d: PhotoMapData): string {
  if (d.total === 0) return "No photos have been added to this project's evidence yet.";
  const placed = d.sites.reduce((n, s) => n + s.photos.length, 0);
  const parts = [`${placed} of ${d.total} ${d.total === 1 ? "photo is" : "photos are"} on the map, at ${d.sites.length} ${d.sites.length === 1 ? "place" : "places"}.`];
  if (d.unplaced.length > 0) parts.push(`${d.unplaced.length} ${d.unplaced.length === 1 ? "has a location" : "have locations"} no place matches.`);
  if (d.withoutLocation > 0) parts.push(`${d.withoutLocation} ${d.withoutLocation === 1 ? "has" : "have"} no location written.`);
  return parts.join(" ");
}
