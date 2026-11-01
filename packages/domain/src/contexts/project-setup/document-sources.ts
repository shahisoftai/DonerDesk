/**
 * The documents a proposal was read from, as the review shows them (Phase 37.6): each file with the kind each of its sheets
 * was read as, and the kind a person chose instead (`override`, for the whole file). An override replaces the reading for
 * every block of that file before any area reads it again. Pure.
 */
import type { SetupDocumentKind } from "./document-kind.js";
import type { SetupAreaKey } from "./proposal-areas.js";
import type { SourceBlock } from "./source-document.js";

export interface SetupSourceInfo {
  documentId: string;
  name: string;
  sheets: Array<{ title: string | null; kind: SetupDocumentKind }>;
  /** The kind a person chose for the whole file; absent = the reading stands. */
  override?: SetupDocumentKind;
  /** The parts this file feeds (by its kind or its headings), so the person sees what each file contributes. */
  feeds?: SetupAreaKey[];
}

/** One entry per file, in reading order, keeping each file's override from `previous`. */
export function describeSources(blocks: ReadonlyArray<SourceBlock>, previous: ReadonlyArray<SetupSourceInfo> = [], feeds?: ReadonlyMap<string, SetupAreaKey[]>): SetupSourceInfo[] {
  const out = new Map<string, SetupSourceInfo>();
  for (const block of blocks) {
    const entry = out.get(block.documentId) ?? { documentId: block.documentId, name: block.documentName ?? block.documentId, sheets: [] };
    const title = block.sheet ?? null;
    if (block.docKind && !entry.sheets.some((s) => s.title === title)) entry.sheets.push({ title, kind: block.docKind });
    out.set(block.documentId, entry);
  }
  return [...out.values()].map((entry) => {
    const override = previous.find((p) => p.documentId === entry.documentId)?.override;
    const fed = feeds?.get(entry.documentId);
    return { ...entry, ...(override ? { override } : {}), ...(fed ? { feeds: fed } : {}) };
  });
}

/** The blocks with every overridden file read as the kind the person chose. */
export function applyKindOverrides(blocks: ReadonlyArray<SourceBlock>, sources: ReadonlyArray<SetupSourceInfo> | undefined): SourceBlock[] {
  const chosen = new Map((sources ?? []).filter((s) => s.override).map((s) => [s.documentId, s.override!]));
  return blocks.map((b) => (chosen.has(b.documentId) ? { ...b, docKind: chosen.get(b.documentId)! } : b));
}
