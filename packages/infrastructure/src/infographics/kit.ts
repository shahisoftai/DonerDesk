/**
 * The drawing kit the infographic blocks share (Phase 32): the render context, the SVG helpers,
 * a width-based text wrapper and the number/word helpers. Everything here is pure and
 * deterministic; no block touches a clock, a font file or the network.
 */
import type { PortfolioInfographicDataDto, ProjectInfographicDataDto } from "@donordesk/application";
import {
  iconSvg,
  formatNumber,
  labelsFor,
  type DataSheet,
  type GridMetrics,
  type InfographicConfig,
  type InfographicFormat,
  type InfographicLabels,
  type InfographicRounding,
  type InfographicTheme,
} from "@donordesk/domain";

/** An uploaded image ready to embed (already normalised: EXIF stripped, size bounded). */
export interface RenderAsset {
  dataUri: string;
  width: number;
  height: number;
}

export interface MapPointInput {
  name: string;
  lat: number;
  lng: number;
  worst: string;
  count?: number;
}

/** A simplified outline the browser resolved from the bundled boundaries (no geometry is stored server-side). */
export interface MapShapeInput {
  /** Rings of [lng, lat]. */
  rings: Array<Array<[number, number]>>;
  /** `COUNTRY` is the base outline; `REGION` a first-level area, optionally carrying a value for shading. */
  kind: "COUNTRY" | "REGION";
  name?: string;
  value?: number;
}

export interface RenderCtx {
  t: InfographicTheme;
  /** Right-to-left language: the page is mirrored, and text, pictures and icons are flipped back so they read normally. */
  rtl: boolean;
  /** The font stack for text (the theme's, with the bundled Arabic face first on a right-to-left page). */
  font: string;
  format: InfographicFormat;
  grid: GridMetrics;
  /** Type and spacing scale: 1 at 1240 px wide, larger on bigger canvases. */
  s: number;
  lang: string;
  l: InfographicLabels;
  config: InfographicConfig;
  data: ProjectInfographicDataDto;
  /** A portfolio design's data (every project the person can see); absent in a project design. */
  portfolio?: PortfolioInfographicDataDto;
  sheet: DataSheet;
  mapPoints: MapPointInput[];
  mapShapes: MapShapeInput[];
  assets: ReadonlyMap<string, RenderAsset>;
  /** Counts the charts drawn so far, so each gets its own stable element ids (the chart engine's own counter is global and would make identical inputs differ). */
  chartSeq: number;
  /** True while the Studio previews: empty authored blocks draw a hint instead of being left out. */
  preview: boolean;
}

export interface Slot {
  svg: string;
  height: number;
  width: number;
}

/**
 * A picture may enter the SVG only as a base64 `data:` URI of a PNG, JPEG, GIF or WebP, nothing else: no quotes, no
 * spaces, no other scheme. A value that does not match is dropped, so a crafted logo or image value can never close the
 * attribute it sits in and add one of its own (an SVG file opened directly can run `onload`).
 */
const SAFE_IMAGE_URI = /^data:image\/(?:png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
export function safeImageUri(value: string | undefined): string | undefined {
  return value !== undefined && value.length <= 8_000_000 && SAFE_IMAGE_URI.test(value) ? value : undefined;
}

export const esc = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

// Average advance widths of Liberation Sans (Arial metrics) in em, by character class. Good to within a few
// percent for wrapping; deterministic and font-file free.
const NARROW = new Set("iIl.,;:'|!jtf()[]/\\ -–—·".split(""));
const WIDE = new Set("mwMW@%".split(""));
export function textWidth(value: string, size: number, bold = false): number {
  let em = 0;
  for (const ch of value) {
    if (NARROW.has(ch)) em += 0.3;
    else if (WIDE.has(ch)) em += 0.86;
    else if (ch >= "0" && ch <= "9") em += 0.556;
    else if (ch >= "A" && ch <= "Z") em += 0.68;
    else if (ch >= "À" && ch <= "Þ") em += 0.68;
    else em += 0.53;
  }
  return em * size * (bold ? 1.06 : 1);
}

/** Wraps to a pixel width. A word longer than the line is cut at the width rather than overflowing. */
export function wrapText(value: string, maxWidth: number, size: number, maxLines: number, bold = false): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  const push = (line: string): void => void lines.push(line);
  for (const raw of words) {
    let word = raw;
    while (textWidth(word, size, bold) > maxWidth && word.length > 1) {
      // Hard-split an over-long word.
      let cut = word.length - 1;
      while (cut > 1 && textWidth(word.slice(0, cut), size, bold) > maxWidth) cut -= 1;
      if (current) {
        push(current);
        current = "";
        if (lines.length >= maxLines) return ellipsize(lines, maxLines, maxWidth, size, bold, true);
      }
      push(word.slice(0, cut));
      if (lines.length >= maxLines) return ellipsize(lines, maxLines, maxWidth, size, bold, true);
      word = word.slice(cut);
    }
    const candidate = current ? `${current} ${word}` : word;
    if (current && textWidth(candidate, size, bold) > maxWidth) {
      push(current);
      current = word;
      if (lines.length >= maxLines) return ellipsize(lines, maxLines, maxWidth, size, bold, true);
    } else current = candidate;
  }
  if (current) push(current);
  return lines.length > maxLines ? ellipsize(lines.slice(0, maxLines), maxLines, maxWidth, size, bold, true) : lines;
}

