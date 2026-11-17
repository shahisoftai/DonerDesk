"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { frameOf, pageExtent, pagePresetById, resizeFrame, rotateFrame, snapMove, type BlockInstance, type CanvasPage, type FreeFrame, type Guide, type Handle } from "@donordesk/domain/contexts/canvas/index.js";

const HANDLES: ReadonlyArray<{ h: Handle; style: CSSProperties; cursor: string }> = [
  { h: "NW", style: { left: -5, top: -5 }, cursor: "nwse-resize" }, { h: "N", style: { left: "50%", top: -5, marginLeft: -5 }, cursor: "ns-resize" }, { h: "NE", style: { right: -5, top: -5 }, cursor: "nesw-resize" },
  { h: "W", style: { left: -5, top: "50%", marginTop: -5 }, cursor: "ew-resize" }, { h: "E", style: { right: -5, top: "50%", marginTop: -5 }, cursor: "ew-resize" },
  { h: "SW", style: { left: -5, bottom: -5 }, cursor: "nesw-resize" }, { h: "S", style: { left: "50%", bottom: -5, marginLeft: -5 }, cursor: "ns-resize" }, { h: "SE", style: { right: -5, bottom: -5 }, cursor: "nwse-resize" },
];

type Gesture = { id: string; kind: "move" | "size" | "rotate"; handle?: Handle; startX: number; startY: number; start: FreeFrame; ratio: boolean };

interface Props {
  page: CanvasPage;
  blocks: readonly BlockInstance[];
  editing: boolean;
  selectedIds: ReadonlySet<string>;
  /** Snap to the page's margins, centre and other blocks while dragging (a modifier key bypasses it). */
  snap: boolean;
  /** Draws a block's body (the same renderer the grid page uses). */
  renderTop: (b: BlockInstance) => ReactNode;
  onSelect: (id: string, how?: { shift?: boolean; mod?: boolean }) => void;
  onFrame: (id: string, patch: Partial<FreeFrame>) => void;
  onClearSelection?: (() => void) | undefined;
  label: (kind: string) => string;
}

/** True below the width where a free page is shown as a stack instead of a scaled page. */
function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(max-width: 639px)");
    const f = (): void => setNarrow(q.matches);
    f();
    q.addEventListener("change", f);
    return () => q.removeEventListener("change", f);
  }, []);
  return narrow;
}

/**
 * A free page (Phase 61.3): every block sits at pixel position, at its own size, in front of or behind others. The page is drawn at its own
 * size and scaled to the width available; moving and resizing are measured against that scale. Dragging moves a block, the eight handles
 * resize it from any edge or corner (Shift keeps its shape), the round handle turns it, and guides appear when it lines up with the page
 * or another block. On a phone the page is shown as a stack in reading order. Nothing here decides what a block says.
 */
