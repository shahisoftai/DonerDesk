import { DomainError } from "../../core/domain-error.js";

export type SectionInputType = "NARRATIVE" | "TABLE" | "CHART" | "ANNEX" | "INDICATOR_TABLE" | "COMPLIANCE";

export const SECTION_INPUT_TYPES: readonly SectionInputType[] = ["NARRATIVE", "TABLE", "CHART", "ANNEX", "INDICATOR_TABLE", "COMPLIANCE"];

export type SectionReviewStatus = "DRAFT" | "REVIEWED";

export const MAX_SECTION_LEVEL = 4;

/** A table the donor requires inside a section (shape only; values are never extracted). */
export interface RequiredTable {
  title: string;
  columns: string[];
  notes?: string;
}

/** Where in the uploaded template an extracted item came from. */
export interface TemplateSourceReference {
  excerpt: string;
  page?: number;
  headingPath?: string[];
}

export interface TemplateSection {
  id: string;
  title: string;
  /**
   * English title used to recognise the section's role (executive summary,
   * challenges, annex …) when `title` is shown in another language. Set by the
   * built-in report-type blueprints; absent for donor-template sections.
   */
  canonicalTitle?: string;
  /** Short human summary of the section's purpose. */
  description: string;
  inputType: SectionInputType;
  required: boolean;
  evidenceNeeded: string[];
  relatedLogframeElement?: string;
  order: number;
  reviewStatus: SectionReviewStatus;
  /** Donor-imposed word limits. Explicit profile overrides take precedence. */
  minWords?: number;
  maxWords?: number;
  pageLimit?: number;
  /** Parent section id for sub-sections; undefined for top-level sections. */
  parentId?: string;
  /** Heading depth, 1 = top level. */
  level: number;
  /** Donor numbering as printed in the template ("2.1", "B", "Annex C"). */
  numbering?: string;
  /** Donor guidance for writing this section; sent to the AI writer. */
  instructions?: string;
  /** Questions the donor requires the section to answer; sent to the AI writer. */
  mandatoryQuestions: string[];
  requiredTables: RequiredTable[];
  /** The organisation's own extra guidance for the AI (never extracted from the donor). */
  authorInstructions?: string;
  /** False = reference-only guidance that does not become a report section. */
  includeInReport: boolean;
  source?: TemplateSourceReference;
  /** Extractor confidence 0..1; absent for manually authored sections. */
  confidence?: number;
}

export type TemplateSectionInput = {
  id?: string;
  order?: number;
  title: string;
  description?: string;
  inputType?: SectionInputType;
  required?: boolean;
  evidenceNeeded?: string[] | string;
  relatedLogframeElement?: string;
  reviewStatus?: SectionReviewStatus;
  minWords?: number;
  maxWords?: number;
  pageLimit?: number;
  parentId?: string;
  level?: number;
  numbering?: string;
  instructions?: string;
  mandatoryQuestions?: string[];
  requiredTables?: RequiredTable[];
  authorInstructions?: string;
  includeInReport?: boolean;
  source?: TemplateSourceReference;
  confidence?: number;
};

function isValidWordLimit(min: number | undefined, max: number | undefined): boolean {
  if (min !== undefined && (!Number.isInteger(min) || min < 0)) return false;
  if (max !== undefined && (!Number.isInteger(max) || max <= 0)) return false;
  if (min !== undefined && max !== undefined && min > max) return false;
  return true;
}

function cleanList(values: readonly unknown[] | undefined): string[] {
  if (!values) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (typeof v !== "string") continue;
    const t = v.trim();
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
  }
  return out;
}

/** Legacy rows stored evidence as one free-text string; split it into items. */
export function normalizeEvidence(value: string[] | string | undefined): string[] {
  if (value === undefined) return [];
  if (Array.isArray(value)) return cleanList(value);
  return cleanList(value.split(/[;\n]+/));
}

function cleanTables(tables: readonly RequiredTable[] | undefined): RequiredTable[] {
  if (!tables) return [];
  return tables
    .filter((t) => t && typeof t.title === "string" && t.title.trim().length > 0)
    .map((t) => ({
      title: t.title.trim(),
      columns: cleanList(t.columns),
      ...(t.notes?.trim() ? { notes: t.notes.trim() } : {}),
    }));
}

function optionalText(value: string | undefined): string | undefined {
  const t = value?.trim();
  return t ? t : undefined;
}

