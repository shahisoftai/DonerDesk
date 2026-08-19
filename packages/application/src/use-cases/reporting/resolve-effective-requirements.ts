import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IRequirementResolver } from "../../ports/reporting.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { ResolvedReportingRequirements } from "@donordesk/domain";

/**
 * Resolves the effective reporting requirements for a period using the
 * deterministic precedence resolver and persists the immutable snapshot. The
 * applicable award always wins; lower-precedence layers fill gaps.
 */
export class ResolveEffectiveRequirementsHandler {
  constructor(
    private readonly resolver: IRequirementResolver,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, reportingPeriodId: string): Promise<Result<ResolvedReportingRequirements, DomainError>> {
    const resolved = await this.resolver.resolve({
      tenantId: ctx.tenant.tenantId,
      reportingPeriodId,
      effectiveDate: new Date(),
    });
    if (!resolved.ok) return resolved;

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "report.requirements.resolved",
      entityType: "resolved_reporting_requirements",
      entityId: resolved.value.id,
      newValue: JSON.stringify({
        requirementCount: resolved.value.snapshot.length,
        satisfied: resolved.value.coverage.satisfied.length,
        unmet: resolved.value.coverage.unmet,
      }),
    });

    return { ok: true, value: resolved.value };
  }
}
