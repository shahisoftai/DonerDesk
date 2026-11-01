/**
 * Which blocks an area reads (Phase 37.1): those from the document kinds its spec names, plus every block of an OTHER or
 * unclassified document. When the scope would leave nothing to read, the area reads everything: a wrong classification can
 * cost precision, never a whole area.
 */
import type { SetupDocumentKind, SourceBlock } from "@donordesk/domain";

export function blocksInScope(blocks: ReadonlyArray<SourceBlock>, readsFrom: ReadonlyArray<SetupDocumentKind> | undefined): SourceBlock[] {
  if (!readsFrom) return [...blocks];
  const scoped = blocks.filter((b) => !b.docKind || b.docKind === "OTHER" || readsFrom.includes(b.docKind));
  return scoped.length > 0 ? scoped : [...blocks];
}
