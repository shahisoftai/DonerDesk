import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GAZETTEER,
  type GazetteerPlace,
} from "../../src/features/workplan/domain/geo/gazetteer.ts";
import type { NamedGeoCollection } from "../../src/features/workplan/domain/geo/geo-types.ts";
import {
  SITE_SIGNAL_COLOR,
  countryView,
  normalizePlace,
  provincesOf,
  resolveSitePoint,
  siteMapData,
  siteMapOption,
  siteMapSummary,
  siteTooltip,
  suggestPlaces,
  type SitePointInput,
} from "../../src/features/workplan/domain/site-map.ts";

test("normalizePlace folds diacritics, punctuation and admin suffixes", () => {
  assert.equal(normalizePlace("Gulu District"), "gulu");
  assert.equal(normalizePlace("  Niños,  Sub-County "), "ninos");
  assert.equal(normalizePlace("Kampala Central Division"), "kampala central");
  assert.equal(normalizePlace("Zürich"), "zurich");
  assert.equal(normalizePlace("   "), "");
});

test("resolveSitePoint matches an exact name", () => {
  const place = resolveSitePoint("Kampala");
  assert.ok(place);
  assert.equal(place.name, "Kampala");
  assert.equal(place.c, "Uganda");
});

test("resolveSitePoint strips the admin suffix an officer appended", () => {
  const place = resolveSitePoint("Gulu District");
  assert.ok(place);
  assert.equal(place.name, "Gulu");
  assert.equal(place.c, "Uganda");
});

test("resolveSitePoint folds diacritics in what was typed", () => {
  const place = resolveSitePoint("Zürich");
  assert.ok(place);
  assert.equal(place.name, "Zurich");
});

test("resolveSitePoint drops trailing words until a name matches", () => {
  const place = resolveSitePoint("Kampala, Central");
  assert.ok(place);
  assert.equal(place.name, "Kampala");
  const withCountry = resolveSitePoint("Kampala Uganda");
  assert.ok(withCountry);
  assert.equal(withCountry.name, "Kampala");
});

test("the most populated place wins when several share a name", () => {
  const place = resolveSitePoint("Alexandria");
  assert.ok(place);
  assert.equal(place.c, "Egypt");
});

test("the project's country disambiguates before population does", () => {
  const place = resolveSitePoint("Alexandria", "United States");
  assert.ok(place);
  assert.equal(place.c, "United States of America");
  assert.equal(place.p1, "Virginia");
  const elsewhere = resolveSitePoint("Alexandria", "Romania");
  assert.ok(elsewhere);
  assert.equal(elsewhere.c, "Romania");
});

test("the country is a hint, not a jail: an exact match abroad still resolves", () => {
  const place = resolveSitePoint("Kampala", "Kenya");
  assert.ok(place);
  assert.equal(place.c, "Uganda");
});

test("an unknown place is null — never invented", () => {
  assert.equal(resolveSitePoint("Atlantis"), null);
  assert.equal(resolveSitePoint("   "), null);
  assert.equal(resolveSitePoint(""), null);
});

test("suggestPlaces prefers the project's country and prefixes over substrings", () => {
  const ugandan = suggestPlaces("kam", "Uganda");
  assert.ok(ugandan.length > 0);
  assert.equal(ugandan[0], "Kampala");
  const gulu = suggestPlaces("gul", "Uganda");
  assert.ok(gulu.some((s) => s === "Gulu, Aswa"));
  for (const suggestion of suggestPlaces("ka", undefined, 8)) {
    const place = resolveSitePoint(suggestion);
    assert.ok(place, `suggestion "${suggestion}" must resolve back`);
  }
});

const row = (over: Partial<SitePointInput> & { id: string }): SitePointInput => ({
  title: `Work ${over.id}`,
  location: "Kampala",
  signal: "ON_TIME",
  ...over,
});

