import assert from "node:assert/strict";
import test from "node:test";
import { coverageShare, distanceKm, nearestFacility, populationWithin, ringPolygon, ringProblem, withinRings } from "../dist/index.js";

test("distance: one degree of latitude is about 111 km; the same point is 0", () => {
  assert.ok(Math.abs(distanceKm({ lng: 30, lat: 10 }, { lng: 30, lat: 11 }) - 111.19) < 0.1);
  assert.equal(distanceKm({ lng: 30, lat: 10 }, { lng: 30, lat: 10 }), 0);
});

test("rings: 0.1 to 100 km; too close to a pole or a bad point is refused; the polygon closes and crosses the antimeridian as one shape", () => {
  assert.equal(ringProblem({ lng: 30, lat: 10 }, 0), "RADIUS_OUT_OF_RANGE");
  assert.equal(ringProblem({ lng: 30, lat: 10 }, 101), "RADIUS_OUT_OF_RANGE");
  assert.equal(ringProblem({ lng: 30, lat: 89.9 }, 50), "NEAR_POLE");
  assert.equal(ringProblem({ lng: 300, lat: 10 }, 5), "BAD_POINT");
  const ring = ringPolygon({ lng: 179.9, lat: -17 }, 50);
  assert.deepEqual(ring[0], ring.at(-1));
  assert.ok(ring.some(([lng]) => lng > 180), "unwrapped past 180, not jumping to -180");
});

test("within rings: nearest first, distance to the nearest centre; an unpinned place is counted, never placed", () => {
  const r = withinRings([{ lng: 32.5, lat: 15.5 }], 10, [
    { id: "a", name: "Near", lng: 32.55, lat: 15.5 }, { id: "b", name: "Far", lng: 33.5, lat: 15.5 }, { id: "c", name: "No pin" },
  ]);
  assert.ok(r.ok);
  assert.deepEqual(r.inside.map((x) => x.id), ["a"]);
  assert.equal(r.unpinned, 1);
});

test("nearest facility: straight line; with no facility the distance is null, never 0; the farthest site is listed first", () => {
  const sites = [{ id: "s1", name: "A", lng: 30, lat: 10 }, { id: "s2", name: "B", lng: 31, lat: 10 }];
  const none = nearestFacility(sites, []);
  assert.deepEqual(none.rows.map((r) => r.km), [null, null]);
  const some = nearestFacility(sites, [{ id: "f", name: "Clinic", lng: 30.01, lat: 10 }]);
  assert.equal(some.rows[0].siteId, "s2");
  assert.equal(some.rows[1].facilityName, "Clinic");
});

const grid = { west: 30, north: 11, cellDeg: 0.01, cols: 100, rows: 100, values: Array.from({ length: 10000 }, (_, i) => (i === 5050 ? -1 : 10)), source: "WorldPop", year: "2020" };

test("population: cells whose centre is in the ring; two rings count a cell once; no data is counted apart, never as 0", () => {
  const one = populationWithin(grid, [{ centre: { lng: 30.5, lat: 10.5 }, km: 2 }]);
  assert.ok(one.ok);
  assert.ok(one.people > 0);
  const twice = populationWithin(grid, [{ centre: { lng: 30.5, lat: 10.5 }, km: 2 }, { centre: { lng: 30.5, lat: 10.5 }, km: 2 }]);
  assert.equal(twice.people, one.people);
  assert.equal(one.cellsWithoutData, 1);
  assert.equal(one.source, "WorldPop");
});

test("population: no grid, or a ring outside it, says so", () => {
  assert.deepEqual(populationWithin(null, [{ centre: { lng: 30.5, lat: 10.5 }, km: 2 }]), { ok: false, reason: "NO_GRID" });
  assert.deepEqual(populationWithin(grid, [{ centre: { lng: 50, lat: 10.5 }, km: 2 }]), { ok: false, reason: "OUTSIDE_GRID" });
});

test("coverage: unique people reached over population; no population is null; above 100% is flagged, not hidden", () => {
  assert.deepEqual(coverageShare(250, 1000), { percent: 25, aboveHundred: false });
  assert.equal(coverageShare(250, 0), null);
  assert.equal(coverageShare(null, 1000), null);
  assert.deepEqual(coverageShare(1200, 1000), { percent: 120, aboveHundred: true });
});
