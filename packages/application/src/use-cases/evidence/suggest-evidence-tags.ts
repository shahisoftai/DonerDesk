import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IEvidenceRepository, IEvidenceTagger } from "../../ports/evidence.js";

export class SuggestEvidenceTagsHandler {
  constructor(private readonly repo: IEvidenceRepository, private readonly tagger: IEvidenceTagger) {}

  async handle(ctx: AuthenticatedContext, evidenceId: string, context: { extractedText?: string; activities: Array<{ id: string; title: string }>; indicators: Array<{ id: string; code: string; name: string }>; existingProjectName?: string }): Promise<Result<{ tags: unknown[]; summary: string; sensitivityWarning?: string; model: string }, DomainError>> {
    const r = await this.repo.findById(evidenceId, ctx.tenant.tenantId);
    if (!r.ok) return r;
    if (!r.value) return { ok: false, error: DomainError.notFound("Evidence", evidenceId) };
    const ev = r.value;
    const result = await this.tagger.suggestTags({
      fileName: ev.fileName,
      fileType: ev.fileType,
      extractedText: context.extractedText,
      existingProjectName: context.existingProjectName,
      existingActivities: context.activities,
      existingIndicators: context.indicators,
    });
    ev.setAiSuggestions(result.summary, result.tags, result.sensitivityWarning);
    const saved = await this.repo.update(ev);
    if (!saved.ok) return saved;
    return {
      ok: true,
      value: {
        tags: result.tags,
        summary: result.summary,
        sensitivityWarning: result.sensitivityWarning,
        model: result.model,
      },
    };
  }
}
