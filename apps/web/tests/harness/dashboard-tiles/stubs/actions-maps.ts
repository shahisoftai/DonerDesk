// Stand-ins for the places and plan reads a dashboard map card makes. Results differ by period so the time slider can be seen to re-read.
type H = { reads: Array<{ name: string; args: unknown[] }> };
const h = (): H => (window as unknown as { __h: H }).__h;
const ok = <T,>(value: T) => ({ ok: true as const, value });
const place = (id: string, name: string, adminLevel: number, extra: Record<string, unknown> = {}) => ({ id, name, kind: "AREA" as const, adminLevel, path: name, aliases: [], archived: false, childCount: 0, ...extra });
const places = [
  place("c", "Sudan", 0),
  place("wn", "White Nile", 1, { parentId: "c", path: "White Nile › Sudan", latitude: 13.2, longitude: 32.6 }),
  place("gz", "Gezira", 1, { parentId: "c", path: "Gezira › Sudan", latitude: 14.4, longitude: 33.5 }),
  place("kh", "Khartoum", 1, { parentId: "c", path: "Khartoum › Sudan", latitude: 15.5, longitude: 32.5 }),
];
const row = (placeId: string, name: string, value: string | null) => ({ placeId, name, path: `${name} › Sudan`, adminLevel: 1, value, verified: true, unverified: 0, contributors: 1, listedBelow: 1, partly: false });
const periods = [{ id: "p1", label: "Jan 2026" }, { id: "p2", label: "Feb 2026" }];
const rowsFor = (periodId?: string) => periodId === "p1" ? [row("wn", "White Nile", "120"), row("gz", "Gezira", null), row("kh", "Khartoum", null)] : periodId === "p2" ? [row("wn", "White Nile", "300"), row("gz", "Gezira", "80"), row("kh", "Khartoum", "40")] : [row("wn", "White Nile", "420"), row("gz", "Gezira", "80"), row("kh", "Khartoum", "40")];
export async function listPlacesForMapAction() { h().reads.push({ name: "places", args: [] }); return ok(places); }
export async function getPlaceResultsAction(projectId: string, level: number, periodId?: string) {
  h().reads.push({ name: "results", args: [projectId, level, periodId] });
  return ok({ level, levelsAvailable: [0, 1], periods, noPlaces: false, withoutLocation: [],
    indicators: [{ id: "i1", code: "OC1", name: "Children vaccinated", unit: "children", type: "NUMBER", isRate: false, rollup: { level, additive: true, rows: rowsFor(periodId), unplaced: [] } }] });
}
export async function getActivityMapAction(projectId: string) {
  h().reads.push({ name: "activities", args: [projectId] });
  const r = (id: string, title: string, location: string, signal: string) => ({ id, title, location, signal, signalLabel: "", latitude: undefined, longitude: undefined });
  return ok({ country: "Sudan", rows: [r("a1", "Vaccination day", "Rabak", "ON_TIME"), r("a2", "Training", "Kosti", "LATE"), r("a3", "Supplies", "Atlantis", "ON_TIME")] as never });
}
