/**
 * Which parts a set of documents contains (user rule, 2026-11-04): documents differ, so the headings are examined before
 * anything is read. A heading mapped to a part whose text holds nothing (blank table, template prompts, zeros) is EMPTY: the part
 * is left empty and highlighted, and nothing is filled in from elsewhere. Emptiness is decided here from the text, never by a
 * model. Pure.
 */
import { templatePlaceholder } from "./template-placeholders.js";
import type { SetupAreaKey } from "./proposal-areas.js";
import type { SourceBlock } from "./source-document.js";

/** FOUND: has content. PARTLY_EMPTY: some of its sections are blank. EMPTY: every section is blank. NOT_IN_DOCUMENTS: no heading and nothing read. */
export type SectionState = "FOUND" | "PARTLY_EMPTY" | "EMPTY" | "NOT_IN_DOCUMENTS";

export interface SectionFinding {
  area: SetupAreaKey;
  state: SectionState;
  /** The headings that are blank, as the document writes them. */
  emptyHeadings: string[];
}

/** A section outline the survey shows the model: headings only, with how much each holds. */
export interface SectionOutlineEntry {
  path: string;
  chars: number;
  sample: string;
}

const lastHeading = (path: string): string => path.split(" > ").pop()!.trim();

const BLANK_CELL = /^[-–—_.:;|x☐☒\s0]*$/i;
const cellsOf = (line: string): string[] => line.trim().split(/\s\|\s|\t|\s\|$/).map((c) => c.trim());
const cellSaysNothing = (c: string): boolean => !c || BLANK_CELL.test(c) || /^(n\/?a|none|nil)$/i.test(c) || templatePlaceholder(c) === "WHOLE";

/** A row or line with no statement: every cell blank, or a label in the first cell and nothing after it. */
const lineSaysNothing = (line: string, heading: string): boolean => {
  const t = line.trim();
  if (!t || t === heading) return true;
  const cells = cellsOf(t);
  return cells.length === 1 ? cellSaysNothing(t) : cells.slice(1).every(cellSaysNothing);
};

/**
 * True when a section's blocks hold no statement at all. A table's first row may be its column names, so it is ignored only when
 * rows follow it: a lone row with values counts as content. When in doubt a section is not empty, so it is read, not skipped.
 */
export function sectionIsEmpty(blocks: ReadonlyArray<SourceBlock>): boolean {
  return blocks.every((b) => {
    const heading = b.section ? lastHeading(b.section) : "";
    const lines = b.text.split(/\r?\n/).filter((l) => l.trim());
    const firstRow = lines.findIndex((l) => cellsOf(l).length > 1);
    return lines.every((line, i) => (i === firstRow && lines.length > i + 1) || lineSaysNothing(line, heading));
  });
}

/** Each section once, in reading order, with a short sample: all a survey needs. */
export function sectionOutline(blocks: ReadonlyArray<SourceBlock>, sampleChars = 120): SectionOutlineEntry[] {
  const out = new Map<string, SectionOutlineEntry>();
  for (const b of blocks) {
    if (!b.section) continue;
    const entry = out.get(b.section) ?? { path: b.section, chars: 0, sample: "" };
    entry.chars += b.text.length;
    if (entry.sample.length < sampleChars) entry.sample = `${entry.sample} ${b.text}`.replace(/\s+/g, " ").trim().slice(0, sampleChars);
    out.set(b.section, entry);
  }
  return [...out.values()];
}

/** The finding for one part from the sections that belong to it. */
export function findingFor(area: SetupAreaKey, sections: ReadonlyArray<string>, blocks: ReadonlyArray<SourceBlock>): SectionFinding {
  const empty = sections.filter((s) => sectionIsEmpty(blocks.filter((b) => b.section === s)));
  const emptyHeadings = empty.map(lastHeading);
  if (sections.length === 0) return { area, state: "NOT_IN_DOCUMENTS", emptyHeadings: [] };
  return { area, state: empty.length === sections.length ? "EMPTY" : empty.length > 0 ? "PARTLY_EMPTY" : "FOUND", emptyHeadings };
}
