import { DomainError } from "@donordesk/domain";
import type { IAuditLogger } from "../../ports/core.js";
import type { IReportingProfileRepository } from "../../ports/setup.js";
import type { SetupDeadlineOffsetWriter } from "../../ports/project-setup-apply.js";

/** The most days after a period ends that a report can be due (a year). */
export const MAX_DEADLINE_OFFSET_DAYS = 365;

/**
 * Writes the wizard's due days to the new project's reporting profile (Phase 38 fix): "create all periods" takes each period's
 * deadline from the profile, so the number the person set on the Reporting slide must be there before the periods are made.
 * Setting the same number again changes nothing, so a resumed launch is safe.
 */
export class SetProjectDeadlineOffsetHandler implements SetupDeadlineOffsetWriter {
  constructor(private readonly profiles: IReportingProfileRepository, private readonly audit: IAuditLogger) {}

  async handle(...[ctx, projectId, days]: Parameters<SetupDeadlineOffsetWriter["handle"]>): ReturnType<SetupDeadlineOffsetWriter["handle"]> {
    if (!Number.isInteger(days) || days < 0 || days > MAX_DEADLINE_OFFSET_DAYS) {
      return { ok: false, error: DomainError.validation(`Reports can be due from 0 to ${MAX_DEADLINE_OFFSET_DAYS} days after a period ends.`) };
    }
    const found = await this.profiles.findByProject(projectId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    const profile = found.value;
    if (!profile) return { ok: false, error: DomainError.notFound("Reporting profile", projectId) };
    if (profile.deadlineOffsetDays === days) return { ok: true, value: { days } };
    profile.update({ deadlineOffsetDays: days, updatedById: ctx.tenant.userId });
    const saved = await this.profiles.update(profile);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "project.reporting_profile.updated", entityType: "reporting_profile",
      entityId: profile.id, projectId, newValue: JSON.stringify({ deadlineOffsetDays: days, source: "project_setup_launch" }),
    });
    return { ok: true, value: { days } };
  }
}
