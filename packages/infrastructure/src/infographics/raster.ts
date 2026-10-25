/**
 * Rasterizing and vector output for infographics (Phase 32.1), sized for the single Contabo host
 * (about 3 GB free, shared with the api, workers, web and Postgres):
 *
 * - No headless browser. A page is an SVG string; `resvg` (a Rust renderer, a few MB resident)
 *   turns it into a PNG, and `svg-to-pdfkit` writes the same SVG into a vector PDF with real,
 *   selectable text. Nothing else is started.
 * - Fonts are bundled (Liberation Sans, SIL OFL, metric-compatible with Arial/Helvetica) and system
 *   fonts are never loaded, so a page looks the same on every machine and in every environment.
 * - One render at a time (`withRenderSlot`): the peak memory of an export is bounded by one page.
 */
import { Resvg } from "@resvg/resvg-js";
import PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";
import { fileURLToPath } from "node:url";

const FONT_DIR = fileURLToPath(new URL("../../assets/fonts/", import.meta.url));
const FONT_FILES = {
  regular: `${FONT_DIR}LiberationSans-Regular.ttf`,
  bold: `${FONT_DIR}LiberationSans-Bold.ttf`,
  italic: `${FONT_DIR}LiberationSans-Italic.ttf`,
  boldItalic: `${FONT_DIR}LiberationSans-BoldItalic.ttf`,
  arabic: `${FONT_DIR}NotoSansArabic-Regular.ttf`,
  arabicBold: `${FONT_DIR}NotoSansArabic-Bold.ttf`,
} as const;
const FAMILY = "Liberation Sans";

let queue: Promise<unknown> = Promise.resolve();

/** Runs `job` after every earlier job has finished, whether it succeeded or not. */
export function withRenderSlot<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.catch(() => undefined);
  return run;
}

/** PNG of an SVG string. `scale` multiplies the SVG's own pixel size (2 = a retina/print image). */
export function svgToPng(svg: string, scale = 1): Buffer {
  const resvg = new Resvg(svg, {
    font: {
      fontFiles: Object.values(FONT_FILES),
      loadSystemFonts: false,
      defaultFontFamily: FAMILY,
      sansSerifFamily: FAMILY,
      serifFamily: FAMILY,
    },
    fitTo: scale === 1 ? { mode: "original" } : { mode: "zoom", value: scale },
    shapeRendering: 2,
    textRendering: 1,
    imageRendering: 0,
  });
  return Buffer.from(resvg.render().asPng());
}

/** Whether a page holds right-to-left script (Arabic, Hebrew). The vector PDF writer does not shape or reorder it, so such a page goes into the PDF as a picture. */
export const hasRightToLeftScript = (svg: string): boolean => /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/.test(svg);

const faceFor = (bold: boolean, italic: boolean): string => (bold ? (italic ? "LS-BoldItalic" : "LS-Bold") : italic ? "LS-Italic" : "LS-Regular");

export type PdfDoc = InstanceType<typeof PDFDocument>;

const PDF_LANG: Readonly<Record<string, string>> = { en: "en-US", fr: "fr-FR", es: "es-ES", ar: "ar" };

/** A pdfkit document with the bundled faces registered under the names `addSvgPage` asks for. Tagged: each page is a figure with its description. */
export function newPdf(info: { Title: string; Author: string; Subject?: string; Keywords?: string }, firstPage: { width: number; height: number }, language = "en"): PdfDoc {
  const doc = new PDFDocument({ size: [firstPage.width, firstPage.height], margin: 0, info, autoFirstPage: true, tagged: true, lang: PDF_LANG[language] ?? "en-US", displayTitle: true });
  doc.registerFont("LS-Regular", FONT_FILES.regular);
  doc.registerFont("LS-Bold", FONT_FILES.bold);
  doc.registerFont("LS-Italic", FONT_FILES.italic);
  doc.registerFont("LS-BoldItalic", FONT_FILES.boldItalic);
  return doc;
}

/** The document's structure tree: a Document holding one Figure (with its description) per page. */
export interface PdfStructure {
  document: unknown;
}

export function beginStructure(doc: PdfDoc): PdfStructure {
  return { document: (doc as unknown as { struct(type: string): unknown }).struct("Document") };
}

export function endStructure(doc: PdfDoc, structure: PdfStructure): void {
  (doc as unknown as { addStructure(element: unknown): void }).addStructure(structure.document);
}

/** Marks the page's drawing as a described figure in the structure tree. `draw` runs between the marks. */
export function inFigure(doc: PdfDoc, structure: PdfStructure, alt: string, draw: () => void): void {
  const d = doc as unknown as { markStructureContent(tag: string): unknown; endMarkedContent(): void; struct(type: string, options: object, children: unknown[]): unknown };
  const content = d.markStructureContent("Figure");
  draw();
  d.endMarkedContent();
  (structure.document as { add(child: unknown): void }).add(d.struct("Figure", { alt }, [content]));
}

/** Adds one SVG page to a pdfkit document as vector content (text stays text). The first page is the one the document opened with. */
export function addSvgPage(doc: PdfDoc, svg: string, page: { width: number; height: number }, first: boolean): void {
  if (!first) doc.addPage({ size: [page.width, page.height], margin: 0 });
  drawSvg(doc, svg, page);
}

/** Draws an SVG onto the current page of the document (the page must already exist). */
export function drawSvg(doc: PdfDoc, svg: string, page: { width: number; height: number }): void {
  SVGtoPDF(doc, svg, 0, 0, {
    width: page.width,
    height: page.height,
    preserveAspectRatio: "xMinYMin meet",
    assumePt: false,
    fontCallback: (_family: string, bold: boolean, italic: boolean) => faceFor(bold, italic),
    useCSS: false,
  });
}
