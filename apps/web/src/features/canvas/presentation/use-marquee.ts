"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import type { Rect } from "@donordesk/domain/contexts/canvas/index.js";

const COLUMNS = 12, ROW_REM = 5.5, GAP_PX = 12, MIN_DRAG_PX = 4;

/**
 * Drag a rectangle over empty space on the page to select every block it touches (Phase 48.1). The pixel-to-cell conversion matches
 * the block frame's (12 columns, rows of 5.5rem, 12 px gaps), so the rectangle and the blocks agree on where a cell is. The result
 * is handed over in grid cells; what it selects is decided by the pure `marquee` rule.
 */
export function useMarquee(gridRef: RefObject<HTMLElement | null>, enabled: boolean, onSelect: (cells: Rect, add: boolean) => void) {
  const start = useRef<{ x: number; y: number; add: boolean } | null>(null);
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const cells = (a: { x: number; y: number }, b: { x: number; y: number }): Rect | null => {
    const grid = gridRef.current;
    if (!grid) return null;
    const r = grid.getBoundingClientRect();
    const root = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const zoom = r.width / (grid.offsetWidth || r.width);
    const colStep = (r.width + GAP_PX * zoom) / COLUMNS;
    const rowStep = ROW_REM * root * zoom + GAP_PX * zoom;
    const x1 = Math.min(a.x, b.x) - r.left, x2 = Math.max(a.x, b.x) - r.left, y1 = Math.min(a.y, b.y) - r.top, y2 = Math.max(a.y, b.y) - r.top;
    return { x: Math.floor(x1 / colStep), y: Math.floor(y1 / rowStep), w: Math.max(1, Math.ceil(x2 / colStep) - Math.floor(x1 / colStep)), h: Math.max(1, Math.ceil(y2 / rowStep) - Math.floor(y1 / rowStep)) };
  };

  return {
    box,
    handlers: enabled ? {
      onPointerDown(e: ReactPointerEvent<HTMLElement>) {
        if (e.target !== e.currentTarget || e.button !== 0) return;
        start.current = { x: e.clientX, y: e.clientY, add: e.shiftKey || e.ctrlKey || e.metaKey };
        e.currentTarget.setPointerCapture(e.pointerId);
      },
      onPointerMove(e: ReactPointerEvent<HTMLElement>) {
        const s = start.current, grid = gridRef.current;
        if (!s || !grid) return;
        const r = grid.getBoundingClientRect();
        setBox({ x: Math.min(s.x, e.clientX) - r.left, y: Math.min(s.y, e.clientY) - r.top, w: Math.abs(e.clientX - s.x), h: Math.abs(e.clientY - s.y) });
      },
      onPointerUp(e: ReactPointerEvent<HTMLElement>) {
        const s = start.current;
        start.current = null;
        setBox(null);
        if (!s) return;
        if (Math.abs(e.clientX - s.x) < MIN_DRAG_PX && Math.abs(e.clientY - s.y) < MIN_DRAG_PX) { onSelect({ x: 0, y: 0, w: 0, h: 0 }, false); return; }
        const rect = cells(s, { x: e.clientX, y: e.clientY });
        if (rect) onSelect(rect, s.add);
      },
      onPointerCancel() { start.current = null; setBox(null); },
    } : {},
  };
}