test("rows at the same place share one pin, worst signal first", () => {
  const data = siteMapData([
    row({ id: "a", location: "Kampala", signal: "ON_TIME" }),
    row({ id: "b", location: "Kampala, Central", signal: "LATE" }),
  ]);
  assert.equal(data.points.length, 1);
  assert.equal(data.points[0].items.length, 2);
  assert.equal(data.points[0].worst, "LATE");
  assert.equal(data.unplaced.length, 0);
  assert.equal(data.counts.sites, 1);
  assert.equal(data.counts.late, 1);
});

test("a cancelled-only site is placed in grey, never counted late", () => {
  const data = siteMapData([row({ id: "c", location: "Gulu", signal: "CANCELLED" })]);
  assert.equal(data.points.length, 1);
  assert.equal(data.points[0].worst, "CANCELLED");
  assert.equal(data.counts.late, 0);
  assert.equal(data.counts.onTime, 0);
});

test("rows with no location are simply not on the map; a typed place that matches nothing is listed", () => {
  const data = siteMapData([
    row({ id: "a", location: undefined }),
    row({ id: "b", location: "   " }),
    row({ id: "c", location: "Atlantis" }),
  ]);
  assert.equal(data.points.length, 0);
  assert.deepEqual(data.unplaced, [{ id: "c", title: "Work c", location: "Atlantis" }]);
});

test("open risks attach to the site of the activity they point at; closed ones do not", () => {
  const data = siteMapData([row({ id: "a" }), row({ id: "b", location: "Gulu" })], {
    risks: [
      { title: "Flooding cut the road", plannedActivityId: "a", status: "OPEN" },
      { title: "Sorted already", plannedActivityId: "a", status: "CLOSED" },
      { title: "Nowhere to sit", plannedActivityId: undefined, status: "OPEN" },
    ],
  });
  const kampala = data.points.find((p) => p.name === "Kampala");
  const gulu = data.points.find((p) => p.name === "Gulu");
  assert.deepEqual(kampala?.risks, ["Flooding cut the road"]);
  assert.deepEqual(gulu?.risks, []);
  assert.equal(data.counts.risks, 1);
});

test("the summary sentence agrees with the counts", () => {
  const data = siteMapData([row({ id: "a", signal: "LATE" }), row({ id: "b", location: "Gulu" })]);
  assert.equal(siteMapSummary(data), "2 sites · 1 site late · 1 site on time");
  const none = siteMapData([]);
  assert.equal(siteMapSummary(none), "0 sites");
});

test("countryView centers the matched country and zooms to show it", () => {
  const world: NamedGeoCollection = {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      properties: { name: "Testland", iso: "TL" },
      geometry: { type: "Polygon", coordinates: [[[0, 0], [10, 0], [10, 6], [0, 6], [0, 0]]] },
    }],
  };
  const view = countryView(world, "Testland District");
  assert.ok(view);
  assert.equal(view.name, "Testland");
  assert.deepEqual(view.center, [5, 3]);
  assert.ok(view.zoom >= 2 && view.zoom <= 25);
  assert.equal(countryView(world, "Nowhere"), null);
});

test("provincesOf keeps only the focused country's provinces", () => {
  const admin1: NamedGeoCollection = {
    type: "FeatureCollection",
    features: [
      { type: "Feature", properties: { name: "North", iso: "TL", country: "Testland" }, geometry: null },
      { type: "Feature", properties: { name: "South", iso: "TL", country: "Testland" }, geometry: null },
      { type: "Feature", properties: { name: "Elsewhere", iso: "XX", country: "Otherland" }, geometry: null },
    ],
  };
  const provinces = provincesOf(admin1, "Testland");
  assert.ok(provinces);
  assert.deepEqual(provinces.features.map((f) => f.properties.name), ["North", "South"]);
  assert.equal(provincesOf(admin1, "Nowhere"), null);
});

const points = [
  {
    name: "Kampala", province: "Kampala", country: "Uganda", lat: 0.32, lng: 32.58,
    worst: "LATE" as const, items: [{ id: "a", title: "Work a", signal: "LATE" as const }], risks: ["Flooding cut the road"],
  },
  {
    name: "Gulu", country: "Uganda", lat: 2.78, lng: 32.28,
    worst: "ON_TIME" as const, items: [{ id: "b", title: "Work b", signal: "ON_TIME" as const }], risks: [],
  },
];

