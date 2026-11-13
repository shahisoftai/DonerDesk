"use client";

import { useEffect, useState } from "react";
import type { MapProjection } from "../ports/map-projection";
import { MARKER_COLOURS, type MarkerKind, type PlaceMarker } from "../domain/scene/place-markers";

const SERIES = MARKER_COLOURS;
const SIZE = 44;

/** Small bars or a pie at each place (Phase 53.5), drawn over the map through the same projection the figure cards use. Reads, never writes. */
export function MarkerLayer({ projection, kind, markers, anchors }: { projection: MapProjection; kind: Exclude<MarkerKind, "NONE">; markers: readonly PlaceMarker[]; anchors: ReadonlyMap<string, { lng: number; lat: number }> }) {
  const [, tick] = useState(0);
  useEffect(() => projection.onView(() => tick((n) => n + 1)), [projection]);
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true" data-testid="place-markers">
      {markers.map((m) => {
        const at = anchors.get(m.placeId); const p = at ? projection.project(at.lng, at.lat) : null;
        if (!p) return null;
        return <svg key={m.placeId} width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ position: "absolute", left: p.x - SIZE / 2, top: p.y - SIZE / 2 }}>{kind === "PIE" ? pie(m) : bars(m)}</svg>;
      })}
    </div>
  );
}

function bars(m: PlaceMarker) {
  const max = Math.max(...m.parts.map((p) => p.value), 1);
  const w = SIZE / m.parts.length;
  return <g><rect width={SIZE} height={SIZE} rx={6} fill="white" fillOpacity={0.85} stroke="#cbd5e1" />{m.parts.map((p, i) => { const h = Math.max(1, (p.value / max) * (SIZE - 10)); return <rect key={p.indicatorId} x={i * w + 3} y={SIZE - 4 - h} width={w - 6} height={h} fill={SERIES[i % SERIES.length]} />; })}</g>;
}

function pie(m: PlaceMarker) {
  const r = SIZE / 2 - 3; const c = SIZE / 2;
  if (m.total <= 0) return <circle cx={c} cy={c} r={r} fill="#e2e8f0" />;
  let angle = -Math.PI / 2;
  return <g><circle cx={c} cy={c} r={r + 2} fill="white" fillOpacity={0.85} />{m.parts.map((p, i) => {
    const sweep = (p.value / m.total) * Math.PI * 2;
    if (sweep >= Math.PI * 2 - 1e-6) return <circle key={p.indicatorId} cx={c} cy={c} r={r} fill={SERIES[i % SERIES.length]} />;
    const x1 = c + r * Math.cos(angle); const y1 = c + r * Math.sin(angle); angle += sweep;
    const x2 = c + r * Math.cos(angle); const y2 = c + r * Math.sin(angle);
    return <path key={p.indicatorId} d={`M${c} ${c}L${x1} ${y1}A${r} ${r} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x2} ${y2}Z`} fill={SERIES[i % SERIES.length]} />;
  })}</g>;
}
