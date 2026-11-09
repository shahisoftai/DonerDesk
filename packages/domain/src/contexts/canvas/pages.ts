/**
 * Page presets and page modes (Phase 48.4). A preset names a size and a mode; a FREE page positions blocks in pixels, a GRID page in
 * the 12 columns. Converting between the two keeps every block, and a conversion back to a grid snaps to the nearest cells. Pure.
 */
import { CANVAS_GRID_COLUMNS, type BlockInstance, type Canvas, type CanvasPage, type FreeFrame } from "./canvas.js";

export interface PagePreset { id: string; label: string; mode: "GRID" | "FREE"; /** px at 96 dpi; null = fluid (a dashboard grows with its rows). */ size: { w: number; h: number } | null; /** Printable margin and bleed, px. */ margin: number; bleed: number; family: "SCREEN" | "PRINT" | "SLIDE" | "SOCIAL" }

const mm = (n: number): number => Math.round((n / 25.4) * 96);
export const PAGE_PRESETS: readonly PagePreset[] = [
  { id: "DASHBOARD", label: "Dashboard (fluid)", mode: "GRID", size: null, margin: 0, bleed: 0, family: "SCREEN" },
  { id: "A4_PORTRAIT", label: "A4 portrait", mode: "FREE", size: { w: mm(210), h: mm(297) }, margin: mm(12), bleed: mm(3), family: "PRINT" },
  { id: "A4_LANDSCAPE", label: "A4 landscape", mode: "FREE", size: { w: mm(297), h: mm(210) }, margin: mm(12), bleed: mm(3), family: "PRINT" },
  { id: "A3_PORTRAIT", label: "A3 portrait", mode: "FREE", size: { w: mm(297), h: mm(420) }, margin: mm(15), bleed: mm(3), family: "PRINT" },
  { id: "A5_PORTRAIT", label: "A5 portrait", mode: "FREE", size: { w: mm(148), h: mm(210) }, margin: mm(10), bleed: mm(3), family: "PRINT" },
  { id: "LETTER_PORTRAIT", label: "US Letter portrait", mode: "FREE", size: { w: 816, h: 1056 }, margin: 48, bleed: 12, family: "PRINT" },
  { id: "LETTER_LANDSCAPE", label: "US Letter landscape", mode: "FREE", size: { w: 1056, h: 816 }, margin: 48, bleed: 12, family: "PRINT" },
  { id: "POSTER_A2", label: "Poster A2", mode: "FREE", size: { w: mm(420), h: mm(594) }, margin: mm(20), bleed: mm(3), family: "PRINT" },
  { id: "SLIDE_16_9", label: "Slide 16:9", mode: "FREE", size: { w: 1280, h: 720 }, margin: 48, bleed: 0, family: "SLIDE" },
  { id: "SLIDE_4_3", label: "Slide 4:3", mode: "FREE", size: { w: 1024, h: 768 }, margin: 48, bleed: 0, family: "SLIDE" },
  { id: "SOCIAL_SQUARE", label: "Social square", mode: "FREE", size: { w: 1080, h: 1080 }, margin: 60, bleed: 0, family: "SOCIAL" },
  { id: "SOCIAL_STORY", label: "Social story", mode: "FREE", size: { w: 1080, h: 1920 }, margin: 80, bleed: 0, family: "SOCIAL" },
  { id: "SOCIAL_LANDSCAPE", label: "Social landscape", mode: "FREE", size: { w: 1200, h: 630 }, margin: 48, bleed: 0, family: "SOCIAL" },
  { id: "WEB_BANNER", label: "Web banner", mode: "FREE", size: { w: 1500, h: 500 }, margin: 40, bleed: 0, family: "SCREEN" },
];

export const pagePresetById = (id: string): PagePreset | undefined => PAGE_PRESETS.find((p) => p.id === id);
export const MAX_FREE_PX = 6000;
export const MIN_FREE_PX = 100;
export const MAX_ROTATION = 360;

export type PageResult = { ok: true; canvas: Canvas } | { ok: false; reason: string };
const fail = (reason: string): PageResult => ({ ok: false, reason });

