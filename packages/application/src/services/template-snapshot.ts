import {
  parsePersistedRequirements,
  parsePersistedSections,
  type DonorTemplate,
  type TemplateRequirements,
  type TemplateSection,
} from "@donordesk/domain";

/**
 * The donor template as frozen onto a reporting period. The period's report
 * is generated, regenerated and submitted against this snapshot, so later
 * template edits never change an in-flight report.
 */
export interface PeriodTemplateSnapshot {
  id: string;
  version: number;
  templateName: string;
  donorName: string;
  reportType: string;
  language: string;
  notes?: string;
  sections: TemplateSection[];
  requirements: TemplateRequirements;
}

export function snapshotFromTemplate(t: DonorTemplate): PeriodTemplateSnapshot {
  return {
    id: t.id,
    version: t.version,
    templateName: t.templateName,
    donorName: t.donorName,
    reportType: t.reportType,
    language: t.language,
    notes: t.notes,
    sections: t.sections,
    requirements: t.requirements,
  };
}

export function serializeTemplateSnapshot(t: DonorTemplate): string {
  return JSON.stringify(snapshotFromTemplate(t));
}

/** Tolerant parse; returns null for empty/legacy snapshots without a version. */
export function parseTemplateSnapshot(json: string | undefined): PeriodTemplateSnapshot | null {
  if (!json || json === "{}") return null;
  try {
    const raw = JSON.parse(json) as Partial<PeriodTemplateSnapshot> & { sections?: unknown; requirements?: unknown; requiredAnnexes?: string[] };
    if (!raw.id || typeof raw.version !== "number") return null;
    return {
      id: raw.id,
      version: raw.version,
      templateName: raw.templateName ?? "",
      donorName: raw.donorName ?? "",
      reportType: raw.reportType ?? "",
      language: raw.language ?? "en",
      notes: raw.notes,
      sections: parsePersistedSections(raw.sections).sections,
      requirements: parsePersistedRequirements(raw.requirements, raw.requiredAnnexes ?? []),
    };
  } catch {
    return null;
  }
}
