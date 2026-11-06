import test from "node:test";
import assert from "node:assert/strict";
import { portfolioMapData, portfolioMapSummary, type PortfolioMapProject } from "../../src/features/dashboard/domain/portfolio-map.ts";

const row = (id: string, o: Partial<PortfolioMapProject["rows"][number]> = {}) => ({ id, title: `Activity ${id}`, location: undefined, latitude: 9.03, longitude: 38.74, signal: "ON_TIME" as const, ...o });
const project = (projectId: string, band: PortfolioMapProject["band"], rows: PortfolioMapProject["rows"]): PortfolioMapProject => ({ projectId, title: `Project ${projectId}`, country: "Ethiopia", band, rows });

test("two projects at the same place are one dot; its colour is the worst band and the words name each project", () => {
  const d = portfolioMapData([project("a", "ON_TRACK", [row("1")]), project("b", "OFF_TRACK", [row("2")])]);
  assert.equal(d.points.length, 1);
  assert.equal(d.points[0]!.worst, "LATE");
  assert.deepEqual(d.points[0]!.items.map((i) => [i.title, i.label]), [["Project a", "On track"], ["Project b", "Behind"]]);
});

test("a project with no plan, no place or an unknown place is listed apart with the reason, never placed at a guess", () => {
  const d = portfolioMapData([
    project("a", "NO_PLAN", []),
    project("b", "ON_TRACK", [row("1", { latitude: undefined, longitude: undefined })]),
    project("c", "ON_TRACK", [row("2", { latitude: undefined, longitude: undefined, location: "Zzzzqx Nowhereville" })]),
    project("d", "ON_TRACK", [row("3")]),
  ]);
  assert.equal(d.points.length, 1);
  assert.deepEqual(d.notOnMap.map((n) => [n.projectId, n.reason]), [["a", "No planned work yet"], ["b", "Its planned work has no place"], ["c", "Its places match no known place"]]);
  assert.match(portfolioMapSummary(d, 4), /1 of 4 projects are on the map, at 1 place\. 3 are listed below/);
});

test("cancelled work does not put a project on the map, and a project is counted once however many places it has", () => {
  const d = portfolioMapData([project("a", "ON_TRACK", [row("1", { signal: "CANCELLED" })]), project("b", "AT_RISK", [row("2"), row("3", { latitude: 6.0, longitude: 37.5 })])]);
  assert.deepEqual(d.notOnMap.map((n) => n.projectId), ["a"]);
  assert.equal(d.points.length, 2);
  assert.equal(d.placedProjects, 1);
});
