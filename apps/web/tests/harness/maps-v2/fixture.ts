import type { PlaceItem, PlaceResults } from "@/lib/server/schemas-places";

const place = (id: string, name: string, adminLevel: number, extra: Partial<PlaceItem> = {}): PlaceItem => ({ id, name, kind: "AREA", adminLevel, path: name, aliases: [], archived: false, childCount: 0, ...extra });

// Uganda with three districts, each carrying the P-code its boundary file uses (OCHA COD-AB).
export const fixturePlaces: PlaceItem[] = [
  place("uga", "Uganda", 0, { country: "Uganda" }),
  place("gulu", "Gulu", 2, { parentId: "uga", path: "Uganda › Gulu", code: "UG3074" }),
  place("arua", "Arua", 2, { parentId: "uga", path: "Uganda › Arua", code: "UG3072" }),
  place("kampala", "Kampala", 2, { parentId: "uga", path: "Uganda › Kampala", code: "UG1008" }),
  place("clinic", "Lacor Clinic", 4, { kind: "POINT", parentId: "gulu", path: "Uganda › Gulu › Lacor Clinic", latitude: 2.77, longitude: 32.27, facility: true }),
];

const row = (placeId: string, name: string, value: string | null) => ({ placeId, name, path: `Uganda › ${name}`, adminLevel: 2, value, verified: true, unverified: 0, contributors: 1, listedBelow: 1, partly: false });

export const fixtureResults: PlaceResults = {
  level: 2, levelsAvailable: [2], periods: [], noPlaces: false, withoutLocation: [],
  indicators: [{ id: "i1", code: "IND-1", name: "People reached", unit: "people", type: "NUMBER", isRate: false, rollup: { level: 2, additive: true, rows: [row("gulu", "Gulu", "1200"), row("arua", "Arua", "300"), row("kampala", "Kampala", null)], unplaced: [] } }],
};