/** Columns of the grid map to the page width less margins; a row is a fixed 88 px (5.5rem) on a fluid page. */
const ROW_PX = 88;
const colWidth = (size: { w: number }, margin: number): number => (size.w - 2 * margin) / CANVAS_GRID_COLUMNS;

/** A block's grid cells as pixels on a page of this size. */
export function frameFromCells(b: BlockInstance, size: { w: number }, margin: number): FreeFrame {
  const col = colWidth(size, margin);
  return { x: Math.round(margin + b.bounds.x * col), y: Math.round(margin + b.bounds.y * ROW_PX), w: Math.round(b.bounds.w * col), h: Math.round(b.bounds.h * ROW_PX), rot: 0, z: 0 };
}

/** The nearest cells to a pixel frame, for going back to a grid. */
export function cellsFromFrame(f: FreeFrame, size: { w: number }, margin: number): BlockInstance["bounds"] {
  const col = colWidth(size, margin);
  const w = Math.min(CANVAS_GRID_COLUMNS, Math.max(1, Math.round(f.w / col)));
  return { x: Math.min(CANVAS_GRID_COLUMNS - w, Math.max(0, Math.round((f.x - margin) / col))), y: Math.max(0, Math.round((f.y - margin) / ROW_PX)), w, h: Math.max(1, Math.round(f.h / ROW_PX)) };
}

/** Sets a page's preset. Going to a FREE page gives every block a pixel frame from its cells; going back to a grid snaps the frames to cells. */
export function setPagePreset(c: Canvas, pageId: string, presetId: string): PageResult {
  const preset = pagePresetById(presetId);
  const page = c.pages.find((p) => p.id === pageId);
  if (!preset) return fail("That page size is not one the product knows.");
  if (!page) return fail("That page does not exist.");
  const was = page.mode ?? "GRID";
  const next: CanvasPage = { ...page, mode: preset.mode, format: preset.id, size: preset.size ?? undefined };
  if (preset.mode === "FREE" && preset.size) {
    const size = preset.size;
    const source = was === "FREE" && page.size ? page.size : null;
    next.blocks = page.blocks.map((b) => {
      if (b.container) return b;
      if (b.free && source) {
        const sx = size.w / source.w, sy = size.h / source.h;
        return { ...b, free: { ...b.free, x: Math.round(b.free.x * sx), y: Math.round(b.free.y * sy), w: Math.round(b.free.w * sx), h: Math.round(b.free.h * sy) } };
      }
      return { ...b, free: frameFromCells(b, size, preset.margin) };
    });
  } else if (preset.mode === "GRID") {
    const size = page.size;
    next.blocks = page.blocks.map((b) => (b.free && size ? { ...b, bounds: cellsFromFrame(b.free, size, pagePresetById(page.format)?.margin ?? 0), free: undefined } : { ...b, free: undefined }));
  }
  return { ok: true, canvas: { ...c, pages: c.pages.map((p) => (p.id === pageId ? next : p)) } };
}

/** Where a free frame may be: inside the page (a little may hang over for bleed). */
export function freeFrameProblems(f: FreeFrame, size: { w: number; h: number }): string[] {
  const out: string[] = [];
  if (![f.x, f.y, f.w, f.h].every(Number.isFinite)) return ["A frame needs numbers for its place and size."];
  if (f.w < 8 || f.h < 8) out.push("A block is at least 8 px wide and high.");
  if (f.w > MAX_FREE_PX || f.h > MAX_FREE_PX) out.push(`A block is at most ${MAX_FREE_PX} px.`);
  if (f.x + f.w < 0 || f.y + f.h < 0 || f.x > size.w || f.y > size.h) out.push("A block must be at least partly on the page.");
  if (f.rot !== undefined && (!Number.isFinite(f.rot) || Math.abs(f.rot) > MAX_ROTATION)) out.push("Rotation is between -360 and 360 degrees.");
  return out;
}

/** The page size a preset or a custom size gives; a custom size is checked. */
export function customSize(w: number, h: number): { w: number; h: number } | string {
  if (![w, h].every((n) => Number.isInteger(n) && n >= MIN_FREE_PX && n <= MAX_FREE_PX)) return `A page is between ${MIN_FREE_PX} and ${MAX_FREE_PX} px each way.`;
  return { w, h };
}
