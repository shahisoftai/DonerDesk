/**
 * Which sections a part reads (Phase 37 §9): a part's `sectionTitles` are fragments of the headings that normally hold its
 * information (English, French, Spanish). A block is routed to the part when any title in its section path contains one of
 * them as whole words. Routing ranks where to look; it never limits it (keyword ranking still fills the rest).
 */
const fold = (t: string): string => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();

const escape = (t: string): string => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Compiled once per list: whole-word fragments, so "result" does not match "consult". */
export function compileSectionTitles(titles: ReadonlyArray<string>): RegExp | null {
  if (titles.length === 0) return null;
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${titles.map((t) => escape(fold(t))).join("|")})(?![\\p{L}\\p{N}])`, "u");
}

/** True when a heading in the block's section path matches the part's titles. */
export function sectionMatches(section: string | undefined, matcher: RegExp | null): boolean {
  return !!section && !!matcher && matcher.test(fold(section));
}

/** The label line the prompt shows before a run of blocks from one section. */
export const sectionLabel = (section: string): string => `§ ${section}`;
