"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { useColorMode } from "../../design/presentation/use-color-mode";
import { judgeShape, type DrawnShape, type ShapeVerdict } from "../domain/marking/area-rules";
import { geometryBounds } from "../domain/model/bounds";
import type { Bounds } from "../domain/model/scene";
import type { DrawingTool } from "../ports/drawing-tool";
import { useMapServices } from "./MapServices";
import { useMapText } from "./useMapText";

type Mode = "IDLE" | "OUTLINE" | "ROUTE" | "EDIT";
interface Scene { focus: Bounds | null; outline: unknown | null }

/**
 * Draw one outline or route on a real map, then move its corners. It reports the shape and the domain's verdict on it (the same check
 * the server runs); it saves nothing. A shape that strays outside its parent is a warning, never a refusal.
 */
export function AreaDrawer({ value, onChange, country, parent, onFailed, height = "h-72" }: {
  value: DrawnShape | null;
  onChange: (shape: DrawnShape | null, verdict: ShapeVerdict | null) => void;
  /** Opens the map on this country and outlines its provinces. */
  country?: string | undefined;
  /** The parent area's own outline: drawn dashed as a guide, and the shape is compared with it. */
  parent?: { name: string; geometry: unknown } | null | undefined;
  onFailed: () => void;
  height?: string;
}) {
  const services = useMapServices();
  const { t, lang, shapeProblem } = useMapText();
  const dark = useColorMode() === "dark";
  const box = useRef<HTMLDivElement>(null);
  const tool = useRef<DrawingTool | null>(null);
  const [scene, setScene] = useState<Scene | null>(null);
  const [mode, setMode] = useState<Mode>("IDLE");
  const emitted = useRef<DrawnShape | null>(value);
  const latest = useRef({ value, parent, onChange });
  latest.current = { value, parent, onChange };
  const verdict = judgeShape(value, parent ?? null);

  // Where to open: the shape itself if there is one, else the country.
  useEffect(() => {
    let live = true;
    void (async () => {
      const shapeBox = value ? geometryBounds(value) : null;
      if (!country || shapeBox) { if (live) setScene({ focus: shapeBox ?? (parent ? geometryBounds(parent.geometry) : null), outline: null }); return; }
      const world = (await services.boundaries.load(null, 0)) ?? [];
      const home = world.find((u) => u.name.toLowerCase() === country.toLowerCase());
      const provinces = await services.boundaries.load({ name: country }, 1);
      if (!live) return;
      setScene({
        focus: (parent ? geometryBounds(parent.geometry) : null) ?? (home ? geometryBounds(home.geometry) : null),
        outline: provinces ? { type: "FeatureCollection", features: provinces.map((u) => ({ type: "Feature", properties: { name: u.name }, geometry: u.geometry })) } : null,
      });
    })().catch(() => { if (live) setScene({ focus: null, outline: null }); });
    return () => { live = false; };
    // Opened once per country and parent; a shape moving must not reopen the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, parent?.name, services]);

  useEffect(() => {
    if (!scene || !box.current) return;
    let disposed = false;
    services.createDrawingTool(box.current, { basemap: dark ? "dark" : "light", focus: scene.focus, outline: scene.outline, guide: parent?.geometry ?? null, lang })
      .then((t) => {
        if (disposed) { t.dispose(); return; }
        tool.current = t;
        t.onChange((shape) => {
          emitted.current = shape;
          if (shape) setMode((m) => (m === "OUTLINE" || m === "ROUTE" ? "IDLE" : m));
          latest.current.onChange(shape, judgeShape(shape, latest.current.parent ?? null));
        });
        t.load(latest.current.value);
      })
      .catch(() => { if (!disposed) onFailed(); });
    return () => { disposed = true; tool.current?.dispose(); tool.current = null; };
    // The tool lives as long as the scene and the colour mode; the shape is shown by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, dark, lang, services]);

  // A shape that arrives from outside (loaded from the server) is shown; one the tool itself just reported is not drawn again.
  useEffect(() => {
    if (value !== emitted.current) { emitted.current = value; tool.current?.load(value); }
  }, [value]);

  function begin(kind: "OUTLINE" | "ROUTE") { setMode(kind); tool.current?.start(kind); }
  function toggleEdit() {
    if (mode === "EDIT") { tool.current?.stop(); setMode("IDLE"); return; }
    tool.current?.edit();
    setMode("EDIT");
  }
  function removeShape() { tool.current?.remove(); setMode("IDLE"); }

  const help = mode === "OUTLINE" ? t("maps.draw.help.outline") : mode === "ROUTE" ? t("maps.draw.help.route") : mode === "EDIT" ? t("maps.draw.help.edit") : t("maps.draw.help.idle");
  return (
    <div className="space-y-2 rounded-lg border border-slate-200 p-2 dark:border-white/10">
      <div ref={box} className={`${height} w-full overflow-hidden rounded-md`} role="application" aria-label={t("maps.draw.mapLabel")} />
      <p className="text-xs text-slate-500 dark:text-slate-400" data-testid="draw-help">{help}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary" aria-pressed={mode === "OUTLINE"} onClick={() => begin("OUTLINE")}>{t("maps.draw.outline")}</button>
        <button type="button" className="btn-secondary" aria-pressed={mode === "ROUTE"} onClick={() => begin("ROUTE")}>{t("maps.draw.route")}</button>
        <button type="button" className="btn-secondary" aria-pressed={mode === "EDIT"} disabled={!value} onClick={toggleEdit}>{mode === "EDIT" ? t("maps.draw.doneEditing") : t("maps.draw.edit")}</button>
        <button type="button" className="btn-secondary" disabled={!value} onClick={removeShape}>{t("maps.draw.remove")}</button>
      </div>
      {verdict && !verdict.ok && <p role="alert" className="text-sm text-danger-600" data-testid="shape-problem">{shapeProblem(verdict.code, verdict.params, verdict.message)}</p>}
      {verdict && verdict.ok && <p className="text-xs text-slate-600 dark:text-slate-300" data-testid="shape-summary">{t(verdict.kind === "POLYGON" ? "maps.draw.summary.outline" : "maps.draw.summary.route", { count: verdict.vertices })}</p>}
      {verdict && verdict.ok && verdict.outside && <p role="status" className="text-xs text-amber-700 dark:text-amber-300" data-testid="shape-warning">{t("maps.draw.warning", { name: verdict.outside.name, count: verdict.outside.count })}</p>}
    </div>
  );
}
