import { DomainError } from "../../core/domain-error.js";

export type SectionInputType = "NARRATIVE" | "TABLE" | "ANNEX" | "INDICATOR_TABLE" | "COMPLIANCE";

export interface TemplateSection {
  id: string;
  title: string;
  description: string;
  inputType: SectionInputType;
  required: boolean;
  evidenceNeeded: string;
  relatedLogframeElement?: string;
  order: number;
}

export function createSection(input: Omit<TemplateSection, "id" | "order"> & { id?: string }): TemplateSection {
  if (!input.title || input.title.trim().length < 2) throw DomainError.validation("Section title required");
  return {
    id: input.id ?? crypto.randomUUID(),
    title: input.title.trim(),
    description: input.description ?? "",
    inputType: input.inputType,
    required: input.required,
    evidenceNeeded: input.evidenceNeeded ?? "",
    relatedLogframeElement: input.relatedLogframeElement,
    order: 0,
  };
}
