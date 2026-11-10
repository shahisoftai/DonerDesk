"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useMemo } from "react";
import type { SiteMapPoint } from "../../workplan/domain/site-map";
import { useColorMode } from "../../design/presentation/use-color-mode";
import { buildSiteScene } from "../domain/scene/build-site-scene";
import { MapLibreCanvas } from "./MapLibreCanvas";
import { useMapServices } from "./MapServices";
import { useSiteContext } from "./useSiteContext";
import { useMapText } from "./useMapText";

/**
 * "Where we work" on the new engine: the plan's sites, the portfolio's projects or a project's photos, as dots on a real map with the
 * country's outlines under them. Read only: hover names what is there; the lists beside the map carry every fact (the map is never the only way to read it).
 */
export function SitesMap({ points, country, caption, customLayerUrl, label, onFailed }: {
  points: readonly SiteMapPoint[];
  country?: string | undefined;
  caption?: string | undefined;
  customLayerUrl?: string | undefined;
  /** What a screen reader says for the map (the caption, or the screen's own words). */
  label: string;
  onFailed: () => void;
}) {
  const services = useMapServices();
  const { lang } = useMapText();
  const dark = useColorMode() === "dark";
  const context = useSiteContext(country, customLayerUrl, services.boundaries);
  const scene = useMemo(() => buildSiteScene({ points, context, basemap: dark ? "dark" : "light", lang, label }), [points, context, dark, lang, label]);
  return (
    <figure className="my-1 rounded-lg border border-slate-200 p-3 dark:border-white/10">
      <MapLibreCanvas scene={scene} height="h-80" onSelect={() => {}} onFailed={onFailed} />
      {caption && <figcaption className="mt-2 text-xs text-slate-500 dark:text-slate-400">{caption}</figcaption>}
    </figure>
  );
}
