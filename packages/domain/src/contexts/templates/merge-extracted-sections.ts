import type { TemplateSection } from "./template-section.js";

function key(title: string): string {
  return title.toLowerCase().replace(/^[\divxlc.)\s]+/i, "").replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Merges a fresh extraction into the current sections without losing human work:
 * - REVIEWED sections are kept verbatim.
 * - DRAFT sections matched by title are replaced by the new extraction, keeping
 *   their id (so report/mapping links survive) and any organisation guidance.
 * - Unmatched extracted sections are appended as DRAFT; unmatched existing ones stay.
 */
export function mergeExtractedSections(existing: readonly TemplateSection[], extracted: readonly TemplateSection[]): TemplateSection[] {
  const byKey = new Map<string, TemplateSection>();
  for (const s of extracted) {
    const k = key(s.title);
    if (!byKey.has(k)) byKey.set(k, s);
  }
  const used = new Set<string>();
  const idMap = new Map<string, string>();
  const merged: TemplateSection[] = existing.map((current) => {
    const k = key(current.title);
    const fresh = byKey.get(k);
    if (!fresh || used.has(k)) return current;
    used.add(k);
    idMap.set(fresh.id, current.id);
    if (current.reviewStatus === "REVIEWED") return current;
    return {
      ...fresh,
      id: current.id,
      parentId: current.parentId,
      level: current.level,
      authorInstructions: current.authorInstructions ?? fresh.authorInstructions,
      relatedLogframeElement: current.relatedLogframeElement ?? fresh.relatedLogframeElement,
      reviewStatus: "DRAFT",
    };
  });
  const presentIds = new Set(merged.map((s) => s.id));
  for (const s of extracted) {
    if (used.has(key(s.title))) continue;
    const parentId = s.parentId ? idMap.get(s.parentId) ?? s.parentId : undefined;
    const parentKnown = parentId !== undefined && (presentIds.has(parentId) || merged.some((m) => m.id === parentId));
    const appended: TemplateSection = parentKnown
      ? { ...s, parentId, reviewStatus: "DRAFT" }
      : { ...s, parentId: undefined, level: 1, reviewStatus: "DRAFT" };
    merged.push(appended);
    presentIds.add(appended.id);
    idMap.set(s.id, appended.id);
  }
  return placeChildrenAfterParents(merged).map((s, order) => ({ ...s, order }));
}

/** Reorders so every child follows its parent (depth-first, stable). */
export function placeChildrenAfterParents(sections: readonly TemplateSection[]): TemplateSection[] {
  const children = new Map<string | undefined, TemplateSection[]>();
  const ids = new Set(sections.map((s) => s.id));
  for (const s of sections) {
    const parent = s.parentId && ids.has(s.parentId) ? s.parentId : undefined;
    const bucket = children.get(parent) ?? [];
    bucket.push(parent ? s : { ...s, parentId: undefined, level: 1 });
    children.set(parent, bucket);
  }
  const out: TemplateSection[] = [];
  const visit = (parentId: string | undefined, level: number) => {
    for (const s of children.get(parentId) ?? []) {
      out.push({ ...s, level });
      visit(s.id, level + 1);
    }
  };
  visit(undefined, 1);
  return out;
}
