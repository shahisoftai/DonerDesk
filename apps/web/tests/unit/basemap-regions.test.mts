import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BASEMAP_REGIONS, WORLD_BASEMAP, basemapFileFor, basemapRegionFor } from "../../src/features/maps/domain/basemap/regions.ts";

const conf = JSON.parse(readFileSync(new URL("../../../../scripts/maps/basemap-regions.json", import.meta.url), "utf8"));

test("basemap: the extract script's regions and the map's regions are the same files, boxes and zooms", () => {
  const fromScript = [conf.world, ...conf.regions].map((r: { id: string; file: string; bbox: number[]; maxzoom: number }) => [r.id, r.file, r.bbox.join(","), r.maxzoom]);
  const fromMap = [WORLD_BASEMAP, ...BASEMAP_REGIONS].map((r) => [r.id, r.file, r.bounds.join(","), r.maxzoom]);
  assert.deepEqual(fromMap, fromScript);
});

test("basemap: a view a region holds gets that region; anywhere else gets the world file", () => {
  assert.equal(basemapFileFor([35, 32, 37, 34])!.id, "mena"); // Lebanon
  assert.equal(basemapFileFor([22, 44, 40, 52])!.id, "easteurope"); // Ukraine
  assert.equal(basemapFileFor([-74.5, 18, -71.6, 20.1])!.id, "caribbean"); // Haiti
  assert.equal(basemapFileFor([92, 9, 101, 28.6])!.id, "southeastasia"); // Myanmar
  assert.equal(basemapFileFor([-10, 50, 2, 59])!.id, "world"); // not a region
  assert.equal(basemapFileFor(null)!.id, "world");
  assert.equal(basemapFileFor([-180, -85, 180, 85])!.id, "world");
});

test("basemap: across two regions, or at the antimeridian, the world file is drawn rather than half a street map", () => {
  assert.equal(basemapRegionFor([40, 10, 70, 30]), null);
  assert.equal(basemapFileFor([170, -20, 190, -10])!.id, "world");
});

test("basemap: with no world file configured, an uncovered view has no file (the plain ground)", () => {
  assert.equal(basemapFileFor([-10, 50, 2, 59], BASEMAP_REGIONS, null), null);
});
