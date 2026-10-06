import { isSynthesisSection } from "./report-plan.js";

/**
 * Summary freshness (Report Editor U31). A synthesis section (executive
 * summary, conclusion) summarises the rest of the report. When a section it
 * summarises is regenerated or substantially rewritten after the summary was
 * written, the summary may no longer match — the editor then offers
 * "Regenerate summary". Small edits (typos, wording) never flag it.
 */

export interface FreshnessRevision {
  sectionId: string;
  revisionNumber: number;
  content: string;
  changeOrigin: string;
  createdAt: Date;
}

export interface FreshnessSection {
  id: string;
  title: string;
  currentRevisionId?: string;
  /** A person confirmed the summary is current at this time: changes before it no longer make it stale. */
  summaryCurrentAt?: Date;
}

/** Share of changed words above which a manual edit counts as substantial. */
export const SUBSTANTIAL_EDIT_RATIO = 0.25;

const AI_REWRITE_ORIGINS = new Set(["REGENERATION", "REWRITE", "RESTORE"]);

function words(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

/**
 * Fraction of words that differ between two texts (bag-of-words, symmetric):
 * 0 = same words, 1 = nothing in common.
 */
export function wordChangeRatio(before: string, after: string): number {
  const a = words(before);
  const b = words(after);
  if (a.length === 0 && b.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const w of a) counts.set(w, (counts.get(w) ?? 0) + 1);
  let shared = 0;
  for (const w of b) {
    const n = counts.get(w) ?? 0;
    if (n > 0) {
      shared += 1;
      counts.set(w, n - 1);
    }
  }
  return 1 - (2 * shared) / (a.length + b.length);
}

/**
 * Ids of synthesis sections whose current text predates a substantial change
 * to any other section. `revisions` are all revisions of the draft.
 */
export function staleSynthesisSectionIds(sections: ReadonlyArray<FreshnessSection>, revisions: ReadonlyArray<FreshnessRevision & { id: string }>): string[] {
  const byId = new Map(revisions.map((r) => [r.id, r]));
  const bySection = new Map<string, Array<FreshnessRevision & { id: string }>>();
  for (const r of revisions) {
    const list = bySection.get(r.sectionId) ?? [];
    list.push(r);
    bySection.set(r.sectionId, list);
  }
  for (const list of bySection.values()) list.sort((x, y) => x.revisionNumber - y.revisionNumber);

  const stale: string[] = [];
  for (const summary of sections) {
    if (!isSynthesisSection(summary) || !summary.currentRevisionId) continue;
    const writtenRevision = byId.get(summary.currentRevisionId);
    if (!writtenRevision) continue;
    // Confirming the summary counts as having re-read it: only changes after that make it stale again.
    const written = summary.summaryCurrentAt && summary.summaryCurrentAt > writtenRevision.createdAt ? { ...writtenRevision, createdAt: summary.summaryCurrentAt } : writtenRevision;
    const changedSince = sections.some((other) => {
      if (other.id === summary.id || isSynthesisSection(other) || !other.currentRevisionId) return false;
      const current = byId.get(other.currentRevisionId);
      if (!current || current.createdAt <= written.createdAt) return false;
      if (AI_REWRITE_ORIGINS.has(current.changeOrigin)) return true;
      // The text the summary was written from: the latest revision of this
      // section that existed when the summary revision was created.
      const history = bySection.get(other.id) ?? [];
      const basis = [...history].reverse().find((r) => r.createdAt <= written.createdAt);
      return basis ? wordChangeRatio(basis.content, current.content) >= SUBSTANTIAL_EDIT_RATIO : true;
    });
    if (changedSince) stale.push(summary.id);
  }
  return stale;
}
