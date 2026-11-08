/**
 * Building a sector's content (Phase 46). `defineContent` fills the parts a file leaves out with empty lists, so a sector file
 * names only what it has. The coverage report then asks every empty part for its reason (`noneBecause`). Shared parts every sector
 * needs (context analysis, feedback channel, protection checks) are not repeated per sector: they are `COMMON_CONTENT`, merged by
 * the pack-part providers.
 */
import type { SectorContent } from "./model.js";

export type ContentInput = Pick<SectorContent, "sectorId" | "summary" | "indicators"> & Partial<Omit<SectorContent, "sectorId" | "summary" | "indicators">>;

export function defineContent(input: ContentInput): SectorContent {
  return {
    logframe: [], assessment: [], forms: [], evidence: [], checklist: [], risks: [], glossary: [], blueprint: [], dashboardTemplates: [],
    ...input,
  };
}
