"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import type { BasemapNote } from "../domain/basemap/regions";
import type { FeatureRef, MapScene } from "../domain/model/scene";
import type { MapRenderer } from "../ports/map-renderer";
import { useMapServices } from "./MapServices";

/**
 * Draws a scene through whichever `MapRenderer` the services provide. It decides nothing: it creates the renderer once,
 * hands it each new scene, and forwards what was chosen.
 */
export function MapLibreCanvas({ scene, onSelect, onNote, onFailed, height = "h-[28rem]" }: {
  scene: MapScene;
  onSelect: (ref: FeatureRef | null) => void;
  onNote?: (note: BasemapNote | null) => void;
  /** The renderer could not start (no WebGL, tiles blocked): the screen falls back. */
  onFailed: () => void;
  height?: string;
}) {
  const services = useMapServices();
  const box = useRef<HTMLDivElement>(null);
  const renderer = useRef<MapRenderer | null>(null);
  const latest = useRef({ scene, onSelect, onNote });
  latest.current = { scene, onSelect, onNote };

  useEffect(() => {
    let disposed = false;
    services.createRenderer(box.current!)
      .then((r) => {
        if (disposed) { r.dispose(); return; }
        renderer.current = r;
        r.onSelect((ref) => latest.current.onSelect(ref));
        // Draw first, then tell: `onNote?.(draw())` would not call draw at all when there is no onNote.
        const { note } = r.draw(latest.current.scene);
        latest.current.onNote?.(note);
      })
      // The screen falls back to the older map; the reason is logged so a map that never starts is not a silent mystery.
      .catch((error) => { if (!disposed) { console.error("MAP_START_FAILED", error instanceof Error ? error.message : error); onFailed(); } });
    return () => { disposed = true; renderer.current?.dispose(); renderer.current = null; };
    // The renderer lives as long as this canvas; scenes are drawn by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services]);

  useEffect(() => {
    if (!renderer.current) return;
    const { note } = renderer.current.draw(scene);
    latest.current.onNote?.(note);
  }, [scene]);

  // The wrapper is only a frame: the map's own canvas is the one tab stop (MapLibre moves with the arrow keys and zooms with + and -), named by the renderer.
  return <div ref={box} className={`${height} w-full overflow-hidden rounded-lg`} role="group" aria-label={scene.label} />;
}
