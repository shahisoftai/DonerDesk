import type { Result, DomainError } from "@donordesk/domain";
import type { ReextractTemplateInput } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../../context.js";
import type { IDonorTemplateRepository } from "../../ports/templates.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { BackgroundRunner } from "../../services/background-runner.js";
import type { TemplateExtractionRunner } from "../../services/template-extraction-runner.js";
import { attempt, loadTemplate } from "./load-template.js";

/** Re-runs extraction on an existing template; "merge" keeps reviewed work. */
export class ReextractTemplateHandler {
  constructor(
    private readonly templates: IDonorTemplateRepository,
    private readonly extraction: TemplateExtractionRunner,
    private readonly runInBackground: BackgroundRunner,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, templateId: string, input: ReextractTemplateInput): Promise<Result<{ status: string }, DomainError>> {
    const loaded = await loadTemplate(this.templates, templateId, ctx.tenant.tenantId);
    if (!loaded.ok) return loaded;
    const t = loaded.value;
    const started = attempt(() => {
      if (input.rawText !== undefined) t.setExtractedText(input.rawText);
      t.startExtraction();
    });
    if (!started.ok) return started;
    const saved = await this.templates.update(t, { actorId: ctx.tenant.userId });
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "template.reextract_requested",
      entityType: "donor_template",
      entityId: templateId,
      projectId: t.projectId,
      newValue: JSON.stringify({ mode: input.mode, textReplaced: input.rawText !== undefined }),
    });
    this.runInBackground(async () => {
      await this.extraction.run({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, templateId, mode: input.mode });
    });
    return { ok: true, value: { status: t.status } };
  }
}
