"use client";

import { useMemo } from "react";
import { geometryBounds, unionBounds } from "../../../maps/domain/model/bounds";
import type { BoundaryUnit } from "../../../maps/domain/boundaries/join";
import { TICK_COLOR } from "../domain/place-picker-scene";
import type { TickState } from "../domain/place-picker";

type Ring = ReadonlyArray<readonly [number, number]>;
const ringsOf = (g: unknown): Ring[] => {
  const geo = g as { type?: string; coordinates?: unknown } | null;
  if (geo?.type === "Polygon") return (geo.coordinates as Ring[]) ?? [];
  if (geo?.type === "MultiPolygon") return ((geo.coordinates as Ring[][]) ?? []).flat();
  return [];
};

/**
 * The same areas drawn as plain shapes, for a device that cannot start the map (no WebGL). Equirectangular, corrected for latitude; no streets.
 * Each area is a button, so it works with a keyboard and a screen reader exactly as a click does on the real map.
 */
export function PickSvgMap({ units, stateOf, activeRef, label, onChoose }: {
  units: readonly BoundaryUnit[]; stateOf: (u: BoundaryUnit) => TickState; activeRef: string | null; label: string; onChoose: (ref: string) => void;
}) {
  const drawn = useMemo(() => {
    const box = unionBounds(units.map((u) => geometryBounds(u.geometry)));
    if (!box) return null;
    const k = Math.cos((((box[1] + box[3]) / 2) * Math.PI) / 180) || 1;
    const w = (box[2] - box[0]) * k || 1, h = box[3] - box[1] || 1, scale = 600 / Math.max(w, h);
    const pt = ([x, y]: readonly [number, number]) => `${((x - box[0]) * k * scale).toFixed(1)},${((box[3] - y) * scale).toFixed(1)}`;
    return { width: w * scale, height: h * scale, paths: units.map((u) => ({ u, d: ringsOf(u.geometry).map((r) => `M${r.map(pt).join("L")}Z`).join("") })) };
  }, [units]);
  if (!drawn) return null;
  return (
    <svg role="group" aria-label={label} viewBox={`-4 -4 ${drawn.width + 8} ${drawn.height + 8}`} className="h-[26rem] w-full rounded-lg bg-slate-100 dark:bg-slate-800">
      {drawn.paths.map(({ u, d }) => (
        <path key={u.ref} d={d} fill={TICK_COLOR[stateOf(u)]} stroke={activeRef === u.ref ? "#0f172a" : "#64748b"} strokeWidth={activeRef === u.ref ? 2.5 : 0.8} vectorEffect="non-scaling-stroke"
          role="button" tabIndex={0} aria-label={u.name} className="cursor-pointer" onClick={() => onChoose(u.ref)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onChoose(u.ref); } }}><title>{u.name}</title></path>
      ))}
    </svg>
  );
}
