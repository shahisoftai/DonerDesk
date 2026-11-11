"use client";

import { useEffect, useState } from "react";
import { formatFigure, type NumbersFormat } from "@donordesk/domain/contexts/canvas/index.js";
import { placeCallouts, type CardFigure } from "@donordesk/domain/contexts/dashboards/index.js";
import type { MapProjection } from "../ports/map-projection";
import { useMapText } from "./useMapText";

export interface CalloutCard { key: string; name: string; figures: readonly CardFigure[]; lng: number; lat: number }

const CARD = { w: 172, h: 92 };

/**
 * Figure cards beside chosen areas of a map, each joined to its area by a line (Phase 50.3d). Positions come from the pure
 * `placeCallouts` rule (no overlap, inside the map, a side column for what does not fit) and are worked out again when the map moves.
 * A figure nobody recorded reads "Not yet reported", never 0. The cards are also listed as text for a screen reader.
 */
export function CalloutLayer({ projection, cards, columns, numbers, accent }: { projection: MapProjection; cards: readonly CalloutCard[]; columns: number; numbers?: NumbersFormat | undefined; accent: string }) {
  const { t, lang } = useMapText();
  const [tick, setTick] = useState(0);
  useEffect(() => projection.onView(() => setTick((n) => n + 1)), [projection]);
  void tick;
  const anchors = cards.flatMap((c) => { const p = projection.project(c.lng, c.lat); return p ? [{ key: c.key, x: p.x, y: p.y }] : []; });
  const boxes = placeCallouts(anchors, projection.size(), CARD);
  const byKey = new Map(cards.map((c) => [c.key, c]));
  return (
    <div className="pointer-events-none absolute inset-0" data-testid="map-callouts">
      <svg className="absolute inset-0 h-full w-full" aria-hidden>
        {boxes.map((b) => { const ex = b.x + (b.anchorX < b.x ? 0 : b.anchorX > b.x + b.w ? b.w : b.w / 2); const ey = b.y + b.h / 2; return <g key={b.key}><line x1={b.anchorX} y1={b.anchorY} x2={ex} y2={ey} stroke={accent} strokeWidth={2} /><circle cx={b.anchorX} cy={b.anchorY} r={3} fill={accent} /></g>; })}
      </svg>
      {boxes.map((b) => {
        const c = byKey.get(b.key)!;
        return (
          <section key={b.key} aria-label={c.name} className="absolute overflow-hidden rounded bg-white/95 p-1.5 text-slate-900 shadow dark:bg-slate-900/95 dark:text-slate-100" style={{ left: b.x, top: b.y, width: b.w, height: b.h, borderTop: `3px solid ${accent}` }}>
            <h4 className="truncate text-xs font-bold">{c.name}</h4>
            <ul className="grid gap-x-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
              {c.figures.map((f, i) => { const v = formatFigure(f.value, numbers ?? {}, lang); return <li key={i} className="min-w-0 leading-tight"><span className={`block truncate text-[11px] ${v === null ? "italic text-slate-500" : "font-semibold tabular-nums"}`}>{v ?? t("maps.notMeasured")}</span><span className="block truncate text-[9px] text-slate-500">{f.label}</span></li>; })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
