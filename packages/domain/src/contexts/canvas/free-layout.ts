/**
 * Free layout gestures (Phase 48.4): move, resize, rotate and stack blocks on a FREE page, with snapping to the page margins, to other
 * blocks and to guides. Pure functions on frames; the editor draws the guides the snap returns. A snap never moves a block more than the
 * threshold, so dragging still feels like dragging.
 */
import type { FreeFrame } from "./canvas.js";

export interface Guide { axis: "x" | "y"; at: number; kind: "PAGE" | "MARGIN" | "BLOCK_EDGE" | "BLOCK_CENTRE" }
export const SNAP_PX = 6;

interface Targets { xs: Array<{ at: number; kind: Guide["kind"] }>; ys: Array<{ at: number; kind: Guide["kind"] }> }

export function targetsFor(page: { w: number; h: number }, margin: number, others: ReadonlyArray<FreeFrame>): Targets {
  const xs: Targets["xs"] = [{ at: 0, kind: "PAGE" }, { at: page.w, kind: "PAGE" }, { at: page.w / 2, kind: "PAGE" }, { at: margin, kind: "MARGIN" }, { at: page.w - margin, kind: "MARGIN" }];
  const ys: Targets["ys"] = [{ at: 0, kind: "PAGE" }, { at: page.h, kind: "PAGE" }, { at: page.h / 2, kind: "PAGE" }, { at: margin, kind: "MARGIN" }, { at: page.h - margin, kind: "MARGIN" }];
  for (const o of others) {
    xs.push({ at: o.x, kind: "BLOCK_EDGE" }, { at: o.x + o.w, kind: "BLOCK_EDGE" }, { at: o.x + o.w / 2, kind: "BLOCK_CENTRE" });
    ys.push({ at: o.y, kind: "BLOCK_EDGE" }, { at: o.y + o.h, kind: "BLOCK_EDGE" }, { at: o.y + o.h / 2, kind: "BLOCK_CENTRE" });
  }
  return { xs, ys };
}

/** The offset (within the threshold) that brings one of the frame's three lines onto the nearest target on one axis. */
function bestOffset(lines: number[], targets: Targets["xs"], threshold: number): { offset: number; guide: { at: number; kind: Guide["kind"] } } | null {
  let best: { offset: number; guide: { at: number; kind: Guide["kind"] } } | null = null;
  for (const line of lines) for (const t of targets) {
    const d = t.at - line;
    if (Math.abs(d) <= threshold && (!best || Math.abs(d) < Math.abs(best.offset))) best = { offset: d, guide: t };
  }
  return best;
}

/** Moves a frame onto nearby guides; returns the snapped frame and the guides that caught it (to draw). */
export function snapMove(frame: FreeFrame, page: { w: number; h: number }, margin: number, others: ReadonlyArray<FreeFrame>, threshold = SNAP_PX): { frame: FreeFrame; guides: Guide[] } {
  const t = targetsFor(page, margin, others);
  const sx = bestOffset([frame.x, frame.x + frame.w / 2, frame.x + frame.w], t.xs, threshold);
  const sy = bestOffset([frame.y, frame.y + frame.h / 2, frame.y + frame.h], t.ys, threshold);
  return {
    frame: { ...frame, x: Math.round(frame.x + (sx?.offset ?? 0)), y: Math.round(frame.y + (sy?.offset ?? 0)) },
    guides: [...(sx ? [{ axis: "x" as const, ...sx.guide }] : []), ...(sy ? [{ axis: "y" as const, ...sy.guide }] : [])],
  };
}

export type Handle = "N" | "S" | "E" | "W" | "NE" | "NW" | "SE" | "SW";

/** Resizing by a handle; with `keepRatio` the corner handles keep the frame's shape. The minimum is 8 px. */
export function resizeFrame(f: FreeFrame, handle: Handle, dx: number, dy: number, keepRatio = false): FreeFrame {
  let { x, y, w, h } = f;
  const ratio = f.w / f.h;
  if (handle.includes("E")) w += dx;
  if (handle.includes("W")) { x += dx; w -= dx; }
  if (handle.includes("S")) h += dy;
  if (handle.includes("N")) { y += dy; h -= dy; }
  if (keepRatio && handle.length === 2) {
    const nh = Math.abs(w) / ratio;
    if (handle.includes("N")) y += h - nh;
    h = nh;
  }
  w = Math.max(8, Math.round(w)); h = Math.max(8, Math.round(h));
  if (handle.includes("W")) x = Math.round(f.x + f.w - w);
  if (handle.includes("N")) y = Math.round(f.y + f.h - h);
  return { ...f, x: Math.round(x), y: Math.round(y), w, h };
}

/** Rotation in whole degrees, snapped to every 15 degrees when `snap` is on, normalised to -180..180. */
export function rotateFrame(f: FreeFrame, degrees: number, snap = false): FreeFrame {
  const raw = snap ? Math.round(degrees / 15) * 15 : Math.round(degrees);
  const rot = ((((raw + 180) % 360) + 360) % 360) - 180;
  return { ...f, rot };
}

/** Stacking order: front and back renumber the page so `z` stays 0..n-1 with no ties. */
export function stackOrder(frames: ReadonlyArray<{ id: string; z: number }>, id: string, move: "FRONT" | "BACK" | "FORWARD" | "BACKWARD"): Array<{ id: string; z: number }> {
  const order = [...frames].sort((a, b) => a.z - b.z || a.id.localeCompare(b.id)).map((f) => f.id);
  const i = order.indexOf(id);
  if (i < 0) return frames.map((f) => ({ ...f }));
  order.splice(i, 1);
  const to = move === "FRONT" ? order.length : move === "BACK" ? 0 : move === "FORWARD" ? Math.min(order.length, i + 1) : Math.max(0, i - 1);
  order.splice(to, 0, id);
  return order.map((fid, z) => ({ id: fid, z }));
}

/** Aligns a frame to the page margins or centre (the quick "centre on page" and "fit to margins" actions). */
export function placeOnPage(f: FreeFrame, page: { w: number; h: number }, margin: number, how: "CENTRE_X" | "CENTRE_Y" | "FILL_WIDTH" | "FILL_PAGE"): FreeFrame {
  switch (how) {
    case "CENTRE_X": return { ...f, x: Math.round((page.w - f.w) / 2) };
    case "CENTRE_Y": return { ...f, y: Math.round((page.h - f.h) / 2) };
    case "FILL_WIDTH": return { ...f, x: margin, w: page.w - 2 * margin };
    case "FILL_PAGE": return { ...f, x: margin, y: margin, w: page.w - 2 * margin, h: page.h - 2 * margin };
  }
}
