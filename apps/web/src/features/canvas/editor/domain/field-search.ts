/**
 * Searching the Format tab (Phase 50.1, like Power BI's format search): a section matches when its own name does (it is shown whole) or
 * when some of its fields do (only those are shown). The words are the translated labels the person reads. Pure.
 */
import type { FormatSection } from "./format-sections";

const fold = (s: string): string => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

export function matchSections(sections: readonly FormatSection[], query: string, label: (key: string) => string): FormatSection[] {
  const q = fold(query);
  if (!q) return [...sections];
  const out: FormatSection[] = [];
  for (const s of sections) {
    if (fold(label(s.labelKey)).includes(q)) { out.push(s); continue; }
    const fields = s.fields.filter((f) => fold(label(f.labelKey)).includes(q));
    if (fields.length) out.push({ ...s, fields });
  }
  return out;
}
