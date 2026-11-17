/**
 * Words on a block (Phase 61.5). A block writes some of its own text (a headline, a caption, an "as of" line). Every one of those can be
 * replaced by the person; the automatic words stay as the placeholder and a reset puts them back. An edited string no longer follows the
 * data, so it is marked as edited, and the Design check warns when an edited string states a figure the block does not hold.
 * Text always wraps: nothing here ever cuts a string short.
 */
import { TEXT_SLOTS, type BlockFormat, type TextSlot, type TextsFormat } from "../format/types.js";

export interface ResolvedText { value: string; origin: "AUTO" | "EDITED"; /** The words the block writes for itself; shown as the placeholder and restored by a reset. */ auto: string }

export const TEXT_SLOT_LABEL: Readonly<Record<TextSlot, string>> = { title: "Headline", subtitle: "Subtitle", caption: "Caption", source: "Source line", asOf: "As-of line", empty: "Empty-block message" };

/** The text to show: the person's words when they wrote some, else the block's own. A blank override is not an edit. */
export function resolveText(slot: TextSlot, auto: string, format: BlockFormat | undefined): ResolvedText {
  const own = format?.texts?.[slot];
  return own !== undefined && own.trim() !== "" ? { value: own, origin: "EDITED", auto } : { value: auto, origin: "AUTO", auto };
}

export const editedSlots = (format: BlockFormat | undefined): TextSlot[] => TEXT_SLOTS.filter((s) => (format?.texts?.[s] ?? "").trim() !== "");

/** Sets one text, or puts the automatic words back when `value` is undefined or blank. Returns the new format (the input is not changed). */
export function withText(format: BlockFormat | undefined, slot: TextSlot, value: string | undefined): BlockFormat | undefined {
  const texts: TextsFormat = { ...(format?.texts ?? {}) };
  if (value === undefined || value.trim() === "") delete texts[slot]; else texts[slot] = value;
  const next: BlockFormat = { ...(format ?? {}) };
  if (Object.keys(texts).length > 0) next.texts = texts; else delete next.texts;
  return Object.keys(next).length > 0 ? next : undefined;
}

export const resetAllTexts = (format: BlockFormat | undefined): BlockFormat | undefined => {
  if (!format?.texts) return format;
  const { texts: _gone, ...rest } = format;
  return Object.keys(rest).length > 0 ? rest : undefined;
};

const FIGURE = /\d[\d,.\s]*\d|\d/g;
/** Figures in a string, as plain digits ("1,250" and "1250" are the same figure). */
export const textFiguresIn = (text: string): string[] => (text.match(FIGURE) ?? []).map((f) => f.replace(/[,\s]/g, "")).filter((f) => f.length > 0);

/** The figures an edited string states that the block's own words do not: a number typed by hand stops being true when the data moves. */
export function unbackedFigures(edited: string, auto: string): string[] {
  const held = new Set(textFiguresIn(auto));
  return textFiguresIn(edited).filter((f) => !held.has(f));
}

/** Breaks text into lines no wider than `maxWidth` using `measure` for a string's width. Words are never cut except a single word wider than the line, which is split by character; nothing is dropped and no "…" is added. */
export function wrapText(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    if (paragraph.trim() === "") { lines.push(""); continue; }
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const trial = line === "" ? word : `${line} ${word}`;
      if (measure(trial) <= maxWidth) { line = trial; continue; }
      if (line !== "") { lines.push(line); line = ""; }
      if (measure(word) <= maxWidth) { line = word; continue; }
      let chunk = "";
      for (const g of Array.from(word)) {
        if (chunk !== "" && measure(chunk + g) > maxWidth) { lines.push(chunk); chunk = g; } else chunk += g;
      }
      line = chunk;
    }
    if (line !== "") lines.push(line);
  }
  return lines;
}

/** A block's settings with the person's own words laid over the ones the block writes (headline, subtitle, caption, source), for a renderer that reads settings. Settings are not changed; a new object is returned only when something is edited. */
export function withTextOverrides<P extends object>(props: P, format: BlockFormat | undefined): P {
  const t = format?.texts;
  if (!t) return props;
  const next: Record<string, unknown> = { ...(props as Record<string, unknown>) };
  let changed = false;
  for (const [slot, key] of [["title", "title"], ["subtitle", "subtitle"], ["caption", "caption"], ["source", "source"]] as const) {
    const v = t[slot];
    if (v !== undefined && v.trim() !== "") { next[key] = v; changed = true; }
  }
  return changed ? (next as P) : props;
}
