import { DomainError } from "../../core/domain-error.js";

export type SectionInputType = "NARRATIVE" | "TABLE" | "ANNEX" | "INDICATOR_TABLE" | "COMPLIANCE";

export type SectionReviewStatus = "DRAFT" | "REVIEWED";

export interface TemplateSection {
  id: string;
  title: string;
  description: string;
  inputType: SectionInputType;
  required: boolean;
  evidenceNeeded: string;
  relatedLogframeElement?: string;
  order: number;
  reviewStatus: SectionReviewStatus;
  /** Donor-imposed word limits. Explicit profile overrides take precedence. */
  minWords?: number;
  maxWords?: number;
}

function isValidWordLimit(min: number | undefined, max: number | undefined): boolean {
  if (min !== undefined && (!Number.isInteger(min) || min < 0)) return false;
  if (max !== undefined && (!Number.isInteger(max) || max <= 0)) return false;
  if (min !== undefined && max !== undefined && min > max) return false;
  return true;
}

export function createSection(
  input: Omit<TemplateSection, "id" | "order"> & { id?: string },
): TemplateSection {
  if (!input.title || input.title.trim().length < 2) throw DomainError.validation("Section title required");
  if (!isValidWordLimit(input.minWords, input.maxWords)) {
    throw DomainError.validation("Invalid section word limits (min must be >= 0, max > 0, min <= max)");
  }
  return {
    id: input.id ?? crypto.randomUUID(),
    title: input.title.trim(),
    description: input.description ?? "",
    inputType: input.inputType,
    required: input.required,
    evidenceNeeded: input.evidenceNeeded ?? "",
    relatedLogframeElement: input.relatedLogframeElement,
    order: 0,
    reviewStatus: input.reviewStatus ?? "DRAFT",
    minWords: input.minWords,
    maxWords: input.maxWords,
  };
}

/** Backfills stable IDs + review status for legacy sections persisted without them. */
export function normalizeSection(section: Partial<TemplateSection>, index: number): TemplateSection {
  if (!section.title || section.title.trim().length < 2) {
    throw DomainError.validation("Section title required");
  }
  return {
    id: section.id ?? crypto.randomUUID(),
    title: section.title.trim(),
    description: section.description ?? "",
    inputType: section.inputType ?? "NARRATIVE",
    required: section.required ?? true,
    evidenceNeeded: section.evidenceNeeded ?? "",
    relatedLogframeElement: section.relatedLogframeElement,
    order: index,
    reviewStatus: section.reviewStatus ?? "DRAFT",
    minWords: section.minWords,
    maxWords: section.maxWords,
  };
}
