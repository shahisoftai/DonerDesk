import type { Result } from "@donordesk/domain";
import { DomainError, type SuggestedTag } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IEvidenceRepository } from "../../ports/evidence.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { IIdempotencyStore } from "../../ports/infrastructure.js";

export interface PersistEvidenceTagsInput {
  summary: string;
  tags: SuggestedTag[];
  sensitivityWarning?: string;
  model?: string;
  idempotencyKey?: string;
}

const PERSIST_TAGS_JOB = "evidence.persist_tags";

/**
 * Persists AI-suggested tags supplied by an external orchestrator (Kestra /
 * workers). This is distinct from `SuggestEvidenceTagsHandler`, which runs the
 * tagger itself; here the caller already computed the suggestions and the API
 * only records them on the aggregate.
 *
 * When an `idempotencyKey` is supplied, a durable claim is acquired first so a
 * retried / duplicate delivery is a no-op (returns success without re-writing).
 */
export class PersistEvidenceTagsHandler {
  constructor(
    private readonly repo: IEvidenceRepository,
    private readonly audit: IAuditLogger,
    private readonly idempotency?: IIdempotencyStore,
  ) {}

  async handle(ctx: AuthenticatedContext, evidenceId: string, input: PersistEvidenceTagsInput): Promise<Result<void, DomainError>> {
    if (input.idempotencyKey) {
      if (!this.idempotency) {
        return { ok: false, error: DomainError.invariant("Idempotency store is not configured") };
      }
      const claim = await this.idempotency.acquire({
        key: input.idempotencyKey,
        tenantId: ctx.tenant.tenantId.toString(),
        jobName: PERSIST_TAGS_JOB,
        entityId: evidenceId,
      });
      if (!claim.ok) return claim;
      if (!claim.value.acquired) {
        return { ok: true, value: undefined };
      }
    }

    const r = await this.repo.findById(evidenceId, ctx.tenant.tenantId);
    if (!r.ok) return r;
    if (!r.value) return { ok: false, error: DomainError.notFound("Evidence", evidenceId) };

    const ev = r.value;
    ev.setAiSuggestions(input.summary, input.tags, input.sensitivityWarning);

    const saved = await this.repo.update(ev);
    if (!saved.ok) return saved;

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "evidence.tags_persisted",
      entityType: "evidence",
      entityId: evidenceId,
      newValue: JSON.stringify({ summary: input.summary, tagCount: input.tags.length, model: input.model }),
    });

    return { ok: true, value: undefined };
  }
}
