import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IEvidenceRepository } from "../../ports/evidence.js";
import { toEvidenceDto } from "./dto.js";

export class GetEvidenceHandler {
  constructor(private readonly repo: IEvidenceRepository) {}

  async handle(ctx: AuthenticatedContext, evidenceId: string): Promise<Result<unknown, DomainError>> {
    const r = await this.repo.findById(evidenceId, ctx.tenant.tenantId);
    if (!r.ok) return r;
    if (!r.value) return { ok: false, error: DomainError.notFound("Evidence", evidenceId) };
    return { ok: true, value: toEvidenceDto(r.value) };
  }
}
