import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IDonorTemplateMappingRepository } from "../../ports/reporting.js";
import type { IAuditLogger } from "../../ports/core.js";

export interface RegionUpdate {
  regionId: string;
  templateSectionId: string;
  placeholderKey: string;
}

/** Manual-correction step: an operator reassigns one or more detected
 * regions to the right DonorDesk section (or confirms an AUTO match by
 * resubmitting it). Rejects once the mapping is approved — corrections
 * after approval must go through a new version via detect-then-review. */
export class UpdateTemplateMappingHandler {
  constructor(
    private readonly mappings: IDonorTemplateMappingRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(
    ctx: AuthenticatedContext,
    input: { mappingId: string; regionUpdates: RegionUpdate[] },
  ): Promise<Result<{ mappingId: string }, DomainError>> {
    const found = await this.mappings.findById(input.mappingId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value) return { ok: false, error: DomainError.notFound("DonorTemplateMapping", input.mappingId) };

    let mapping = found.value;
    try {
      for (const update of input.regionUpdates) {
        mapping = mapping.reviewedBy(update.regionId, update.templateSectionId, update.placeholderKey);
      }
    } catch (error) {
      return { ok: false, error: DomainError.validation(error instanceof Error ? error.message : String(error)) };
    }

    const saved = await this.mappings.update(mapping);
    if (!saved.ok) return saved;

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "donor_template_mapping.updated",
      entityType: "donor_template_mapping",
      entityId: mapping.id,
      newValue: `regionsUpdated=${input.regionUpdates.length}`,
    });

    return { ok: true, value: { mappingId: mapping.id } };
  }
}
