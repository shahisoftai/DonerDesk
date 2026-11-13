/**
 * What a map is drawn on (Phase 51). The street map is the heaviest part of a map to draw (67 layers, 39 of them roads, for a whole region),
 * and a results map rarely needs it, so the ground is a choice:
 *
 * - STREETS: the full street and terrain map (what maps drew before; still right for pinning and drawing).
 * - SIMPLE: land, water, borders and place names only (16 layers instead of 67).
 * - COUNTRY: the simple ground with everything outside the chosen country hidden (neighbours' names, roads and borders disappear).
 * - NONE: a flat colour; only the data's own boundaries are drawn. The fastest, 
 *
 * A map with no saved choice, and a new map, use SIMPLE: the sober grey ground with land, water, borders and names (Phase 53). Pure.
 */
import type { BasemapMode } from "./model/scene.ts";

export const MAP_GROUNDS = ["STREETS", "SIMPLE", "COUNTRY", "NONE"] as const;
export type MapGround = (typeof MAP_GROUNDS)[number];
export const DEFAULT_GROUND: MapGround = "SIMPLE";
/** What a map added to a dashboard or canvas starts with. */
export const NEW_MAP_GROUND: MapGround = "SIMPLE";

export const isMapGround = (v: unknown): v is MapGround => typeof v === "string" && (MAP_GROUNDS as readonly string[]).includes(v);
export const groundOf = (v: unknown): MapGround => (isMapGround(v) ? v : DEFAULT_GROUND);

/** How a ground is drawn: the basemap mode (a flat colour for NONE), how much of the street map, and whether a country mask is wanted. */
export function groundPlan(ground: MapGround, tone: "light" | "dark"): { basemap: BasemapMode; detail: "STREETS" | "SIMPLE"; mask: boolean } {
  switch (ground) {
    case "NONE": return { basemap: "plain", detail: "SIMPLE", mask: false };
    case "SIMPLE": return { basemap: tone, detail: "SIMPLE", mask: false };
    case "COUNTRY": return { basemap: tone, detail: "SIMPLE", mask: true };
    case "STREETS": return { basemap: tone, detail: "STREETS", mask: false };
  }
}

/** The tile layers the SIMPLE ground keeps: land, water, borders and place names. */
export const SIMPLE_TILE_LAYERS: readonly string[] = ["earth", "water", "boundaries", "places"];

/** The flat colour of the ground with no street map, and what a country mask covers with (the same, so the mask is invisible against it). */
export const GROUND_COLOUR: Readonly<Record<"light" | "dark", string>> = { light: "#eef2f6", dark: "#111827" };
