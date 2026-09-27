import { reportableSections, type DomainError, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IDonorTemplateRepository, ISectionBriefRenderer } from "../../ports/templates.js";
import { toPlanSection } from "../../services/report-planner.js";
import { snapshotFromTemplate } from "../../services/template-snapshot.js";
import { buildTemplateGenerationContext } from "../../services/report-generation-context.js";
import { loadTemplate } from "./load-template.js";

export interface TemplateBriefPreview {
  version: number;
  template: string;
  sections: Array<{ templateSectionId: string; title: string; brief: string }>;
}

/** Dry run: what the AI writer would be told for each section, with no LLM call. */
export class PreviewTemplateBriefHandler {
  constructor(private readonly templates: IDonorTemplateRepository, private readonly renderer: ISectionBriefRenderer) {}

  async handle(ctx: AuthenticatedContext, templateId: string): Promise<Result<TemplateBriefPreview, DomainError>> {
    const loaded = await loadTemplate(this.templates, templateId, ctx.tenant.tenantId);
    if (!loaded.ok) return loaded;
    const snapshot = snapshotFromTemplate(loaded.value);
    return {
      ok: true,
      value: {
        version: snapshot.version,
        template: this.renderer.renderTemplate(buildTemplateGenerationContext(snapshot)),
        sections: reportableSections(snapshot.sections).map((s) => ({
          templateSectionId: s.id,
          title: s.title,
          brief: this.renderer.renderSection(toPlanSection(s)),
        })),
      },
    };
  }
}
