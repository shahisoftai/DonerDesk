"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { formatFigure, type NumbersFormat } from "@donordesk/domain/contexts/canvas/index.js";
import { placeCallouts, type CardFigure } from "@donordesk/domain/contexts/dashboards/index.js";
import type { MapProjection } from "../ports/map-projection";
import { useBlockId } from "@/components/editing/block-edit-context";
import { useMapText } from "./useMapText";

export interface CalloutCard { key: string; name: string; figures: readonly CardFigure[]; text?: string | undefined; lng: number; lat: number }
type Offset = { dx: number; dy: number };

/** A card is sized to what it holds: a row of figures per `columns`; a text card by its words. Nothing is cut off. */
function sizeOf(c: CalloutCard, columns: number): { w: number; h: number } {
  if (c.text !== undefined) { const lines = Math.min(6, Math.ceil(c.text.length / 26)); return { w: 180, h: 26 + lines * 15 }; }
  return { w: 64 * Math.max(1, columns) + 12, h: 28 + Math.ceil(c.figures.length / Math.max(1, columns)) * 30 };
}

interface Props { projection: MapProjection; cards: readonly CalloutCard[]; columns: number; numbers?: NumbersFormat | undefined; accent: string; offsets?: Readonly<Record<string, Offset>> | undefined; /** Cards whose place has no pin, area or pinned places inside it: said, never placed at a guess. */ unplaced?: number | undefined; onMove?: ((key: string, offset: Offset | null) => void) | undefined; /** A read-only view (a share link, a dashboard being read): a visitor may still move cards for themself; nothing is saved to the page. */ viewerMovable?: boolean | undefined }

/**
 * Cards on a map, each joined to its place by a line (Phase 50.3d): figure cards and a person's own text cards. Positions come from the
 * pure `placeCallouts` rule; a card a person dragged stays where it was dropped (an offset from its place, so it moves with the map), and
 * the others are placed around it. While the canvas is edited, a card is dragged with the pointer or moved with the arrow keys
 * (Shift = 10 px); a double-click or Delete puts it back to automatic. A figure nobody recorded reads "Not measured", never 0.
 */
