/**
 * The site map (Phase 30): what a planned activity's location text means on a map. The officer types
 * free text ("Gulu District", "Kampala"); this module matches it against a bundled gazetteer, groups
 * the plan rows into sites, colors each site with the delivery signal the plan list already shows,
 * and attaches the risks that point at it. Pure: no React, no server, no clock.
 *
 * An unmatched place is listed as unplaced — never invented, never silently dropped. All geo data is
 * bundled; a location never leaves the tenant.
 */
import { DELIVERY_SIGNAL_LABEL, WORKPLAN_COPY, normalizeLocationKey, type DeliverySignal } from "@donordesk/domain/contexts/workplan/index.js";
import { countOf } from "@donordesk/domain/core/plural.js";
import { GAZETTEER, type GazetteerPlace } from "./geo/gazetteer.ts";
import type { NamedGeoCollection } from "./geo/geo-types.ts";

/**
 * Folded, punctuation-free, admin suffixes stripped: the key every place name is matched by.
 * The one normalizer lives in the domain (`normalizeLocationKey`, Phase 31) so the map, the
 * location analytics and every breakdown roll-up agree; this alias keeps the Phase 30 name.
 */
export const normalizePlace = normalizeLocationKey;

interface GazetteerIndex {
  byName: Map<string, GazetteerPlace[]>;
  byCountry: Map<string, Set<GazetteerPlace>>;
}

let index: GazetteerIndex | undefined;

function gazetteerIndex(): GazetteerIndex {
  if (index) return index;
  const built: GazetteerIndex = { byName: new Map(), byCountry: new Map() };
  for (const place of GAZETTEER) {
    for (const name of [place.name, place.alt]) {
      if (!name) continue;
      const key = normalizePlace(name);
      if (!key) continue;
      const bucket = built.byName.get(key);
      if (bucket) bucket.push(place);
      else built.byName.set(key, [place]);
    }
    const country = built.byCountry.get(normalizePlace(place.c));
    if (country) country.add(place);
    else built.byCountry.set(normalizePlace(place.c), new Set([place]));
  }
  index = built;
  return built;
}

/** The project's country as gazetteer places: exact name, then a name that starts with it ("United States" → "United States of America"). */
function countrySetFor(country: string | undefined, index: GazetteerIndex): Set<GazetteerPlace> | undefined {
  if (!country) return undefined;
  const key = normalizePlace(country);
  if (!key) return undefined;
  const exact = index.byCountry.get(key);
  if (exact) return exact;
  for (const [name, set] of index.byCountry) {
    if (name.startsWith(key)) return set;
  }
  return undefined;
}

const mostPopulated = (places: readonly GazetteerPlace[]): GazetteerPlace => {
  // The callers pass a non-empty list (they check first), so the first entry exists.
  const best = places[0] as GazetteerPlace;
  for (const place of places) if (place.pop > best.pop) return place;
  return best;
};

/**
 * Spellings an officer types that are the same place under another transliteration of the bundled gazetteer's name
 * ("Ed Damazin" is "Ad Damazin"; Bur Sudan is Port Sudan in Arabic). Keys are normalised; only the same town, never a neighbour.
 */
const PLACE_SPELLINGS: ReadonlyMap<string, string> = new Map([
  ["ed damazin", "ad damazin"],
  ["el damazin", "ad damazin"],
  ["damazin", "ad damazin"],
  ["bur sudan", "port sudan"],
]);

/**
 * The place an officer's location text means, or `null` when nothing matches — the caller lists it
 * as unplaced. The project's country disambiguates ("Springfield" at home beats "Springfield"
 * abroad) but is not a jail: an exact match elsewhere still resolves.
 */
export function resolveSitePoint(location: string, country?: string): GazetteerPlace | null {
  const index = gazetteerIndex();
  const countrySet = countrySetFor(country, index);
  const { byName } = index;
  const resolve = (candidates: GazetteerPlace[] | undefined): GazetteerPlace | null => {
    if (!candidates?.length) return null;
    const atHome = countrySet ? candidates.filter((p) => countrySet.has(p)) : [];
    return mostPopulated(atHome.length ? atHome : candidates);
  };
  let key = normalizePlace(location);
  if (!key) return null;
  let found = resolve(byName.get(PLACE_SPELLINGS.get(key) ?? key));
  // "Kampala, Central" or "Gulu Uganda": drop trailing words until a name matches (never below one word).
  const words = key.split(" ");
  for (let end = words.length - 1; !found && end >= 1; end -= 1) {
    key = words.slice(0, end).join(" ");
    found = resolve(byName.get(PLACE_SPELLINGS.get(key) ?? key));
  }
  return found;
}

