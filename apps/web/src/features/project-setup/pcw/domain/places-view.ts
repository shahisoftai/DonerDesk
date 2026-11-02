import type { PlaceDef } from "@donordesk/domain";
import type { SetupDraftView } from "../../../../lib/server/schemas-project-setup-draft.ts";

type PlaceItem = SetupDraftView["places"][number];

/** What a place can be, widest first. These are the same kinds the places list uses everywhere else. */
export const PLACE_LEVELS = [
  { value: 0, label: "Country" },
  { value: 1, label: "State or province" },
  { value: 2, label: "District or locality" },
  { value: 3, label: "Sub-district" },
  { value: 4, label: "Community or site" },
] as const;

export const levelLabel = (level: number | null): string => PLACE_LEVELS.find((l) => l.value === level)?.label ?? "Kind not set";

export interface PlaceRow {
  item: PlaceItem;
  place: PlaceDef;
  /** Where it sits, in words: "Gulu District, Uganda". */
  inside: string;
}

/** Each place with the chain of places it is inside, followed up the list (a loop or a missing parent simply stops). */
export function placeRows(items: readonly PlaceItem[]): PlaceRow[] {
  const byName = new Map<string, PlaceDef>();
  for (const i of items) { const p = i.value as PlaceDef; if (p.name) byName.set(p.name.trim().toLowerCase(), p); }
  return items.map((item) => {
    const place = item.value as PlaceDef;
    const chain: string[] = [];
    const seen = new Set<string>([(place.name ?? "").trim().toLowerCase()]);
    for (let up = place.parentName; up && !seen.has(up.trim().toLowerCase()) && chain.length < 6; ) {
      chain.push(up);
      seen.add(up.trim().toLowerCase());
      up = byName.get(up.trim().toLowerCase())?.parentName ?? null;
    }
    return { item, place, inside: chain.join(", ") };
  });
}

/** Places that could be this one's parent: every other place on the list that is wider than it. */
export function parentOptions(items: readonly PlaceItem[], self: PlaceDef | null, level: number | null): string[] {
  return items
    .map((i) => i.value as PlaceDef)
    .filter((p) => p.name && p !== self && (level === null || p.adminLevel === null || p.adminLevel < level))
    .map((p) => p.name as string);
}

/** The unique names of places already listed, so the gazetteer's suggestions are not offered twice. */
export function listedNames(items: readonly PlaceItem[]): Set<string> {
  return new Set(items.map((i) => ((i.value as PlaceDef).name ?? "").trim().toLowerCase()));
}
