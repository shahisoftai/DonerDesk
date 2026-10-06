import type { GenerateReportDraftInput } from "@donordesk/application";
import type { ReportPlanSection } from "@donordesk/domain";

/** The reporting officer's statement for this section, when the period has one (key = the template section id). */
export function sectionOfficerNote(input: Pick<GenerateReportDraftInput, "reportContext">, section: Pick<ReportPlanSection, "templateSectionId">): string | undefined {
  const note = section.templateSectionId ? input.reportContext?.storyContext?.sectionNotes?.[section.templateSectionId] : undefined;
  return note?.trim() ? note.trim() : undefined;
}
