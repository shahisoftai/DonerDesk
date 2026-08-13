import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IReportDraftRepository, IReportSectionRepository } from "../../ports/reporting.js";
import type { INotificationRepository } from "../../ports/support.js";
import type { INotificationPort, IIdGenerator } from "../../ports/core.js";

export interface GenerateDeadlineRemindersInput {
  reportingPeriodId: string;
  recipientId?: string;
}

/**
 * Detects report sections still pending review for a reporting period and, when
 * a recipient is supplied, records a deadline-reminder notification. Email
 * delivery remains via the notification port (logs only in this phase) —
 * delivery is honestly not claimed.
 */
export class GenerateDeadlineRemindersHandler {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly drafts: IReportDraftRepository,
    private readonly sections: IReportSectionRepository,
    private readonly notifications: INotificationRepository,
    private readonly notify: INotificationPort,
  ) {}

  async handle(ctx: AuthenticatedContext, input: GenerateDeadlineRemindersInput): Promise<Result<{ pendingSections: number; remindersCreated: number }, DomainError>> {
    const draftsResult = await this.drafts.findByReportingPeriod(input.reportingPeriodId, ctx.tenant.tenantId);
    if (!draftsResult.ok) return draftsResult;

    let pendingSections = 0;
    for (const draft of draftsResult.value) {
      const sectionsResult = await this.sections.findByReportDraft(draft.id, ctx.tenant.tenantId);
      if (!sectionsResult.ok) return sectionsResult;
      pendingSections += sectionsResult.value.filter((s) => s.status !== "APPROVED").length;
    }

    let remindersCreated = 0;
    if (pendingSections > 0 && input.recipientId) {
      const id = this.ids.generate();
      const title = "Report deadline approaching";
      const message = `${pendingSections} report section(s) are still pending review for this reporting period.`;
      const created = await this.notifications.create({
        id,
        tenantId: ctx.tenant.tenantId.toString(),
        recipientId: input.recipientId,
        type: "DEADLINE_REMINDER",
        title,
        message,
        relatedEntityType: "reportingPeriod",
        relatedEntityId: input.reportingPeriodId,
      });
      if (!created.ok) return created;
      await this.notify.notify({
        tenantId: ctx.tenant.tenantId,
        recipientId: input.recipientId,
        type: "DEADLINE_REMINDER",
        title,
        message,
        relatedEntityType: "reportingPeriod",
        relatedEntityId: input.reportingPeriodId,
      });
      remindersCreated = 1;
    }

    return { ok: true, value: { pendingSections, remindersCreated } };
  }
}
