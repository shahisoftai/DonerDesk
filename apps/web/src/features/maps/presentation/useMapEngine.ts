"use client";

import { useEffect, useState } from "react";
import { useMapServices } from "./MapServices";

/**
 * Whether this device can draw a map (Phase 49.9: there is one engine, MapLibre). "none" means no WebGL, or the map failed to start: every
 * screen then shows its table (results, sites) or typed coordinates (placing a pin), which carry the same facts. "pending" until checked.
 */
export type MapEngine = "maplibre" | "none" | "pending";

export function useMapEngine(): { engine: MapEngine; markFailed: () => void } {
  const services = useMapServices();
  const [webGl, setWebGl] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setWebGl(services.canUseWebGL()); }, [services]);
  const engine: MapEngine = failed || webGl === false ? "none" : webGl === null ? "pending" : "maplibre";
  return { engine, markFailed: () => setFailed(true) };
}