test("siteMapOption colors each pin with its site's signal and plots [lng, lat]", () => {
  const option = siteMapOption(points);
  const series = option.series as Array<Record<string, unknown>>;
  assert.equal(series.length, 1);
  assert.equal(series[0].type, "scatter");
  const data = series[0].data as Array<Record<string, unknown>>;
  assert.deepEqual(data[0].value, [32.58, 0.32]);
  assert.deepEqual(data[1].value, [32.28, 2.78]);
  const style = (point: Record<string, unknown>) => (point.itemStyle as { color: string }).color;
  assert.equal(style(data[0]), SITE_SIGNAL_COLOR.LATE);
  assert.equal(style(data[1]), SITE_SIGNAL_COLOR.ON_TIME);
  const geo = option.geo as Record<string, unknown>;
  assert.equal(geo.map, "donordesk-world");
  assert.equal(typeof option.tooltip, "object");
  assert.equal(typeof (option.tooltip as { formatter?: unknown }).formatter, "function");
});

test("the province overlay is a series bound to the same geo, only when the country is focused", () => {
  const withProvinces = siteMapOption(points, {
    focus: { name: "Uganda", center: [32, 1], zoom: 12 },
    provinces: { type: "FeatureCollection", features: [{ type: "Feature", properties: { name: "Aswa", iso: "UG", country: "Uganda" }, geometry: null }] },
  });
  const series = withProvinces.series as Array<Record<string, unknown>>;
  assert.equal(series[0].type, "map");
  assert.equal(series[0].map, "donordesk-provinces");
  assert.equal(series[0].geoIndex, 0);
  assert.equal(series[1].type, "scatter");
  const geo = withProvinces.geo as { regions?: Array<{ name: string }>; center?: [number, number]; zoom?: number };
  assert.deepEqual(geo.regions?.[0]?.name, "Uganda");
  assert.deepEqual(geo.center, [32, 1]);
  assert.equal(geo.zoom, 12);
});

test("the tooltip escapes officer-typed words before they become HTML", () => {
  const hostile = {
    name: "Kampala", country: "Uganda", lat: 0.32, lng: 32.58,
    worst: "LATE" as const,
    items: [{ id: "a", title: '<img src=x onerror=alert(1)> outreach', signal: "LATE" as const }],
    risks: ['<script>alert("risk")</script>'],
  };
  const html = siteTooltip({ data: { site: hostile } });
  assert.ok(!html.includes("<img"), "item title must not inject tags");
  assert.ok(!html.includes("<script>"), "risk title must not inject tags");
  assert.ok(html.includes("&lt;img"));
  assert.ok(html.includes("alert(1)"));
});

test("countryView focuses the largest polygon, not an antimeridian fragment or an overseas territory", () => {
  const split: NamedGeoCollection = {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      properties: { name: "Russia", iso: "RU" },
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [[[179, 65], [180, 65], [179, 66], [179, 65]]], // tiny fragment past the dateline
          [[[30, 50], [140, 50], [140, 70], [30, 70], [30, 50]]], // the mainland
        ],
      },
    }],
  };
  const view = countryView(split, "Russia");
  assert.ok(view);
  assert.equal(view.name, "Russia");
  assert.deepEqual(view.center, [85, 60]);
});

test("a hand-placed row plots exactly where it was pinned, no name matching", () => {
  const data = siteMapData([row({ id: "a", location: "Atlantis Valley", latitude: -1.2345, longitude: 36.789 })]);
  assert.equal(data.points.length, 1);
  assert.equal(data.unplaced.length, 0);
  assert.equal(data.points[0].lat, -1.2345);
  assert.equal(data.points[0].lng, 36.789);
  assert.equal(data.points[0].name, "Atlantis Valley");
});