function ellipsize(lines: string[], maxLines: number, maxWidth: number, size: number, bold: boolean, more: boolean): string[] {
  const out = lines.slice(0, maxLines);
  if (!more || out.length === 0) return out;
  let last = out[out.length - 1] ?? "";
  while (last.length > 1 && textWidth(`${last}…`, size, bold) > maxWidth) last = last.slice(0, -1);
  out[out.length - 1] = `${last.trimEnd()}…`;
  return out;
}

export interface TextOpts {
  size?: number;
  fill?: string;
  bold?: boolean;
  italic?: boolean;
  anchor?: "start" | "middle" | "end";
  spacing?: number;
  opacity?: number;
}

/**
 * Draws a picture or icon the right way round on a mirrored (right-to-left) page: the page group is mirrored, so a
 * picture is flipped back about its own centre line `cx`. Does nothing on a left-to-right page.
 */
export const flipBack = (c: RenderCtx, cx: number, svg: string): string => (c.rtl ? `<g transform="translate(${r(cx * 2)} 0) scale(-1 1)">${svg}</g>` : svg);

/** One bundled icon, drawn the right way round. */
export const icon = (c: RenderCtx, id: string | undefined, x: number, y: number, size: number, fill: string): string => flipBack(c, x + size / 2, iconSvg(id, x, y, size, fill));

export const text = (c: RenderCtx, x: number, y: number, value: string, o: TextOpts = {}): string => {
  // On a mirrored page an anchor swaps sides and the text is flipped back about its own anchor, so it reads normally and
  // sits at the mirrored position (start-aligned text becomes right-aligned there).
  const anchor = c.rtl ? (o.anchor === "end" ? "start" : o.anchor === "middle" ? "middle" : "end") : o.anchor;
  const flip = c.rtl ? ` transform="translate(${r(x * 2)} 0) scale(-1 1)"` : "";
  const spacing = o.spacing && !c.rtl ? ` letter-spacing="${o.spacing}"` : "";
  return `<text x="${r(x)}" y="${r(y)}"${flip} font-family="${c.font}" font-size="${r(o.size ?? 12)}" fill="${o.fill ?? c.t.ink}"${o.bold ? ` font-weight="bold"` : ""}${o.italic && !c.rtl ? ` font-style="italic"` : ""}${anchor ? ` text-anchor="${anchor}"` : ""}${spacing}${o.opacity !== undefined ? ` opacity="${o.opacity}"` : ""}>${esc(value)}</text>`;
};

/** Multi-line text; returns the svg and the height used. */
export function paragraph(c: RenderCtx, x: number, y: number, value: string, width: number, o: TextOpts & { maxLines: number; lineHeight?: number }): { svg: string; height: number; lines: number } {
  const size = o.size ?? 12;
  const lh = o.lineHeight ?? size * 1.4;
  const lines = wrapText(value, width, size, o.maxLines, o.bold);
  const svg = lines.map((line, i) => text(c, x, y + size + i * lh, line, o)).join("");
  return { svg, height: lines.length * lh, lines: lines.length };
}

/** Rounds to 2 decimals for compact, stable SVG. */
export const r = (n: number): string => String(Math.round(n * 100) / 100);

