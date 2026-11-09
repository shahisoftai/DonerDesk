/** Undo/redo for the editor (Phase 45.3): one edit is one step, an edit that changes nothing is not a step, 200 steps are kept. */
import type { Canvas } from "../canvas.js";

export const HISTORY_LIMIT = 200;
export interface History { past: Canvas[]; present: Canvas; future: Canvas[] }

export const startHistory = (present: Canvas): History => ({ past: [], present, future: [] });

export function commit(h: History, next: Canvas): History {
  if (JSON.stringify(next) === JSON.stringify(h.present)) return h;
  return { past: [...h.past, h.present].slice(-HISTORY_LIMIT), present: next, future: [] };
}
export const undo = (h: History): History => (h.past.length === 0 ? h : { past: h.past.slice(0, -1), present: h.past.at(-1)!, future: [h.present, ...h.future] });
export const redo = (h: History): History => (h.future.length === 0 ? h : { past: [...h.past, h.present], present: h.future[0]!, future: h.future.slice(1) });
export const canUndo = (h: History): boolean => h.past.length > 0;
export const canRedo = (h: History): boolean => h.future.length > 0;