test("a pinned row with no text names itself from the copy table", () => {
  const data = siteMapData([row({ id: "a", location: undefined, latitude: 5, longitude: 6 })]);
  assert.equal(data.points.length, 1);
  assert.equal(data.points[0].name, "Pinned place");
});

test("pinned rows at the same spot share one pin; a half pin falls back to the text rules", () => {
  const data = siteMapData([
    row({ id: "a", location: "Riverside camp", latitude: -1.2, longitude: 36.7 }),
    row({ id: "b", location: "Riverside camp (north side)", latitude: -1.2, longitude: 36.7, signal: "LATE" }),
    row({ id: "c", location: "Atlantis", latitude: -1.2, longitude: undefined }),
  ]);
  assert.equal(data.points.length, 1);
  assert.equal(data.points[0].items.length, 2);
  assert.equal(data.points[0].worst, "LATE");
  assert.deepEqual(data.unplaced, [{ id: "c", title: "Work c", location: "Atlantis" }]);
});

test("siteMapOption draws the workspace's own layer as the base and leaves the bundled layers out", () => {
  const withCustom = siteMapOption(points, { baseMap: "donordesk-custom", provinces: { type: "FeatureCollection", features: [{ type: "Feature", properties: { name: "Aswa", iso: "UG", country: "Uganda" }, geometry: null }] } });
  const geo = withCustom.geo as { map: string };
  assert.equal(geo.map, "donordesk-custom");
  const series = withCustom.series as Array<Record<string, unknown>>;
  assert.equal(series.length, 1, "no province overlay over a custom layer");
  assert.equal(series[0].type, "scatter");
});

test("province outlines draw prominently over the world base", () => {
  const option = siteMapOption(points, {
    provinces: { type: "FeatureCollection", features: [{ type: "Feature", properties: { name: "Aswa", iso: "UG", country: "Uganda" }, geometry: null }] },
  });
  const series = option.series as Array<Record<string, unknown>>;
  assert.equal(series[0].type, "map");
  const style = series[0].itemStyle as { borderColor: string; borderWidth: number };
  assert.equal(style.borderWidth, 1);
  assert.notEqual(style.borderColor, "#64748b");
});

test("the tooltip names the site, its work and its open risks", () => {
  const html = siteTooltip({ data: { site: points[0] } });
  assert.ok(html.includes("Kampala"));
  assert.ok(html.includes("Work a — Late"));
  assert.ok(html.includes("Flooding cut the road"));
  assert.equal(siteTooltip({}), "");
});

test("every pin color is decided for every signal", () => {
  assert.deepEqual(Object.keys(SITE_SIGNAL_COLOR).sort(), ["CANCELLED", "DONE", "LATE", "ON_TIME"]);
});

test("the bundled gazetteer is sane: coordinates in range, names present, no duplicate places", () => {
  assert.ok(GAZETTEER.length > 5000);
  const seen = new Set<string>();
  for (const place of GAZETTEER as readonly GazetteerPlace[]) {
    assert.ok(place.name.length > 0);
    assert.ok(place.lat >= -90 && place.lat <= 90, `${place.name} lat ${place.lat}`);
    assert.ok(place.lng >= -180 && place.lng <= 180, `${place.name} lng ${place.lng}`);
    assert.ok(place.pop >= 0);
    const key = `${normalizePlace(place.name)}|${normalizePlace(place.c)}|${normalizePlace(place.p1 ?? "")}`;
    assert.ok(!seen.has(key), `duplicate place: ${key}`);
    seen.add(key);
  }
});

test("resolveSitePoint reads another transliteration of the same town as that town", () => {
  assert.equal(resolveSitePoint("Ed Damazin", "Sudan")?.name, "Ad Damazin");
  assert.equal(resolveSitePoint("Damazin", "Sudan")?.name, "Ad Damazin");
  assert.equal(resolveSitePoint("Bur Sudan", "Sudan")?.name, "Port Sudan");
  assert.equal(resolveSitePoint("Sinja", "Sudan"), null);
});