export const panelRect = (c: RenderCtx, y: number, height: number, width: number, fill: string = c.t.card, stroke: string = c.t.cardStroke): string =>
  `<rect x="0" y="${r(y)}" width="${r(width)}" height="${r(height)}" rx="${c.t.radius}" fill="${fill}" stroke="${stroke}"/>`;

/** The heading of a block, in the theme's case. Returns "" for a block with no heading. */
export function heading(c: RenderCtx, title: string | undefined): string {
  if (!title) return "";
  const shown = c.t.headingCase === "UPPER" ? title.toUpperCase() : title;
  const size = 15 * c.s;
  return text(c, 0, size + 1, shown, { size, bold: true, fill: c.t.accent, ...(c.t.headingCase === "UPPER" ? { spacing: 1 } : {}) });
}

/** Height a heading takes (so bodies start below it). */
export const headingHeight = (c: RenderCtx, title: string | undefined): number => (title ? 26 * c.s : 0);

/** A block with a heading and a bordered panel of `bodyHeight`; the body is drawn at (0, headingHeight). */
export function framed(c: RenderCtx, title: string | undefined, width: number, bodyHeight: number, body: string, fill?: string): Slot {
  const top = headingHeight(c, title);
  return { svg: `${heading(c, title)}${panelRect(c, top, bodyHeight, width, fill)}<g transform="translate(0 ${r(top)})">${body}</g>`, height: top + bodyHeight + 18 * c.s, width };
}

export function notReported(c: RenderCtx, title: string | undefined, width: number, bodyHeight = 72): Slot {
  const h = bodyHeight * c.s;
  return framed(c, title, width, h, text(c, 20 * c.s, h / 2 + 5 * c.s, c.l.notYetReported, { size: 13 * c.s, fill: c.t.subtle, italic: true }));
}

/** What a still-empty authored block shows in the Studio preview (and nothing in an export). */
export function previewHint(c: RenderCtx, title: string | undefined, width: number, hint: string): Slot | undefined {
  if (!c.preview) return undefined;
  const h = 64 * c.s;
  const top = headingHeight(c, title);
  return {
    width,
    height: top + h + 18 * c.s,
    svg: `${heading(c, title)}<rect x="0" y="${r(top)}" width="${r(width)}" height="${r(h)}" rx="${c.t.radius}" fill="none" stroke="${c.t.line}" stroke-dasharray="6 5"/>${text(c, width / 2, top + h / 2 + 5 * c.s, hint, { size: 13 * c.s, fill: c.t.subtle, anchor: "middle", italic: true })}`,
  };
}

export const fmt = (c: RenderCtx, value: number, rounding?: InfographicRounding): string => formatNumber(value, c.lang, rounding ?? "NONE");

export const labelsOf = (lang: string | undefined): InfographicLabels => labelsFor(lang);

/** Parses a recorded figure ("1,250", "62.5") into a number; null when it is not one. */
export function parseFigure(value: string | undefined | null): number | null {
  if (value === undefined || value === null) return null;
  const cleaned = value.replace(/[,\s]/g, "").replace(/%$/, "");
  if (cleaned === "" || !/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  return Number(cleaned);
}

/** An arc path for a ring segment starting at 12 o'clock, clockwise. `fraction` in (0, 1]. */
export function arcPath(cx: number, cy: number, radius: number, fraction: number): string {
  const f = Math.min(Math.max(fraction, 0), 0.9999);
  const angle = f * Math.PI * 2;
  const x = cx + radius * Math.sin(angle);
  const y = cy - radius * Math.cos(angle);
  const large = f > 0.5 ? 1 : 0;
  return `M ${r(cx)} ${r(cy - radius)} A ${r(radius)} ${r(radius)} 0 ${large} 1 ${r(x)} ${r(y)}`;
}

const hexRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Mixes two `#rrggbb` colours; `w` is the weight of `b` (0..1). */
export function mixHex(a: string, b: string, w: number): string {
  const [ar, ag, ab] = hexRgb(a);
  const [br, bg, bb] = hexRgb(b);
  const ch = (x: number, y: number): string => Math.round(x + (y - x) * w).toString(16).padStart(2, "0");
  return `#${ch(ar, br)}${ch(ag, bg)}${ch(ab, bb)}`;
}
