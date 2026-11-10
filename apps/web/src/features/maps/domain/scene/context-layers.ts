/**
 * The context layers an organisation offers, as scene layers (Phase 49.6). Pure. Only layers switched on by the person are drawn; imagery is
 * drawn only when the organisation set an address. The credit of each layer travels with it to the map's attribution.
 */
import { CONTEXT_LAYERS, type ContextLayerKey, type MapContextSettings } from "@donordesk/domain/contexts/places/context-layers.js";
import type { ContextLayerSpec } from "../model/scene.ts";

export const IMAGERY_KEY = "IMAGERY" as const;
export type ContextToggle = ContextLayerKey | typeof IMAGERY_KEY;

/** What the layer list can offer for these settings, in drawing order (imagery lowest). */
export function offeredContext(settings: MapContextSettings | null): ContextToggle[] {
  if (!settings) return [];
  return [...(settings.imageryUrl ? [IMAGERY_KEY] : []), ...settings.layers];
}

export function contextLayers(settings: MapContextSettings | null, on: ReadonlySet<ContextToggle>, origin: string, opacity = 0.7): ContextLayerSpec[] {
  if (!settings) return [];
  const out: ContextLayerSpec[] = [];
  if (settings.imageryUrl && on.has(IMAGERY_KEY)) {
    out.push({ kind: "CONTEXT", id: "imagery", type: "imagery", url: settings.imageryUrl, opacity: 1, attribution: settings.imageryCredit ?? "Imagery chosen by your organisation" });
  }
  for (const key of settings.layers) {
    if (!on.has(key)) continue;
    const def = CONTEXT_LAYERS[key];
    out.push({
      kind: "CONTEXT", id: key.toLowerCase(), type: def.kind, url: `${origin}/tiles/${def.file}`, opacity,
      ...(def.sourceLayer ? { sourceLayer: def.sourceLayer } : {}), attribution: `${def.maker} (${def.licence}, ${def.year})`,
    });
  }
  return out;
}