export function createSection(input: TemplateSectionInput): TemplateSection {
  if (!input.title || input.title.trim().length < 2) throw DomainError.validation("Section title required");
  if (!isValidWordLimit(input.minWords, input.maxWords)) {
    throw DomainError.validation("Invalid section word limits (min must be >= 0, max > 0, min <= max)");
  }
  if (input.pageLimit !== undefined && (!Number.isInteger(input.pageLimit) || input.pageLimit <= 0)) {
    throw DomainError.validation("Section page limit must be a positive integer");
  }
  const level = input.level ?? 1;
  if (!Number.isInteger(level) || level < 1 || level > MAX_SECTION_LEVEL) {
    throw DomainError.validation(`Section level must be between 1 and ${MAX_SECTION_LEVEL}`);
  }
  if (input.inputType !== undefined && !SECTION_INPUT_TYPES.includes(input.inputType)) {
    throw DomainError.validation(`Unknown section input type: ${String(input.inputType)}`);
  }
  if (input.confidence !== undefined && !(input.confidence >= 0 && input.confidence <= 1)) {
    throw DomainError.validation("Section confidence must be between 0 and 1");
  }
  const source = input.source?.excerpt?.trim()
    ? {
        excerpt: input.source.excerpt.trim(),
        ...(input.source.page !== undefined ? { page: input.source.page } : {}),
        ...(input.source.headingPath?.length ? { headingPath: cleanList(input.source.headingPath) } : {}),
      }
    : undefined;
  return {
    id: input.id ?? crypto.randomUUID(),
    title: input.title.trim(),
    description: input.description?.trim() ?? "",
    inputType: input.inputType ?? "NARRATIVE",
    required: input.required ?? true,
    evidenceNeeded: normalizeEvidence(input.evidenceNeeded),
    relatedLogframeElement: optionalText(input.relatedLogframeElement),
    order: input.order ?? 0,
    reviewStatus: input.reviewStatus ?? "DRAFT",
    minWords: input.minWords,
    maxWords: input.maxWords,
    pageLimit: input.pageLimit,
    parentId: optionalText(input.parentId),
    level,
    numbering: optionalText(input.numbering),
    instructions: optionalText(input.instructions),
    mandatoryQuestions: cleanList(input.mandatoryQuestions),
    requiredTables: cleanTables(input.requiredTables),
    authorInstructions: optionalText(input.authorInstructions),
    includeInReport: input.includeInReport ?? true,
    source,
    confidence: input.confidence,
  };
}

/** Rehydrates one persisted section (any schema version), keeping its stored position. */
export function normalizeSection(section: Partial<TemplateSection> & { evidenceNeeded?: string[] | string }, index: number): TemplateSection {
  return createSection({ ...section, title: section.title ?? "", order: index });
}

/**
 * Parses persisted `sectionsJson` without letting one corrupt row break the
 * whole template: invalid sections are dropped and reported, order is restored
 * from the stored `order` field, then re-indexed densely.
 */
export function parsePersistedSections(raw: unknown): { sections: TemplateSection[]; dropped: Array<{ index: number; reason: string }> } {
  const dropped: Array<{ index: number; reason: string }> = [];
  if (!Array.isArray(raw)) return { sections: [], dropped: raw == null ? [] : [{ index: -1, reason: "sectionsJson is not an array" }] };
  const parsed: TemplateSection[] = [];
  raw.forEach((item, index) => {
    try {
      if (!item || typeof item !== "object") throw DomainError.validation("Section is not an object");
      const s = item as Partial<TemplateSection>;
      parsed.push(normalizeSection(s, typeof s.order === "number" ? s.order : index));
    } catch (e) {
      dropped.push({ index, reason: e instanceof Error ? e.message : String(e) });
    }
  });
  const ordered = parsed
    .map((s, i) => ({ s, i }))
    .sort((a, b) => a.s.order - b.s.order || a.i - b.i)
    .map(({ s }, order) => ({ ...s, order }));
  return { sections: detachDanglingParents(ordered), dropped };
}

function detachDanglingParents(sections: TemplateSection[]): TemplateSection[] {
  const ids = new Set(sections.map((s) => s.id));
  return sections.map((s) => (s.parentId && !ids.has(s.parentId) ? { ...s, parentId: undefined, level: 1 } : s));
}

/**
 * Validates a whole section list as a tree: unique ids, parents exist and appear
 * before their children, and a child is exactly one level deeper than its parent.
 */
export function validateSectionTree(sections: readonly TemplateSection[]): void {
  const seen = new Map<string, TemplateSection>();
  for (const s of sections) {
    if (seen.has(s.id)) throw DomainError.validation(`Duplicate section id: ${s.id}`);
    if (s.parentId) {
      if (s.parentId === s.id) throw DomainError.validation(`Section "${s.title}" cannot be its own parent`);
      const parent = seen.get(s.parentId);
      if (!parent) throw DomainError.validation(`Section "${s.title}" must come after its parent section`);
      if (s.level !== parent.level + 1) throw DomainError.validation(`Section "${s.title}" must be one level below "${parent.title}"`);
    } else if (s.level !== 1) {
      throw DomainError.validation(`Top-level section "${s.title}" must be level 1`);
    }
    seen.set(s.id, s);
  }
}

/** Sections that become report sections, in template order. */
export function reportableSections(sections: readonly TemplateSection[]): TemplateSection[] {
  const excluded = new Set<string>();
  const out: TemplateSection[] = [];
  for (const s of sections) {
    if (s.includeInReport === false || (s.parentId && excluded.has(s.parentId))) {
      excluded.add(s.id);
      continue;
    }
    out.push(s);
  }
  return out;
}

/** The section's heading as printed ("2.1 Outcomes"). */
export function sectionDisplayTitle(section: Pick<TemplateSection, "title" | "numbering">): string {
  return section.numbering ? `${section.numbering} ${section.title}` : section.title;
}
