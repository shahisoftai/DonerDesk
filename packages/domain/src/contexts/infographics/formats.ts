/**
 * Page formats (Phase 32.1). A design is drawn on one fixed canvas whose pixel size is set here;
 * the composer derives margins, header and the 12-column grid from it, so a format is data, not
 * code. A4/A3 are at 150 dpi (1240×1754 is A4); screen formats are at their own native size.
 *
 * `print` formats get a PDF at the matching paper size; screen formats get a PDF page of the same
 * proportions (a "slide" or "story" PDF is still a PDF).
 */
export type InfographicFormatId =
  | "A4_PORTRAIT"
  | "A4_LANDSCAPE"
  | "A3_PORTRAIT"
  | "A3_LANDSCAPE"
  | "SQUARE"
  | "PORTRAIT_4_5"
  | "STORY"
  | "SLIDE_16_9"
  | "BANNER";

export interface InfographicFormat {
  id: InfographicFormatId;
  label: string;
  description: string;
  width: number;
  height: number;
  margin: number;
  /** True when the canvas is one page only (social/slide); false when content may flow onto more pages. */
  singlePage: boolean;
  kind: "PRINT" | "SCREEN";
  /** PDF page size in points (72 dpi) for this canvas's proportions. */
  pdf: { width: number; height: number };
}

const pdfOf = (w: number, h: number, longEdgePt: number): { width: number; height: number } => {
  const k = longEdgePt / Math.max(w, h);
  return { width: Math.round(w * k * 100) / 100, height: Math.round(h * k * 100) / 100 };
};

export const INFOGRAPHIC_FORMATS: Readonly<Record<InfographicFormatId, InfographicFormat>> = {
  A4_PORTRAIT: { id: "A4_PORTRAIT", label: "A4 portrait", description: "Print and email, 210 × 297 mm.", width: 1240, height: 1754, margin: 72, singlePage: false, kind: "PRINT", pdf: { width: 595.28, height: 841.89 } },
  A4_LANDSCAPE: { id: "A4_LANDSCAPE", label: "A4 landscape", description: "Print and email, 297 × 210 mm.", width: 1754, height: 1240, margin: 72, singlePage: false, kind: "PRINT", pdf: { width: 841.89, height: 595.28 } },
  A3_PORTRAIT: { id: "A3_PORTRAIT", label: "A3 portrait", description: "Poster, 297 × 420 mm.", width: 1754, height: 2480, margin: 96, singlePage: false, kind: "PRINT", pdf: { width: 841.89, height: 1190.55 } },
  A3_LANDSCAPE: { id: "A3_LANDSCAPE", label: "A3 landscape", description: "Poster, 420 × 297 mm.", width: 2480, height: 1754, margin: 96, singlePage: false, kind: "PRINT", pdf: { width: 1190.55, height: 841.89 } },
  SQUARE: { id: "SQUARE", label: "Square 1:1", description: "Social feeds, 1080 × 1080.", width: 1080, height: 1080, margin: 48, singlePage: true, kind: "SCREEN", pdf: pdfOf(1080, 1080, 595.28) },
  PORTRAIT_4_5: { id: "PORTRAIT_4_5", label: "Portrait 4:5", description: "Social feeds, 1080 × 1350.", width: 1080, height: 1350, margin: 48, singlePage: true, kind: "SCREEN", pdf: pdfOf(1080, 1350, 700) },
  STORY: { id: "STORY", label: "Story 9:16", description: "Stories and status, 1080 × 1920.", width: 1080, height: 1920, margin: 56, singlePage: true, kind: "SCREEN", pdf: pdfOf(1080, 1920, 841.89) },
  SLIDE_16_9: { id: "SLIDE_16_9", label: "Slide 16:9", description: "Presentations, 1920 × 1080.", width: 1920, height: 1080, margin: 64, singlePage: true, kind: "SCREEN", pdf: pdfOf(1920, 1080, 841.89) },
  BANNER: { id: "BANNER", label: "Web banner 3:1", description: "Website headers, 1500 × 500.", width: 1500, height: 500, margin: 32, singlePage: true, kind: "SCREEN", pdf: pdfOf(1500, 500, 841.89) },
};

export const INFOGRAPHIC_FORMAT_IDS = Object.keys(INFOGRAPHIC_FORMATS) as InfographicFormatId[];
export const DEFAULT_FORMAT_ID: InfographicFormatId = "A4_PORTRAIT";

export function formatById(id: string | undefined): InfographicFormat | undefined {
  if (!id) return undefined;
  return (INFOGRAPHIC_FORMATS as Readonly<Record<string, InfographicFormat | undefined>>)[id];
}

/** The format a design is drawn in: its own, or A4 portrait for a design saved before formats existed. */
export function resolveFormat(id: string | undefined): InfographicFormat {
  return formatById(id) ?? INFOGRAPHIC_FORMATS[DEFAULT_FORMAT_ID];
}

/** The 12-column grid of a format: column width and the width a span of N columns takes. */
export interface GridMetrics {
  contentWidth: number;
  gap: number;
  columnWidth: number;
  spanWidth(span: number): number;
}

export function gridFor(format: InfographicFormat): GridMetrics {
  const contentWidth = format.width - format.margin * 2;
  const gap = format.width >= 1700 ? 20 : 16;
  const columnWidth = (contentWidth - gap * 11) / 12;
  return { contentWidth, gap, columnWidth, spanWidth: (span) => columnWidth * span + gap * (span - 1) };
}

/** The spans a section may take. 12 is full width; the others tile into rows that add up to 12. */
export const GRID_SPANS = [3, 4, 6, 8, 9, 12] as const;
export type GridSpan = (typeof GRID_SPANS)[number];

/** Old `size` values mean these spans; a design that never chose a span keeps its old layout. */
export const SIZE_TO_SPAN = { THIRD: 4, HALF: 6, FULL: 12 } as const;

/**
 * Packs sections into rows of at most 12 columns, in order. A section that does not fit on the row
 * starts the next one; `breakBefore` forces a new row (the composer also starts a new page there).
 */
export function packRows<T extends { span: number; breakBefore?: boolean }>(items: readonly T[]): T[][] {
  const rows: T[][] = [];
  let current: T[] = [];
  let used = 0;
  for (const item of items) {
    if (current.length > 0 && (item.breakBefore || used + item.span > 12)) {
      rows.push(current);
      current = [];
      used = 0;
    }
    current.push(item);
    used += item.span;
  }
  if (current.length > 0) rows.push(current);
  return rows;
}
