import { DomainError, type Responsibility } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../../context.js";
import type { SetupPlanRows } from "../../../ports/project-setup-launch.js";
import type { IResponsibilityApplier } from "./responsibility-appliers.js";

/** The planned activity the person leads, found by its title and start day; one that cannot be found, or is ambiguous, is said so. */
export class PlanLeadApplier implements IResponsibilityApplier<"PLAN_LEAD"> {
  readonly kind = "PLAN_LEAD" as const;
  constructor(private readonly plan: SetupPlanRows) {}
  async apply(ctx: AuthenticatedContext, projectId: string, userId: string, r: Extract<Responsibility, { kind: "PLAN_LEAD" }>) {
    const rows = await this.plan.rows(ctx, projectId);
    if (!rows.ok) return rows;
    const found = rows.value.filter((row) => row.title === r.title && (r.start === null || row.plannedStart === r.start));
    if (found.length === 0) return { ok: false as const, error: DomainError.notFound("Planned activity", r.title) };
    if (found.length > 1) return { ok: false as const, error: DomainError.validation(`More than one planned activity is called “${r.title}” on that day, so the lead was not set. Set it on the Work plan.`) };
    return this.plan.assignLead(ctx, found[0]!.id, userId);
  }
}
