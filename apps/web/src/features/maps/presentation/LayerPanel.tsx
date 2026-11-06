"use client";

import { layerState, type ExplorerLayer, type LayerKind } from "../domain/map-explorer";

const LABEL: Record<LayerKind, string> = { FILL: "Results fill", SYMBOLS: "Place symbols", BOUNDARIES: "Boundaries", OVERLAY: "Overlays" };

/** Layer list: show/hide, opacity and order. Pure view over `ExplorerLayer[]`; every change is a callback. */
export function LayerPanel({ layers, onToggle, onOpacity, onMove }: {
  layers: readonly ExplorerLayer[];
  onToggle: (id: LayerKind) => void;
  onOpacity: (id: LayerKind, value: number) => void;
  onMove: (id: LayerKind, direction: "UP" | "DOWN") => void;
}) {
  return (
    <fieldset className="space-y-2 text-sm">
      <legend className="font-medium">Layers</legend>
      {[...layers].reverse().map((l) => {
        const s = layerState(layers, l.id);
        return (
          <div key={l.id} className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={s.visible} onChange={() => onToggle(l.id)} /> {LABEL[l.id]}
            </label>
            <input type="range" min={0.1} max={1} step={0.1} value={s.opacity} aria-label={`${LABEL[l.id]} opacity`} onChange={(e) => onOpacity(l.id, Number(e.target.value))} className="w-24" />
            <button type="button" className="rounded border px-1" aria-label={`Move ${LABEL[l.id]} up`} onClick={() => onMove(l.id, "UP")}>↑</button>
            <button type="button" className="rounded border px-1" aria-label={`Move ${LABEL[l.id]} down`} onClick={() => onMove(l.id, "DOWN")}>↓</button>
          </div>
        );
      })}
    </fieldset>
  );
}
