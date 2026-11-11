/**
 * How the areas of a results map are coloured and labelled (Phase 50.3d): the figure's scale (the explorer's own), bands the author set,
 * one colour per area (or per area above it: the provinces of a district map), or outlines only. A gap is grey in every mode, never 0.
 * The category palette is the theme's colour-blind-checked series colours, in a fixed order of the areas' keys, so a map always gives
 * the same area the same colour. Pure.
 */
export type AreaColorBy = "VALUE" | "RULES" | "CATEGORY" | "NONE";
export type AreaLabels = "NONE" | "NAME" | "VALUE" | "NAME_AND_VALUE";
export interface AreaBand { from: number | null; to: number | null; color: string }
export interface AreaStyle { colorBy: AreaColorBy; bands?: readonly AreaBand[] | undefined; byParent?: boolean | undefined; palette: readonly string[]; labels?: AreaLabels | undefined }
export interface AreaLegendEntry { label: string; color: string }

export const OUTLINE_ONLY = "#f1f5f9";

export function bandColour(value: number | null, bands: readonly AreaBand[], none: string): string {
  if (value === null || !Number.isFinite(value)) return none;
  return bands.find((b) => (b.from === null || value >= b.from) && (b.to === null || value < b.to))?.color ?? none;
}

/** Each category key to a colour: sorted keys, palette in order, repeating only past its end. */
export function categoryColours(keys: readonly string[], palette: readonly string[]): Map<string, string> {
  const sorted = [...new Set(keys.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  return new Map(sorted.map((k, i) => [k, palette[i % Math.max(1, palette.length)] ?? "#94a3b8"]));
}

export function areaLabel(labels: AreaLabels | undefined, name: string, display: string | null): string | undefined {
  switch (labels ?? "NONE") {
    case "NONE": return undefined;
    case "NAME": return name;
    case "VALUE": return display ?? undefined;
    case "NAME_AND_VALUE": return display ? `${name}\n${display}` : name;
  }
}
