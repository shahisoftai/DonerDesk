import type { TemplateSection } from "./template-section.js";
import type { TemplateRequirements } from "./template-requirements.js";

export interface SectionChange {
  id: string;
  title: string;
  fields: string[];
}

export interface TemplateVersionDiff {
  added: Array<{ id: string; title: string }>;
  removed: Array<{ id: string; title: string }>;
  changed: SectionChange[];
  reordered: boolean;
  requirementsChanged: string[];
}

const SECTION_FIELDS: ReadonlyArray<keyof TemplateSection> = [
  "title", "numbering", "description", "instructions", "mandatoryQuestions", "evidenceNeeded", "requiredTables",
  "inputType", "required", "includeInReport", "minWords", "maxWords", "pageLimit", "parentId", "level",
  "authorInstructions", "relatedLogframeElement", "reviewStatus",
];

const REQUIREMENT_FIELDS: ReadonlyArray<keyof TemplateRequirements> = [
  "reportTitle", "reportingFrequency", "submission", "formatting", "annexes", "indicatorRequirements", "compliance", "generalInstructions",
];

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Field-level comparison of two template versions (sections matched by id). */
export function diffTemplateVersions(
  from: { sections: readonly TemplateSection[]; requirements: TemplateRequirements },
  to: { sections: readonly TemplateSection[]; requirements: TemplateRequirements },
): TemplateVersionDiff {
  const before = new Map(from.sections.map((s) => [s.id, s]));
  const after = new Map(to.sections.map((s) => [s.id, s]));
  const added = to.sections.filter((s) => !before.has(s.id)).map((s) => ({ id: s.id, title: s.title }));
  const removed = from.sections.filter((s) => !after.has(s.id)).map((s) => ({ id: s.id, title: s.title }));
  const changed: SectionChange[] = [];
  for (const s of to.sections) {
    const old = before.get(s.id);
    if (!old) continue;
    const fields = SECTION_FIELDS.filter((f) => !same(old[f], s[f]));
    if (fields.length) changed.push({ id: s.id, title: s.title, fields: fields.map(String) });
  }
  const commonBefore = from.sections.filter((s) => after.has(s.id)).map((s) => s.id);
  const commonAfter = to.sections.filter((s) => before.has(s.id)).map((s) => s.id);
  return {
    added,
    removed,
    changed,
    reordered: !same(commonBefore, commonAfter),
    requirementsChanged: REQUIREMENT_FIELDS.filter((f) => !same(from.requirements[f], to.requirements[f])).map(String),
  };
}
