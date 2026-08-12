import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IEvidenceRepository } from "../../ports/evidence.js";
import type { IAuditLogger } from "../../ports/core.js";

export class VerifyEvidenceHandler {
  constructor(private readonly repo: IEvidenceRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, evidenceId: string): Promise<Result<void, DomainError>> {
    const r = await this.repo.findById(evidenceId, ctx.tenant.tenantId);
    if (!r.ok) return r;
    if (!r.value) return { ok: false, error: DomainError.notFound("Evidence", evidenceId) };
    const ev = r.value;
    ev.verify();
    const saved = await this.repo.update(ev);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "evidence.verified",
      entityType: "evidence",
      entityId: evidenceId,
    });
    return { ok: true, value: undefined };
  }
}