export function CalloutLayer({ projection, cards, columns, numbers, accent, offsets = {}, unplaced = 0, onMove, viewerMovable = false }: Props) {
  const { t, lang } = useMapText();
  const [, setTick] = useState(0);
  const [drag, setDrag] = useState<{ key: string; dx: number; dy: number } | null>(null);
  const start = useRef<{ key: string; px: number; py: number; dx: number; dy: number } | null>(null);
  // The last drop is kept here until the saved settings come back with it, so a card never jumps back for a moment.
  const [pending, setPending] = useState<Record<string, Offset | null>>({});
  useEffect(() => setPending({}), [offsets]);
  // A visitor's own arrangement of a read-only page: kept for this browser tab only (never sent anywhere), per block.
  const blockId = useBlockId();
  const storeKey = typeof location === "undefined" ? null : `dd-cards:${location.pathname}:${blockId ?? "map"}`;
  const [mine, setMine] = useState<Record<string, Offset>>({});
  useEffect(() => {
    if (onMove || !viewerMovable || !storeKey) return;
    try { const raw = window.sessionStorage.getItem(storeKey); if (raw) { const o = JSON.parse(raw) as Record<string, Offset>; if (o && typeof o === "object") setMine(o); } } catch { /* storage blocked: moves last until the page closes */ }
  }, [onMove, viewerMovable, storeKey]);
  const place = (key: string, offset: Offset | null) => {
    if (onMove) { setPending((p) => ({ ...p, [key]: offset })); onMove(key, offset); return; }
    setMine((m) => {
      const next = { ...m }; if (offset) next[key] = { dx: Math.round(offset.dx), dy: Math.round(offset.dy) }; else delete next[key];
      try { if (storeKey) window.sessionStorage.setItem(storeKey, JSON.stringify(next)); } catch { /* not kept; still works */ }
      return next;
    });
  };
  useEffect(() => projection.onView(() => setTick((n) => n + 1)), [projection]);
  const anchors = cards.flatMap((c) => {
    const p = projection.project(c.lng, c.lat);
    if (!p) return [];
    const fixed = drag?.key === c.key ? { dx: drag.dx, dy: drag.dy } : !onMove && viewerMovable && c.key in mine ? mine[c.key] : c.key in pending ? pending[c.key] ?? undefined : offsets[c.key];
    return [{ key: c.key, x: p.x, y: p.y, size: sizeOf(c, columns), ...(fixed ? { fixed } : {}) }];
  });
  const boxes = placeCallouts(anchors, projection.size(), { w: 180, h: 100 }, { distance: 16, gap: 4 });
  const byKey = new Map(cards.map((c) => [c.key, c]));
  const editable = Boolean(onMove) || viewerMovable;

  const down = (key: string, box: { x: number; y: number; anchorX: number; anchorY: number }) => (e: ReactPointerEvent<HTMLElement>) => {
    if (!editable || e.button !== 0) return;
    e.stopPropagation(); e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    start.current = { key, px: e.clientX, py: e.clientY, dx: box.x - box.anchorX, dy: box.y - box.anchorY };
    setDrag({ key, dx: start.current.dx, dy: start.current.dy });
  };
  const move = (e: ReactPointerEvent<HTMLElement>) => {
    const s = start.current; if (!s) return;
    e.stopPropagation();
    setDrag({ key: s.key, dx: s.dx + e.clientX - s.px, dy: s.dy + e.clientY - s.py });
  };
  const up = (e: ReactPointerEvent<HTMLElement>) => {
    const s = start.current; if (!s) return;
    e.stopPropagation();
    start.current = null;
    const dx = s.dx + e.clientX - s.px, dy = s.dy + e.clientY - s.py;
    setDrag(null);
    if (Math.abs(e.clientX - s.px) + Math.abs(e.clientY - s.py) > 2) place(s.key, { dx, dy });
  };

  return (
    <div className="pointer-events-none absolute inset-0" data-testid="map-callouts">
      {unplaced > 0 && <p className="absolute bottom-8 start-2 rounded bg-white/90 px-2 py-0.5 text-[11px] text-slate-700 shadow">{unplaced === 1 ? "1 card is not shown: its place has no pin or area on this map." : `${unplaced} cards are not shown: their places have no pin or area on this map.`}</p>}
      <svg className="absolute inset-0 h-full w-full" aria-hidden>
        {boxes.map((b) => { const ex = Math.min(Math.max(b.anchorX, b.x), b.x + b.w); const ey = Math.min(Math.max(b.anchorY, b.y), b.y + b.h); return <g key={b.key}><line x1={b.anchorX} y1={b.anchorY} x2={ex} y2={ey} stroke={accent} strokeWidth={2} /><circle cx={b.anchorX} cy={b.anchorY} r={3} fill={accent} /></g>; })}
      </svg>
      {boxes.map((b) => {
        const c = byKey.get(b.key)!;
        return (
          <section key={b.key} aria-label={c.name} data-card={b.key} data-fixed={b.fixed || undefined} tabIndex={editable ? 0 : undefined}
            title={editable ? (onMove ? "Drag to place this card; double-click to put it back" : "Drag to move this card for yourself; double-click to put it back") : undefined}
            onPointerDown={down(b.key, b)} onPointerMove={move} onPointerUp={up}
            onDoubleClick={editable ? (e) => { e.stopPropagation(); place(b.key, null); } : undefined}
            onKeyDown={editable ? (e) => {
              const step = e.shiftKey ? 10 : 1;
              const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key as "ArrowLeft"];
              if (delta) { e.preventDefault(); e.stopPropagation(); place(b.key, { dx: b.x - b.anchorX + delta[0]!, dy: b.y - b.anchorY + delta[1]! }); }
              else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); place(b.key, null); }
            } : undefined}
            className={`absolute overflow-hidden rounded bg-white/95 p-1.5 text-slate-900 shadow dark:bg-slate-900/95 dark:text-slate-100 ${editable ? "pointer-events-auto cursor-move touch-none outline-brand-600 focus:outline focus:outline-2" : ""}`}
            style={{ left: b.x, top: b.y, width: b.w, height: b.h, borderTop: `3px solid ${accent}` }}>
            <h4 className="truncate text-xs font-bold">{c.name}</h4>
            {c.text !== undefined
              ? <p className="text-[11px] leading-snug">{c.text}</p>
              : <ul className="grid gap-x-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
                  {c.figures.map((f, i) => { const v = formatFigure(f.value, numbers ?? {}, lang); return <li key={i} className="min-w-0 leading-tight"><span className={`block truncate text-[11px] ${v === null ? "italic text-slate-500" : "font-semibold tabular-nums"}`}>{v ?? t("maps.notMeasured")}</span><span className="block truncate text-[9px] text-slate-500">{f.label}</span></li>; })}
                </ul>}
          </section>
        );
      })}
    </div>
  );
}
