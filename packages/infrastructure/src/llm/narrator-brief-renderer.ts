import type { ISectionBriefRenderer, TemplateGenerationContext } from "@donordesk/application";
import type { ReportPlanSection } from "@donordesk/domain";
import { buildSectionGuidance, renderTemplateBlock } from "./llm-report-draft-generator.js";

/** Preview renderer backed by the same formatters the narrator prompt uses. */
export class NarratorBriefRenderer implements ISectionBriefRenderer {
  renderSection(section: ReportPlanSection): string {
    return buildSectionGuidance(section);
  }

  renderTemplate(template: TemplateGenerationContext): string {
    return renderTemplateBlock(template).join("\n").trim();
  }
}