export function FreePageView({ page, blocks, editing, selectedIds, snap, renderTop, onSelect, onFrame, onClearSelection, label }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const [live, setLive] = useState<{ id: string; frame: FreeFrame } | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const narrow = useNarrow();
  const size = page.size ?? { w: 1280, h: 800 };
  const margin = pagePresetById(page.format)?.margin ?? 24;
  const extent = pageExtent(page) ?? size;

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = (): void => setScale(Math.min(2, Math.max(0.15, el.getBoundingClientRect().width / size.w)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [size.w]);

  const frames = useMemo(() => new Map(blocks.map((b) => [b.id, frameOf(b, page)])), [blocks, page]);
  const shown = (id: string): FreeFrame => (live && live.id === id ? live.frame : frames.get(id)!);
  const ordered = useMemo(() => [...blocks].sort((a, b) => (frames.get(a.id)!.z ?? 0) - (frames.get(b.id)!.z ?? 0)), [blocks, frames]);

  function begin(e: ReactPointerEvent<HTMLElement>, b: BlockInstance, kind: Gesture["kind"], handle?: Handle): void {
    if (!editing || b.style?.locked) return;
    e.preventDefault(); e.stopPropagation();
    // A plain press on a block that is not selected selects it; a press with Shift or Ctrl/⌘ is left to the click, so it is not toggled twice.
    if (!selectedIds.has(b.id) && !(e.shiftKey || e.ctrlKey || e.metaKey)) onSelect(b.id);
    e.currentTarget.setPointerCapture(e.pointerId);
    setGesture({ id: b.id, kind, ...(handle ? { handle } : {}), startX: e.clientX, startY: e.clientY, start: frames.get(b.id)!, ratio: e.shiftKey });
  }
  function track(e: ReactPointerEvent<HTMLElement>): void {
    if (!gesture) return;
    const dx = (e.clientX - gesture.startX) / scale, dy = (e.clientY - gesture.startY) / scale;
    const others = blocks.filter((o) => o.id !== gesture.id && !o.container).map((o) => frames.get(o.id)!);
    if (gesture.kind === "move") {
      const moved = { ...gesture.start, x: Math.round(gesture.start.x + dx), y: Math.round(gesture.start.y + dy) };
      if (snap && !e.altKey) { const s = snapMove(moved, size, margin, others); setLive({ id: gesture.id, frame: s.frame }); setGuides(s.guides); } else { setLive({ id: gesture.id, frame: moved }); setGuides([]); }
    } else if (gesture.kind === "size" && gesture.handle) {
      setLive({ id: gesture.id, frame: resizeFrame(gesture.start, gesture.handle, dx, dy, gesture.ratio || e.shiftKey) });
    } else {
      const cx = gesture.start.x + gesture.start.w / 2, cy = gesture.start.y + gesture.start.h / 2;
      const rect = wrap.current!.getBoundingClientRect();
      const px = (e.clientX - rect.left) / scale, py = (e.clientY - rect.top) / scale;
      setLive({ id: gesture.id, frame: rotateFrame(gesture.start, (Math.atan2(py - cy, px - cx) * 180) / Math.PI + 90, e.shiftKey) });
    }
  }
  function end(): void {
    if (gesture && live && live.id === gesture.id) onFrame(gesture.id, { x: live.frame.x, y: live.frame.y, w: live.frame.w, h: live.frame.h, ...(live.frame.rot !== undefined ? { rot: live.frame.rot } : {}) });
    setGesture(null); setLive(null); setGuides([]);
  }

  if (narrow) {
    const stacked = [...blocks].sort((a, b) => frames.get(a.id)!.y - frames.get(b.id)!.y || frames.get(a.id)!.x - frames.get(b.id)!.x);
    return (
      <div className="flex flex-col gap-3" data-testid="canvas-grid" data-mode="FREE-STACK">
        {stacked.map((b) => <div key={b.id} style={{ minHeight: Math.max(140, Math.round(frames.get(b.id)!.h * 0.55)) }} onClick={editing ? () => onSelect(b.id) : undefined}>{renderTop(b)}</div>)}
      </div>
    );
  }

  const bg = page.background === "tint" ? "var(--tile-bg-soft, #f1f5f9)" : page.background === "accent" ? "var(--viz-1)" : "transparent";
  return (
    <div ref={wrap} className="relative w-full" style={{ height: extent.h * scale }} data-testid="canvas-grid" data-mode="FREE" data-scale={scale.toFixed(3)} data-page-w={size.w} data-page-h={extent.h}
      onPointerDown={(e) => { if (editing && e.target === e.currentTarget.firstElementChild) onClearSelection?.(); }}>
      <div className="absolute left-0 top-0 origin-top-left" style={{ width: size.w, height: extent.h, transform: `scale(${scale})`, background: bg, backgroundImage: editing ? "radial-gradient(circle, rgba(100,116,139,.25) 1px, transparent 1px)" : undefined, backgroundSize: editing ? "24px 24px" : undefined }}>
        {ordered.map((b) => {
          const f = shown(b.id);
          const selected = selectedIds.has(b.id);
          const locked = b.style?.locked === true;
          const dragging = gesture?.id === b.id;
          return (
            <div key={b.id} data-block-frame={b.id} data-free={`${Math.round(f.x)},${Math.round(f.y)},${Math.round(f.w)},${Math.round(f.h)}`}
              style={{ position: "absolute", left: f.x, top: f.y, width: f.w, height: f.h, transform: f.rot ? `rotate(${f.rot}deg)` : undefined, zIndex: (f.z ?? 0) + (dragging ? 1000 : 1) }}
              className={dragging ? "opacity-90" : undefined}>
              <div className="h-full w-full">{renderTop(b)}</div>
              {editing && (
                <>
                  {/* The overlay catches the pointer so a drag moves the block even over a chart; a click selects it. */}
                  <div role="button" tabIndex={-1} aria-label={`${label(b.kind)}`} data-move={b.id} onPointerDown={(e) => begin(e, b, "move")} onPointerMove={gesture ? track : undefined} onPointerUp={end} onPointerCancel={end}
                    onClick={(e) => { e.stopPropagation(); if (e.shiftKey || e.ctrlKey || e.metaKey) onSelect(b.id, { shift: e.shiftKey, mod: e.ctrlKey || e.metaKey }); else if (!selectedIds.has(b.id)) onSelect(b.id); }}
                    className={`absolute inset-0 touch-none ${locked ? "cursor-not-allowed" : "cursor-move"} ${selected ? "outline outline-2 outline-brand-600" : "hover:outline hover:outline-1 hover:outline-brand-400"}`} />
                  {selected && !locked && (
                    <>
                      {HANDLES.map((hd) => (
                        <span key={hd.h} role="button" aria-label={`Resize ${label(b.kind)} (${hd.h})`} data-handle={hd.h} onPointerDown={(e) => begin(e, b, "size", hd.h)} onPointerMove={gesture ? track : undefined} onPointerUp={end} onPointerCancel={end}
                          className="absolute z-20 h-2.5 w-2.5 touch-none rounded-sm border border-brand-700 bg-white" style={{ ...hd.style, cursor: hd.cursor }} />
                      ))}
                      <span role="button" aria-label={`Rotate ${label(b.kind)}`} data-handle="ROT" onPointerDown={(e) => begin(e, b, "rotate")} onPointerMove={gesture ? track : undefined} onPointerUp={end} onPointerCancel={end}
                        className="absolute z-20 h-3 w-3 cursor-grab touch-none rounded-full border border-brand-700 bg-brand-600" style={{ left: "50%", top: -22, marginLeft: -6 }} />
                      {dragging && <span className="pointer-events-none absolute -bottom-6 left-0 z-30 rounded bg-slate-900 px-1.5 py-0.5 text-[10px] text-white">{Math.round(f.w)} × {Math.round(f.h)}</span>}
                    </>
                  )}
                </>
              )}
            </div>
          );
        })}
        {guides.map((g, i) => <div key={i} aria-hidden className="pointer-events-none absolute z-50 bg-fuchsia-500" style={g.axis === "x" ? { left: g.at, top: 0, width: 1, height: extent.h } : { top: g.at, left: 0, height: 1, width: size.w }} />)}
      </div>
    </div>
  );
}
