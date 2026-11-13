/**
 * Which controls a map shows at first and which wait behind "More options" (Phase 53.3). One table, read by the explorer, the dashboard
 * card and the studio, so a control is in exactly one group and a new one is one row. A person who just wants a map sees BASIC only. Pure.
 */
export type MapOptionKey =
  | "indicator" | "period" | "places" | "legend" | "table"
  | "ground" | "layers" | "contextLayers" | "analysis" | "overlay" | "compare" | "print" | "downloads";
export type MapOptionGroup = "BASIC" | "MORE";

export const MAP_OPTION_GROUPS: Readonly<Record<MapOptionKey, MapOptionGroup>> = {
  indicator: "BASIC", period: "BASIC", places: "BASIC", legend: "BASIC", table: "BASIC",
  ground: "MORE", layers: "MORE", contextLayers: "MORE", analysis: "MORE", overlay: "MORE", compare: "MORE", print: "MORE", downloads: "MORE",
};

export const optionsIn = (group: MapOptionGroup): MapOptionKey[] =>
  (Object.keys(MAP_OPTION_GROUPS) as MapOptionKey[]).filter((k) => MAP_OPTION_GROUPS[k] === group);
export const isBasic = (key: MapOptionKey): boolean => MAP_OPTION_GROUPS[key] === "BASIC";