/** The most populated places whose name starts with (then contains) what was typed — plan-form suggestions. */
export function suggestPlaces(input: string, country?: string, limit = 8): string[] {
  const needle = normalizePlace(input);
  if (!needle) return [];
  const { byCountry } = gazetteerIndex();
  const home = country ? byCountry.get(normalizePlace(country)) : undefined;
  const scored: Array<{ place: GazetteerPlace; rank: number }> = [];
  for (const place of GAZETTEER) {
    const name = normalizePlace(place.name);
    const alt = place.alt ? normalizePlace(place.alt) : "";
    const rank = name.startsWith(needle) || (alt && alt.startsWith(needle)) ? 0 : name.includes(needle) || (alt && alt.includes(needle)) ? 1 : -1;
    if (rank < 0) continue;
    scored.push({ place, rank: home?.has(place) ? rank : rank + 2 });
  }
  scored.sort((a, b) => a.rank - b.rank || b.place.pop - a.place.pop);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const { place } of scored) {
    const label = place.p1 && normalizePlace(place.p1) !== normalizePlace(place.name) ? `${place.name}, ${place.p1}` : place.name;
    const dedupe = `${label}|${place.c}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push(label);
    if (out.length >= limit) break;
  }
  return out;
}

/** One pin color per signal, decided once. Labels stay with the domain's `DELIVERY_SIGNAL_LABEL`. */
export const SITE_SIGNAL_COLOR: Readonly<Record<DeliverySignal, string>> = {
  ON_TIME: "#16a34a",
  LATE: "#dc2626",
  DONE: "#2563eb",
  CANCELLED: "#94a3b8",
};

/** Worst first: a site with anything late shows late. */
const SIGNAL_PRECEDENCE: readonly DeliverySignal[] = ["LATE", "ON_TIME", "DONE", "CANCELLED"];

const worstOf = (signals: readonly DeliverySignal[]): DeliverySignal =>
  SIGNAL_PRECEDENCE.find((signal) => signals.includes(signal)) ?? "CANCELLED";

/** The plan-row fields a site needs — deliberately narrow, so the map never learns the API row. */
export interface SitePointInput {
  id: string;
  title: string;
  location?: string | undefined;
  /** A hand-placed place (both together): plotted directly, no name matching (Phase 30.1). */
  latitude?: number | undefined;
  longitude?: number | undefined;
  signal: DeliverySignal;
}

/** A coordinate pair in WGS84 range. */
export function isValidCoordinate(latitude: number | undefined, longitude: number | undefined): boolean {
  return (
    latitude !== undefined && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 &&
    longitude !== undefined && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180
  );
}

/** The risk fields a site needs — risks attach through the planned activity they point at. */
export interface SiteRiskInput {
  title: string;
  plannedActivityId?: string | undefined;
  status: "OPEN" | "CLOSED";
}

export interface SiteMapItem {
  id: string;
  title: string;
  signal: DeliverySignal;
}

export interface SiteMapPoint {
  /** The resolved place name — what the officer typed is on the items below it. */
  name: string;
  province?: string;
  country?: string;
  lat: number;
  lng: number;
  worst: DeliverySignal;
  items: SiteMapItem[];
  /** Titles of the OPEN risks raised at this site. */
  risks: string[];
}

export interface SiteMapData {
  points: SiteMapPoint[];
  /** Rows whose typed location matched no place. Shown, never dropped. (A row with no location at all is simply not on the map.) */
  unplaced: Array<{ id: string; title: string; location: string }>;
  counts: { sites: number; late: number; onTime: number; done: number; risks: number };
}

/** Plan rows in, sites out: the one place text becomes map meaning (Phase 30 §2). */
export function siteMapData(
  rows: readonly SitePointInput[],
  opts?: { risks?: readonly SiteRiskInput[]; country?: string | undefined },
): SiteMapData {
  const byPlace = new Map<string, SiteMapPoint>();
  const unplaced: Array<{ id: string; title: string; location: string }> = [];
  const pointOf = new Map<string, SiteMapPoint>();

  for (const row of rows) {
    if (isValidCoordinate(row.latitude, row.longitude)) {
      // Hand-placed: plotted exactly where the officer put it, under the words they typed.
      const key = `pin:${row.latitude!.toFixed(3)}|${row.longitude!.toFixed(3)}`;
      let point = byPlace.get(key);
      if (!point) {
        point = {
          name: row.location?.trim() || WORKPLAN_COPY.mapPinned,
          lat: row.latitude!,
          lng: row.longitude!,
          worst: row.signal,
          items: [],
          risks: [],
        };
        byPlace.set(key, point);
      }
      point.items.push({ id: row.id, title: row.title, signal: row.signal });
      point.worst = worstOf(point.items.map((i) => i.signal));
      pointOf.set(row.id, point);
      continue;
    }
    if (!row.location?.trim()) continue;
    const place = resolveSitePoint(row.location, opts?.country);
    if (!place) {
      unplaced.push({ id: row.id, title: row.title, location: row.location });
      continue;
    }
    const key = `${normalizePlace(place.name)}|${normalizePlace(place.c)}|${normalizePlace(place.p1 ?? "")}`;
    let point = byPlace.get(key);
    if (!point) {
      point = {
        name: place.name,
        province: place.p1,
        country: place.c,
        lat: place.lat,
        lng: place.lng,
        worst: row.signal,
        items: [],
        risks: [],
      };
      byPlace.set(key, point);
    }
    point.items.push({ id: row.id, title: row.title, signal: row.signal });
    point.worst = worstOf(point.items.map((i) => i.signal));
    pointOf.set(row.id, point);
  }

  for (const risk of opts?.risks ?? []) {
    if (risk.status !== "OPEN" || !risk.plannedActivityId) continue;
    pointOf.get(risk.plannedActivityId)?.risks.push(risk.title);
  }

  const points = [...byPlace.values()];
  return {
    points,
    unplaced,
    counts: {
      sites: points.length,
      late: points.filter((p) => p.worst === "LATE").length,
      onTime: points.filter((p) => p.worst === "ON_TIME").length,
      done: points.filter((p) => p.worst === "DONE").length,
      risks: points.reduce((total, p) => total + p.risks.length, 0),
    },
  };
}

/** The one sentence under the map: what the dots say, in the words of the plan list. */
/** Rows of one series (same title and place) are listed once with how many there are, so six monthly repeats are one line. */
export function groupUnplaced(unplaced: ReadonlyArray<{ id: string; title: string; location: string }>): Array<{ id: string; title: string; location: string; count: number }> {
  const groups = new Map<string, { id: string; title: string; location: string; count: number }>();
  for (const item of unplaced) {
    const key = `${item.title}|${item.location}`;
    const found = groups.get(key);
    if (found) found.count += 1;
    else groups.set(key, { ...item, count: 1 });
  }
  return [...groups.values()];
}

export function siteMapSummary(data: SiteMapData): string {
  const parts: string[] = [countOf(data.counts.sites, "site")];
  if (data.counts.late) parts.push(`${countOf(data.counts.late, "site")} late`);
  if (data.counts.onTime) parts.push(`${countOf(data.counts.onTime, "site")} on time`);
  if (data.counts.done) parts.push(`${countOf(data.counts.done, "site")} done`);
  if (data.counts.risks) parts.push(`${countOf(data.counts.risks, "risk")} open`);
  return parts.join(" · ");
}

/** Where and how close to look: the matched country's bbox center and a zoom that shows it in context. */
export interface MapFocus {
  /** The matched country's own name (for the geo highlight). */
  name: string;
  center: [number, number];
  zoom: number;
}

function collectPoints(value: unknown, into: Array<[number, number]>): void {
  if (Array.isArray(value)) {
    if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
      into.push([value[0] as number, value[1] as number]);
      return;
    }
    for (const item of value) collectPoints(item, into);
    return;
  }
  // A GeoJSON geometry object: walk its members down to the coordinate pairs.
  if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) collectPoints(item, into);
  }
}

/** The vertex count and bbox of one polygon ring (the first, outer ring). */
function polygonShape(ring: unknown): { points: number; bbox: { minLng: number; maxLng: number; minLat: number; maxLat: number } | null } {
  const coords: Array<[number, number]> = [];
  collectPoints(ring, coords);
  if (!coords.length) return { points: 0, bbox: null };
  let minLng = 180;
  let maxLng = -180;
  let minLat = 90;
  let maxLat = -90;
  for (const [lng, lat] of coords) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  return { points: coords.length, bbox: { minLng, maxLng, minLat, maxLat } };
}

/** The top-level polygons of a geometry: the one ring that matters for focusing a country. */
function outerRings(geometry: unknown): Array<unknown> {
  if (!geometry || typeof geometry !== "object") return [];
  const coordinates = (geometry as { coordinates?: unknown }).coordinates;
  if (!Array.isArray(coordinates)) return [];
  // Polygon: coordinates = [ring, ...]; MultiPolygon: coordinates = [polygon, ...].
  const looksLikeRing = (value: unknown) => Array.isArray(value) && Array.isArray(value[0]) && typeof (value[0] as unknown[])[0] === "number";
  return looksLikeRing(coordinates[0]) ? [coordinates] : coordinates;
}

export function countryView(geo: NamedGeoCollection, country: string): MapFocus | null {
  const wanted = normalizePlace(country);
  if (!wanted) return null;
  const feature = geo.features.find(
    (f) => normalizePlace(f.properties.name) === wanted || normalizePlace(f.properties.country ?? "") === wanted,
  );
  if (!feature) return null;
  // Focus the largest polygon only: the mainland, not an antimeridian fragment or an overseas territory
  // (France's mainland, not French Guiana; Russia west of the dateline, not the Chukotka sliver).
  let best = polygonShape(null);
  for (const polygon of outerRings(feature.geometry)) {
    const shape = polygonShape(polygon);
    if (shape.points > best.points) best = shape;
  }
  if (!best.bbox) return null;
  const { minLng, maxLng, minLat, maxLat } = best.bbox;
  const span = Math.max(maxLng - minLng, (maxLat - minLat) * 1.4, 0.5);
  return {
    name: feature.properties.name,
    center: [Math.round(((minLng + maxLng) / 2) * 100) / 100, Math.round(((minLat + maxLat) / 2) * 100) / 100],
    zoom: Math.min(25, Math.max(2, Math.round((360 / span) * 10) / 10)),
  };
}

/** The provinces of one country, for the overlay series (passed to `registerMap` by the component). */
export function provincesOf(admin1: NamedGeoCollection, country: string): NamedGeoCollection | null {
  const wanted = normalizePlace(country);
  if (!wanted) return null;
  const features = admin1.features.filter((f) => normalizePlace(f.properties.country ?? "") === wanted);
  return features.length ? { type: "FeatureCollection", features } : null;
}

/** Escape officer-typed words before they go into the tooltip's HTML (ECharts renders it as HTML). */
function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** One site's tooltip: the items there, their signals, and the open risks. */
export function siteTooltip(params: unknown): string {
  const data = (params as { data?: { site?: SiteMapPoint } }).data;
  const site = data?.site;
  if (!site) return "";
  const lines = [`<strong>${escapeHtml(site.name)}</strong>`];
  if (site.province || site.country) {
    lines.push(`<span style="color:#64748b">${escapeHtml([site.province, site.country].filter(Boolean).join(", "))}</span>`);
  }
  for (const item of site.items) {
    lines.push(`${escapeHtml(item.title)} — ${DELIVERY_SIGNAL_LABEL[item.signal]}`);
  }
  for (const risk of site.risks) {
    lines.push(`<span style="color:#b45309">${escapeHtml(risk)}</span>`);
  }
  return lines.join("<br/>");
}

/**
 * The ECharts option for the site map: world base (or the workspace's own uploaded layer), optional
 * province overlay, one scatter of pins.
 */
export function siteMapOption(
  points: readonly SiteMapPoint[],
  opts?: { focus?: MapFocus | null; provinces?: NamedGeoCollection | null; baseMap?: string },
): Record<string, unknown> {
  const baseMap = opts?.baseMap ?? "donordesk-world";
  const geo: Record<string, unknown> = {
    map: baseMap,
    roam: true,
    scaleLimit: { min: 0.8, max: 40 },
    layoutCenter: ["50%", "50%"],
    layoutSize: "100%",
    ...(opts?.focus ? { center: opts.focus.center, zoom: opts.focus.zoom } : {}),
    ...(opts?.focus && baseMap === "donordesk-world"
      ? {
          regions: [
            {
              name: opts.focus.name,
              itemStyle: { areaColor: "#cbd5e1", borderColor: "#475569", borderWidth: 1 },
              label: { show: false },
            },
          ],
        }
      : {}),
    itemStyle: { areaColor: "#e2e8f0", borderColor: baseMap === "donordesk-world" ? "#94a3b8" : "#64748b", borderWidth: baseMap === "donordesk-world" ? 0.5 : 0.8 },
    emphasis: { label: { show: false }, itemStyle: { areaColor: "#cbd5e1" } },
    select: { disabled: true },
  };
  const series: Array<Record<string, unknown>> = [];
  if (baseMap === "donordesk-world" && opts?.provinces && opts.provinces.features.length > 0) {
    series.push({
      type: "map",
      map: "donordesk-provinces",
      geoIndex: 0,
      silent: true,
      itemStyle: { areaColor: "rgba(0,0,0,0)", borderColor: "#475569", borderWidth: 1 },
      emphasis: { disabled: true },
      select: { disabled: true },
    });
  }
  series.push({
    type: "scatter",
    coordinateSystem: "geo",
    data: points.map((point) => ({
      name: point.name,
      value: [point.lng, point.lat],
      symbolSize: Math.min(10 + point.items.length * 2, 22),
      itemStyle: { color: SITE_SIGNAL_COLOR[point.worst] },
      site: point,
    })),
    emphasis: { scale: 1.25 },
    select: { disabled: true },
  });
  return {
    animation: false,
    tooltip: { trigger: "item", formatter: siteTooltip, confine: true },
    geo,
    series,
  };
}
