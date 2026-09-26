import { scoreSimilarity } from "../ai/text-similarity.js";
import type { TemplateRegion } from "./template-region.js";
import type { TemplateSection } from "./template-section.js";

/**
 * Deterministic, pure auto-mapper: scores each detected donor-template
 * region against DonorDesk's own report sections and proposes the best
 * match, never guessing below a confidence threshold. Zero I/O, per the
 * domain layer's zero-infra-deps convention — reuses the same lexical
 * scorer (`scoreSimilarity`) shared with claim entailment/evidence
 * retrieval for consistent matching behaviour across the codebase.
 */

const MATCH_THRESHOLD = 0.25;
/** Bonus applied when a HEADING's normalized text is a substring/prefix of
 * the candidate section's title — handles donor headings like
 * "1. Project Summary" matching a DonorDesk section titled "Project Summary". */
const PREFIX_MATCH_BONUS = 0.15;

export interface AutoMapResult {
  regionId: string;
  /** undefined = no confident match; the region is left for manual review. */
  templateSectionId: string | undefined;
  score: number;
  method: "AUTO";
}

export interface AutoMapOutcome {
  results: AutoMapResult[];
  /** Sections claimed by more than one region — surfaced for operator review,
   * never silently collapsed (a donor template can legitimately want both a
   * narrative region and a table region mapped to the same DonorDesk section). */
  warnings: string[];
}

function normalizedHeadingText(text: string): string {
  return text.toLowerCase().replace(/^[\d.\s]+/, "").trim();
}

function candidateText(section: TemplateSection): string {
  return [section.title, section.description].filter(Boolean).join(" ");
}

/** Score one region against one section, including the heading-prefix bonus. */
export function scoreRegionAgainstSection(region: TemplateRegion, section: TemplateSection): number {
  if (region.kind === "TABLE") {
    if (section.inputType !== "TABLE" && section.inputType !== "INDICATOR_TABLE") return 0;
    const columnsText = (region.tableColumns ?? []).join(" ");
    return scoreSimilarity(columnsText || region.text, candidateText(section));
  }
  let score = scoreSimilarity(region.text, candidateText(section));
  const normalizedRegion = normalizedHeadingText(region.text);
  const normalizedTitle = section.title.toLowerCase().trim();
  if (normalizedRegion.length > 0 && normalizedTitle.length > 0) {
    if (normalizedRegion === normalizedTitle || normalizedTitle.startsWith(normalizedRegion) || normalizedRegion.startsWith(normalizedTitle)) {
      score = Math.min(1, score + PREFIX_MATCH_BONUS);
    }
  }
  return score;
}

/**
 * Maps every detected region to its best-scoring section, in document
 * order, threshold-gated. A region scoring below `MATCH_THRESHOLD` against
 * every candidate section is returned unmapped rather than forced to the
 * nearest weak match.
 */
export function autoMapRegions(
  regions: ReadonlyArray<TemplateRegion>,
  sections: ReadonlyArray<TemplateSection>,
): AutoMapOutcome {
  const results: AutoMapResult[] = [];
  const claimedBy = new Map<string, string[]>(); // sectionId -> regionIds

  const ordered = [...regions].sort((a, b) => a.order - b.order);
  for (const region of ordered) {
    let bestSectionId: string | undefined;
    let bestScore = 0;
    for (const section of sections) {
      const score = scoreRegionAgainstSection(region, section);
      if (score > bestScore) {
        bestScore = score;
        bestSectionId = section.id;
      }
    }
    const mapped = bestScore >= MATCH_THRESHOLD ? bestSectionId : undefined;
    results.push({ regionId: region.id, templateSectionId: mapped, score: bestScore, method: "AUTO" });
    if (mapped) {
      const list = claimedBy.get(mapped) ?? [];
      list.push(region.id);
      claimedBy.set(mapped, list);
    }
  }

  const warnings: string[] = [];
  for (const [sectionId, regionIds] of claimedBy) {
    if (regionIds.length > 1) {
      warnings.push(`Section ${sectionId} was matched by ${regionIds.length} regions (${regionIds.join(", ")}); review the mapping.`);
    }
  }

  return { results, warnings };
}
