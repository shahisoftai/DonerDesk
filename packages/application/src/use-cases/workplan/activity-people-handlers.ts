import { DomainError, beneficiaryCounts, err, ok, parseCaseCodes, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock } from "../../ports/core.js";
import type { BeneficiaryRecord, IBeneficiaryLinkRepository, IBeneficiaryRepository } from "../../ports/workplan.js";
import { PlanAccess } from "../../services/plan-access.js";

export interface ActivityPeopleView {
  people: Array<{ id: string; caseCode: string; sex: string; ageGroup: string }>;
  /** Each person once, by sex and age group. */
  counts: ReturnType<typeof beneficiaryCounts>;
}

const pick = (b: BeneficiaryRecord) => ({ id: b.id, caseCode: b.caseCode, sex: b.sex, ageGroup: b.ageGroup });

/** The people an activity reached: who, and how many once each (the unique-people figure for the activity-end report). */
export class GetActivityPeopleHandler {
  constructor(private readonly access: PlanAccess, private readonly links: IBeneficiaryLinkRepository, private readonly beneficiaries: IBeneficiaryRepository) {}

  async handle(ctx: AuthenticatedContext, itemId: string): Promise<Result<ActivityPeopleView, DomainError>> {
    const item = await this.access.load(ctx, itemId, "VIEW");
    if (!item.ok) return item;
    const linked = await this.links.findBeneficiaryIds(itemId, ctx.tenant.tenantId);
    if (!linked.ok) return linked;
    const all = await this.beneficiaries.findByProject(item.value.projectId, ctx.tenant.tenantId);
    if (!all.ok) return all;
    const ids = new Set(linked.value);
    const people = all.value.filter((b) => ids.has(b.id));
    return ok({ people: people.map(pick), counts: beneficiaryCounts(people) });
  }
}

/**
 * Adds people to an activity by case code, or removes them. A code that is not in this project is reported back, never guessed,
 * and nothing is added for a request that names no known code. Only the lead or a manager may change who an activity reached.
 */
export class ChangeActivityPeopleHandler {
  constructor(
    private readonly access: PlanAccess, private readonly links: IBeneficiaryLinkRepository, private readonly beneficiaries: IBeneficiaryRepository,
    private readonly audit: IAuditLogger, private readonly clock: IClock,
  ) {}

  async handle(ctx: AuthenticatedContext, itemId: string, input: { addCaseCodes: string; removeIds: string[] }): Promise<Result<{ added: number; removed: number; unknown: string[] }, DomainError>> {
    const item = await this.access.load(ctx, itemId, "EDIT_NOTES");
    if (!item.ok) return item;
    const all = await this.beneficiaries.findByProject(item.value.projectId, ctx.tenant.tenantId);
    if (!all.ok) return all;
    const byCode = new Map(all.value.map((b) => [b.caseCode, b.id]));
    const codes = parseCaseCodes(input.addCaseCodes);
    const known = codes.filter((c) => byCode.has(c));
    const unknown = codes.filter((c) => !byCode.has(c));
    if (codes.length > 0 && known.length === 0 && input.removeIds.length === 0) {
      return err(DomainError.validation(`No one in this project has ${unknown.length === 1 ? "that case code" : "those case codes"}: ${unknown.slice(0, 5).join(", ")}`, { field: "addCaseCodes" }));
    }
    const projectIds = new Set(all.value.map((b) => b.id));
    const removeIds = input.removeIds.filter((id) => projectIds.has(id));

    let added = 0;
    if (known.length > 0) {
      const res = await this.links.add({
        tenantId: ctx.tenant.tenantId.toString(), projectId: item.value.projectId, plannedActivityId: itemId,
        beneficiaryIds: known.map((c) => byCode.get(c)!), userId: ctx.tenant.userId, now: this.clock.now(),
      });
      if (!res.ok) return res;
      added = res.value;
    }
    let removed = 0;
    if (removeIds.length > 0) {
      const res = await this.links.remove(itemId, removeIds, ctx.tenant.tenantId);
      if (!res.ok) return res;
      removed = res.value;
    }
    if (added + removed > 0) {
      await this.audit.record({
        tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "workplan.people_changed", entityType: "planned_activity", entityId: itemId,
        projectId: item.value.projectId, newValue: JSON.stringify({ added, removed }),
      });
    }
    return ok({ added, removed, unknown });
  }
}
