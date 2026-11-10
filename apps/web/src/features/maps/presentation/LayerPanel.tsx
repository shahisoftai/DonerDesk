"use client";

import { layerState, type ExplorerLayer, type LayerKind } from "../domain/map-explorer";
import { useMapText } from "./useMapText";

const LABEL_KEY: Record<LayerKind, string> = { FILL: "maps.layer.FILL", SYMBOLS: "maps.layer.SYMBOLS", BOUNDARIES: "maps.layer.BOUNDARIES", OVERLAY: "maps.layer.OVERLAY" };

/** Layer list: show/hide, opacity and order. Pure view over `ExplorerLayer[]`; every change is a callback. */
export function LayerPanel({ layers, onToggle, onOpacity, onMove }: {
  layers: readonly ExplorerLayer[];
  onToggle: (id: LayerKind) => void;
  onOpacity: (id: LayerKind, value: number) => void;
  onMove: (id: LayerKind, direction: "UP" | "DOWN") => void;
}) {
  const { t } = useMapText();
  const label = (id: LayerKind) => t(LABEL_KEY[id]);
  return (
    <fieldset className="space-y-2 text-sm">
      <legend className="font-medium">{t("maps.layer.title")}</legend>
      {[...layers].reverse().map((l) => {
        const s = layerState(layers, l.id);
        return (
          <div key={l.id} className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={s.visible} onChange={() => onToggle(l.id)} /> {label(l.id)}
            </label>
            <input type="range" min={0.1} max={1} step={0.1} value={s.opacity} aria-label={t("maps.layer.opacity", { name: label(l.id) })} onChange={(e) => onOpacity(l.id, Number(e.target.value))} className="w-24" />
            <button type="button" className="rounded border px-1" aria-label={t("maps.layer.up", { name: label(l.id) })} onClick={() => onMove(l.id, "UP")}>↑</button>
            <button type="button" className="rounded border px-1" aria-label={t("maps.layer.down", { name: label(l.id) })} onClick={() => onMove(l.id, "DOWN")}>↓</button>
          </div>
        );
      })}
    </fieldset>
  );
}
