import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IEvidenceRepository, EvidenceFilter } from "../../ports/evidence.js";
import { toEvidenceDto } from "./dto.js";

export class SearchEvidenceHandler {
  constructor(private readonly repo: IEvidenceRepository) {}

  async handle(ctx: AuthenticatedContext, filter: EvidenceFilter): Promise<Result<{ items: unknown[]; total: number; page: number; pageSize: number }, DomainError>> {
    const r = await this.repo.search(filter, ctx.tenant.tenantId);
    if (!r.ok) return r;
    return {
      ok: true,
      value: {
        items: r.value.items.map((e) => toEvidenceDto(e)),
        total: r.value.total,
        page: r.value.page,
        pageSize: r.value.pageSize,
      },
    };
  }
}
