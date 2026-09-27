import { MAX_SECTION_LEVEL, createSection, placeChildrenAfterParents, type TemplateSection, type TemplateSectionInput } from "@donordesk/domain";

export interface SectionDraft extends Omit<TemplateSectionInput, "id" | "parentId" | "level" | "order"> {
  ref: string;
  parentRef?: string;
}

/**
 * Turns flat extractor drafts (with parent refs) into a valid section tree:
 * unknown parents are detached, depth is capped at MAX_SECTION_LEVEL by
 * re-parenting to the deepest allowed ancestor, and drafts whose content is
 * invalid are skipped (reported through `warnings`).
 */
export function buildSectionTree(drafts: readonly SectionDraft[], warnings: string[]): TemplateSection[] {
  const idByRef = new Map<string, string>();
  const parentByRef = new Map<string, string | undefined>();
  for (const d of drafts) {
    if (!idByRef.has(d.ref)) idByRef.set(d.ref, crypto.randomUUID());
  }
  for (const d of drafts) parentByRef.set(d.ref, d.parentRef && idByRef.has(d.parentRef) && d.parentRef !== d.ref ? d.parentRef : undefined);

  const depthOf = (ref: string, seen = new Set<string>()): number => {
    const p = parentByRef.get(ref);
    if (!p || seen.has(p)) return 1;
    seen.add(ref);
    return depthOf(p, seen) + 1;
  };
  const cappedParent = (ref: string): string | undefined => {
    let parent = parentByRef.get(ref);
    while (parent && depthOf(parent) >= MAX_SECTION_LEVEL) parent = parentByRef.get(parent);
    return parent;
  };

  const sections: TemplateSection[] = [];
  const seenRefs = new Set<string>();
  for (const d of drafts) {
    if (seenRefs.has(d.ref)) continue;
    seenRefs.add(d.ref);
    const { ref, parentRef: _p, ...input } = d;
    const parent = cappedParent(ref);
    try {
      sections.push(
        createSection({
          ...input,
          id: idByRef.get(ref),
          parentId: parent ? idByRef.get(parent) : undefined,
          level: 1,
          reviewStatus: "DRAFT",
        }),
      );
    } catch (error) {
      warnings.push(`Skipped section "${d.title}": ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return placeChildrenAfterParents(sections).map((s, order) => ({ ...s, order }));
}

const NUMBERING = [
  /^((?:section|part|chapter)\s+[\dIVX]+(?:\.\d+)*)[.:)\-–]?\s+(.+)$/i,
  /^((?:annex|appendix|attachment)\s+[A-Z\d]+)[.:)\-–]?\s*(.*)$/i,
  /^((?:\d+\.){0,3}\d+)\.?\s+(.+)$/,
  /^([IVX]{1,5})[.)]\s+(.+)$/,
  /^([A-H])[.)]\s+(.+)$/,
];

/** Splits "2.1 Outcomes" → { numbering: "2.1", title: "Outcomes" }. */
export function splitNumbering(heading: string): { numbering?: string; title: string } {
  const text = heading.replace(/\s+/g, " ").replace(/[:\s]+$/, "").trim();
  for (const re of NUMBERING) {
    const m = re.exec(text);
    if (m) {
      const rest = (m[2] ?? "").trim();
      if (!rest) return { title: m[1]! };
      return { numbering: m[1]!, title: rest };
    }
  }
  return { title: text };
}
