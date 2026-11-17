/**
 * A theme is enforced (Phase 61.6): selecting one gives every block its fonts, colours and frame. A block may still differ, but only as
 * an explicit override that is listed and can be cleared. This file finds those overrides, clears them, and applies a theme with the
 * rule "overrides go, unless the person marked the block to keep its own colours".
 */
import type { BlockInstance, Canvas, CanvasPage } from "../canvas.js";
import type { BlockFormat, ColourChoice } from "../format/types.js";

export interface ThemeOverride { blockId: string; what: string[] }

const isHex = (c: ColourChoice | undefined): boolean => Boolean(c && "hex" in c);
const specOf = (b: BlockInstance): { colors?: unknown; series?: Array<{ color?: string }>; paletteId?: string } | undefined => (b.props as { spec?: { colors?: unknown; series?: Array<{ color?: string }>; paletteId?: string } } | undefined)?.spec;

/** What this block sets that the theme would otherwise decide: chart colours, a custom font, hex colours in its formatting. */
export function overridesOf(b: BlockInstance): string[] {
  const out: string[] = [];
  const f = b.format;
  const spec = specOf(b);
  if (spec && Array.isArray(spec.colors) && spec.colors.length > 0) out.push("chart colours");
  if (spec?.series?.some((s) => s.color)) out.push("series colours");
  if (spec?.paletteId && spec.paletteId !== "STANDARD") out.push("colour set");
  if ((f?.colors?.series?.length ?? 0) > 0) out.push("series colours");
  if (f?.typography?.fontId) out.push("font");
  const picked = [f?.title?.color, f?.callout?.color, f?.callout?.labelColor, f?.accentBar?.color, f?.frame?.borderColor, f?.typography?.color, f?.table?.headerFill, f?.referenceLabels?.color];
  if (picked.some(isHex)) out.push("custom colours");
  return [...new Set(out)];
}

const pagesOf = (c: Canvas): CanvasPage[] => c.pages;

/** Blocks that differ from the theme, with what differs. A block the person marked "keep my colours" is listed too, so nothing is hidden. */
export function themeConformance(c: Canvas): ThemeOverride[] {
  const out: ThemeOverride[] = [];
  for (const p of pagesOf(c)) for (const b of p.blocks) { const what = overridesOf(b); if (what.length > 0) out.push({ blockId: b.id, what }); }
  return out;
}

const stripHex = (c: ColourChoice | undefined): ColourChoice | undefined => (isHex(c) ? undefined : c);

/** The block with its theme overrides removed: colours, custom font and hex colours go; sizes, words and layout stay. */
export function clearOverrides(b: BlockInstance): BlockInstance {
  const f: BlockFormat | undefined = b.format ? structuredClone(b.format) : undefined;
  if (f) {
    delete f.colors;
    if (f.typography) { delete f.typography.fontId; delete f.typography.color; if (Object.keys(f.typography).length === 0) delete f.typography; }
    if (f.title) { const c = stripHex(f.title.color); if (c) f.title.color = c; else delete f.title.color; }
    if (f.callout) { const c = stripHex(f.callout.color), l = stripHex(f.callout.labelColor); if (c) f.callout.color = c; else delete f.callout.color; if (l) f.callout.labelColor = l; else delete f.callout.labelColor; }
    if (f.accentBar) { const c = stripHex(f.accentBar.color); if (c) f.accentBar.color = c; else delete f.accentBar.color; }
    if (f.frame) { const c = stripHex(f.frame.borderColor); if (c) f.frame.borderColor = c; else delete f.frame.borderColor; }
    if (f.table) { const c = stripHex(f.table.headerFill); if (c) f.table.headerFill = c; else delete f.table.headerFill; }
    if (f.referenceLabels) { const c = stripHex(f.referenceLabels.color); if (c) f.referenceLabels.color = c; else delete f.referenceLabels.color; }
  }
  let props = b.props;
  const spec = specOf(b);
  if (spec && (spec.colors !== undefined || spec.series?.some((s) => s.color) || spec.paletteId)) {
    const clone = structuredClone(b.props) as { spec: { colors?: unknown; series?: Array<{ color?: string }>; paletteId?: string } };
    delete clone.spec.colors; delete clone.spec.paletteId;
    if (clone.spec.series) for (const s of clone.spec.series) delete s.color;
    props = clone;
  }
  return { ...b, props, format: f && Object.keys(f).length > 0 ? f : undefined, style: b.style?.keepOwnColours ? { ...b.style, keepOwnColours: undefined } : b.style };
}

/** Clears overrides on the named blocks (all blocks when `ids` is empty). */
export function resetToTheme(c: Canvas, ids: readonly string[] = []): Canvas {
  const all = ids.length === 0;
  const set = new Set(ids);
  return { ...c, pages: c.pages.map((p) => ({ ...p, blocks: p.blocks.map((b) => (all || set.has(b.id) ? clearOverrides(b) : b)) })) };
}

/** Selecting a theme: the canvas takes it and every block follows it. Blocks the person marked to keep their colours keep them; all others lose their overrides. */
export function applyTheme(c: Canvas, themeId: string): Canvas {
  const next: Canvas = { ...c, themeId, pages: c.pages.map((p) => ({ ...p, themeId: undefined, blocks: p.blocks.map((b) => (b.style?.keepOwnColours ? b : clearOverrides(b))) })) };
  return next;
}

/** Marks a block to keep its own colours across theme changes (or unmarks it). */
export function keepOwnColours(c: Canvas, id: string, keep: boolean): Canvas {
  return { ...c, pages: c.pages.map((p) => ({ ...p, blocks: p.blocks.map((b) => (b.id === id ? { ...b, style: { ...b.style, keepOwnColours: keep ? true : undefined } } : b)) })) };
}
