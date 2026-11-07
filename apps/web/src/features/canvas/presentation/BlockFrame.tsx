"use client";

import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

interface Bounds { x: number; y: number; w: number; h: number }
interface Props {
  bounds: Bounds;
  /** Dragging and resizing are offered only while editing, and not for a locked block. */
  movable: boolean;
  selected: boolean;
  label: string;
  onBounds: (change: Partial<Bounds>) => void;
  onSelect: () => void;
  children: ReactNode;
}

const COLUMNS = 12;
const ROW_REM = 5.5;
const GAP_PX = 12;

type Gesture = { kind: "move" | "size"; startX: number; startY: number; dx: number; dy: number; colStep: number; rowStep: number };

/**
 * A block's place on the page. While editing, a grip moves it and a corner handle resizes it by dragging; both snap to the grid and nothing is
 * changed until the pointer is released (the block follows the pointer meanwhile). The keyboard does the same from the block's settings, so the
 * pointer is never the only way.
 */
export function BlockFrame({ bounds, movable, selected, label, onBounds, onSelect, children }: Props) {
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const frame = useRef<HTMLDivElement>(null);

  function begin(kind: Gesture["kind"], e: ReactPointerEvent<HTMLButtonElement>): void {
    const grid = frame.current?.parentElement;
    if (!grid) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect();
    const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const colStep = (grid.getBoundingClientRect().width + GAP_PX) / COLUMNS;
    const rowStep = ROW_REM * rootPx + GAP_PX;
    e.currentTarget.setPointerCapture(e.pointerId);
    setGesture({ kind, startX: e.clientX, startY: e.clientY, dx: 0, dy: 0, colStep, rowStep });
  }
  function track(e: ReactPointerEvent<HTMLButtonElement>): void {
    setGesture((g) => (g ? { ...g, dx: e.clientX - g.startX, dy: e.clientY - g.startY } : g));
  }
  function end(): void {
    if (!gesture) return;
    const cols = Math.round(gesture.dx / gesture.colStep);
    const rows = Math.round(gesture.dy / gesture.rowStep);
    setGesture(null);
    if (cols === 0 && rows === 0) return;
    if (gesture.kind === "move") onBounds({ x: Math.max(0, Math.min(COLUMNS - bounds.w, bounds.x + cols)), y: Math.max(0, bounds.y + rows) });
    else onBounds({ w: Math.max(1, Math.min(COLUMNS - bounds.x, bounds.w + cols)), h: Math.max(1, bounds.h + rows) });
  }

  const style: CSSProperties = gesture?.kind === "move" ? { transform: `translate(${gesture.dx}px, ${gesture.dy}px)`, zIndex: 30, opacity: 0.85 } : {};
  const sizing: CSSProperties = gesture?.kind === "size" ? { width: `calc(100% + ${gesture.dx}px)`, height: `calc(100% + ${gesture.dy}px)`, zIndex: 30 } : {};
  const BTN = "absolute z-10 flex items-center justify-center rounded bg-sky-700 text-white shadow focus-visible:outline focus-visible:outline-2";

  return (
    <div ref={frame} className="group relative h-full" style={{ ...style, ...sizing }} data-dragging={gesture?.kind}>
      {children}
      {movable && (
        <>
          <button type="button" aria-label={`Move ${label}`} title="Drag to move" data-handle="move" onPointerDown={(e) => begin("move", e)} onPointerMove={gesture ? track : undefined} onPointerUp={end} onPointerCancel={() => setGesture(null)}
            className={`${BTN} start-1 top-1 h-6 w-6 cursor-grab touch-none text-xs ${selected ? "opacity-100" : "opacity-0 focus-visible:opacity-100 group-hover:opacity-100"}`}>⠿</button>
          <button type="button" aria-label={`Resize ${label}`} title="Drag to resize" data-handle="size" onPointerDown={(e) => begin("size", e)} onPointerMove={gesture ? track : undefined} onPointerUp={end} onPointerCancel={() => setGesture(null)}
            className={`${BTN} bottom-1 end-1 h-5 w-5 cursor-nwse-resize touch-none text-[10px] ${selected ? "opacity-100" : "opacity-0 focus-visible:opacity-100 group-hover:opacity-100"}`}>◢</button>
        </>
      )}
    </div>
  );
}
