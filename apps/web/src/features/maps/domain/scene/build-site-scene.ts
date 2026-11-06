/**
 * The sites map as a scene: one dot per place, coloured by the worst delivery signal there, sized by how much happens there, with a
 * plain-text tooltip naming each item and each open risk. Pure. The same data the old figure drew (`SiteMapPoint`), so every screen that
 * shows "where we work" reads the same on either engine. Context outlines (a country, its provinces) are added by the caller as a fill layer.
 */
import { DELIVERY_SIGNAL_LABEL } from "@donordesk/domain/contexts/workplan/index.js";
import { SITE_SIGNAL_COLOR, type SiteMapPoint } from "../../../workplan/domain/site-map.ts";
import type { BasemapMode, FillLayerSpec, LayerSpec, MapScene, PinFeature, RegionFeature, Tip } from "../model/scene.ts";
import { pinTipKey } from "../model/scene.ts";
import { pointBounds, unionBounds } from "../model/bounds.ts";

/** Neutral context fill: outlines to orient by, never a result. */
export const CONTEXT_FILL = "#cbd5e1";
export const CLUSTER_AFTER = 200;
/** A lone site is shown with about this much around it (half a degree is roughly a district), not zoomed to its own street. */
export const LONE_SITE_MARGIN_DEGREES = 0.5;

const idOf = (p: SiteMapPoint): string => `${p.lat}|${p.lng}`;

export interface SiteSceneInput {
  points: readonly SiteMapPoint[];
  /** Outlines drawn under the dots (the country, its provinces, or the organisation's own layer). */
  context?: ReadonlyArray<{ ref: string; name: string; geometry: unknown }>;
  basemap: BasemapMode;
  /** The language of the map's own place names (the basemap's labels). */
  lang?: string;
  label: string;
}

export function siteTip(point: SiteMapPoint): Tip {
  const where = [point.province, point.country].filter(Boolean).join(", ");
  return {
    title: point.name,
    lines: [
      ...(where ? [where] : []),
      ...point.items.map((i) => `${i.title} — ${i.label ?? DELIVERY_SIGNAL_LABEL[i.signal]}`),
      ...point.risks,
    ],
  };
}

export function buildSiteScene(input: SiteSceneInput): MapScene {
  const layers: LayerSpec[] = [];
  const tips: Record<string, Tip> = {};
  if (input.context && input.context.length > 0) {
    const fill: FillLayerSpec = {
      kind: "FILL", opacity: 0.35, outline: true, selectedRef: null,
      features: input.context.map((c): RegionFeature => ({ ref: c.ref, name: c.name, color: CONTEXT_FILL, geometry: c.geometry })),
    };
    layers.push(fill);
  }
  const pins: PinFeature[] = input.points.map((p) => {
    tips[pinTipKey(idOf(p))] = siteTip(p);
    return { id: idOf(p), name: p.name, lng: p.lng, lat: p.lat, color: SITE_SIGNAL_COLOR[p.worst], radius: Math.min(10 + p.items.length * 2, 22) / 2 + 2 };
  });
  if (pins.length > 0) layers.push({ kind: "PINS", pins, opacity: 1, selectedId: null, cluster: pins.length > CLUSTER_AFTER });
  // The view follows the dots, not the context: a country outline must not pull the view out to the whole country for one site.
  const box = unionBounds(pins.map((p) => pointBounds(p.lng, p.lat)));
  const m = LONE_SITE_MARGIN_DEGREES;
  const bounds = box && box[0] === box[2] && box[1] === box[3] ? ([Math.max(-180, box[0] - m), Math.max(-90, box[1] - m), Math.min(180, box[2] + m), Math.min(90, box[3] + m)] as const) : box;
  return { label: input.label, basemap: input.basemap, ...(input.lang ? { lang: input.lang } : {}), bounds, layers, tips };
}
