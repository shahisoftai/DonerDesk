/**
 * Context layers (Phase 49.6): population, health facilities and settlements drawn under a map to orient by. Pure.
 * They are context, never results: never reported against, never shaded by an indicator, never a boundary. Every one is a self-hosted file
 * (made by a script in `scripts/maps/`, credited on /maps/sources); an organisation chooses which ones its maps offer.
 * The one exception to "nothing leaves our host" is an organisation's own imagery address: off by default, set by an administrator who is
 * told that the imagery provider sees the area being looked at.
 */

export const CONTEXT_LAYER_KEYS = ["POPULATION", "HEALTH_FACILITIES", "SETTLEMENTS"] as const;
export type ContextLayerKey = (typeof CONTEXT_LAYER_KEYS)[number];

export interface ContextLayerDef {
  key: ContextLayerKey;
  label: string;
  /** "raster": coloured cells (population per 100 m); "points": a symbol per feature. */
  kind: "raster" | "points";
  /** File under /tiles/context/ (PMTiles). */
  file: string;
  /** Layer name inside a vector file (points only). */
  sourceLayer?: string;
  maker: string;
  licence: string;
  /** SHIP: credit only; SHARE_ALIKE: a derived copy is offered under the same licence (see `licenceVerdict`). */
  verdict: "SHIP" | "SHARE_ALIKE";
  year: string;
}

export const CONTEXT_LAYERS: Readonly<Record<ContextLayerKey, ContextLayerDef>> = {
  POPULATION: { key: "POPULATION", label: "Where people live (population per 100 m)", kind: "raster", file: "context/population.pmtiles", maker: "WorldPop, University of Southampton", licence: "CC BY 4.0", verdict: "SHIP", year: "2020" },
  HEALTH_FACILITIES: { key: "HEALTH_FACILITIES", label: "Health facilities", kind: "points", file: "context/health-facilities.pmtiles", sourceLayer: "facilities", maker: "Healthsites.io and OpenStreetMap contributors", licence: "ODbL 1.0", verdict: "SHARE_ALIKE", year: "2026" },
  SETTLEMENTS: { key: "SETTLEMENTS", label: "Settlements and towns", kind: "points", file: "context/settlements.pmtiles", sourceLayer: "settlements", maker: "Humanitarian OpenStreetMap Team and OpenStreetMap contributors", licence: "ODbL 1.0", verdict: "SHARE_ALIKE", year: "2026" },
};

export interface MapContextSettings {
  /** The context layers this organisation's maps offer (each can still be switched on and off on a map). */
  layers: ContextLayerKey[];
  /** An XYZ or WMTS address of the organisation's own imagery, or null (the default: none). */
  imageryUrl: string | null;
  /** The credit the imagery provider requires, shown on the map. */
  imageryCredit: string | null;
}

export const DEFAULT_MAP_CONTEXT: MapContextSettings = { layers: [], imageryUrl: null, imageryCredit: null };

export type ImageryProblem = "NOT_HTTPS" | "NO_TILE_PLACEHOLDERS" | "HAS_CREDENTIALS" | "PRIVATE_ADDRESS" | "TOO_LONG" | "NOT_A_URL";

/** One check for an imagery address: https, a tile template ({z}/{x}/{y} or {bbox-epsg-3857}), no password in it, not a private address. */
export function imageryUrlProblem(raw: string): ImageryProblem | null {
  const text = raw.trim();
  if (text.length > 500) return "TOO_LONG";
  let url: URL;
  try { url = new URL(text.replace(/\{[^}]+\}/g, "0")); } catch { return "NOT_A_URL"; }
  if (url.protocol !== "https:") return "NOT_HTTPS";
  if (url.username || url.password) return "HAS_CREDENTIALS";
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/.test(host) || host.startsWith("[")) return "PRIVATE_ADDRESS";
  const tiles = (/\{z\}/.test(text) && /\{x\}/.test(text) && /\{y\}/.test(text)) || /\{bbox-epsg-3857\}/.test(text);
  return tiles ? null : "NO_TILE_PLACEHOLDERS";
}

/** Checks a whole settings change: known layers only, each once; a credit only with an address; the address passes `imageryUrlProblem`. */
export function checkMapContext(input: { layers?: readonly string[]; imageryUrl?: string | null; imageryCredit?: string | null }): { ok: true; value: MapContextSettings } | { ok: false; problem: ImageryProblem | "UNKNOWN_LAYER" | "CREDIT_TOO_LONG" } {
  const layers = [...new Set(input.layers ?? [])];
  if (layers.some((l) => !(CONTEXT_LAYER_KEYS as readonly string[]).includes(l))) return { ok: false, problem: "UNKNOWN_LAYER" };
  const url = input.imageryUrl?.trim() ? input.imageryUrl.trim() : null;
  if (url) { const p = imageryUrlProblem(url); if (p) return { ok: false, problem: p }; }
  const credit = url && input.imageryCredit?.trim() ? input.imageryCredit.trim() : null;
  if (credit && credit.length > 200) return { ok: false, problem: "CREDIT_TOO_LONG" };
  return { ok: true, value: { layers: CONTEXT_LAYER_KEYS.filter((k) => layers.includes(k)), imageryUrl: url, imageryCredit: credit } };
}

/** Reads stored settings defensively: anything unreadable is the default (no layers, no imagery). */
export function parseMapContext(json: string | null | undefined): MapContextSettings {
  if (!json) return DEFAULT_MAP_CONTEXT;
  try {
    const raw = JSON.parse(json) as { layers?: string[]; imageryUrl?: string | null; imageryCredit?: string | null };
    const checked = checkMapContext(raw);
    return checked.ok ? checked.value : DEFAULT_MAP_CONTEXT;
  } catch { return DEFAULT_MAP_CONTEXT; }
}
