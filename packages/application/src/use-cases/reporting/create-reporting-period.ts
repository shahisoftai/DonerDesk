import type { Result } from "@donordesk/domain";
import { DomainError, ReportingPeriod } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IReportingPeriodRepository } from "../../ports/reporting.js";
import type { IIdGenerator, IAuditLogger } from "../../ports/core.js";
import type { CreateReportingPeriodInput } from "@donordesk/contracts";

export class CreateReportingPeriodHandler {
  constructor(private readonly ids: IIdGenerator, private readonly repo: IReportingPeriodRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, input: CreateReportingPeriodInput): Promise<Result<{ id: string }, DomainError>> {
    const id = this.ids.generate();
    const p = ReportingPeriod.create({
      id,
      tenantId: ctx.tenant.tenantId.toString(),
      projectId: input.projectId,
      donorTemplateId: input.donorTemplateId,
      reportType: input.reportType,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      deadline: new Date(input.deadline),
      internalReviewDeadline: input.internalReviewDeadline ? new Date(input.internalReviewDeadline) : undefined,
      responsibleOfficerId: input.responsibleOfficerId,
    });
    const saved = await this.repo.create(p);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "reporting.period.created",
      entityType: "reporting_period",
      entityId: id,
      projectId: input.projectId,
    });
    return { ok: true, value: { id } };
  }
}
