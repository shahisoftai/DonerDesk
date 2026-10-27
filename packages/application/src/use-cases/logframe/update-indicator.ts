import type { Result } from "@donordesk/domain";
import { DomainError, checkIndicatorEdit, type IndicatorFormula, validateTargetBreakdowns, targetScheduleProblems, sortedTargetSchedule, validateFormula } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IIndicatorRepository, IIndicatorUpdateRepository } from "../../ports/logframe.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { UpdateIndicatorInput } from "@donordesk/contracts";

/** Edits the descriptive fields of an indicator (not its parent: see MoveIndicatorHandler). */
export class UpdateIndicatorHandler {
  constructor(
    private readonly indicators: IIndicatorRepository,
    private readonly updates: IIndicatorUpdateRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, input: UpdateIndicatorInput): Promise<Result<{ id: string }, DomainError>> {
    const found = await this.indicators.findById(input.indicatorId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    const indicator = found.value;
    if (!indicator) return { ok: false, error: DomainError.notFound("Indicator", input.indicatorId) };

    const values = await this.updates.findByIndicator(indicator.id, ctx.tenant.tenantId);
    if (!values.ok) return values;
    const verdict = checkIndicatorEdit({ currentType: indicator.type, requestedType: input.type, hasValues: values.value.length > 0 });
    if (!verdict.allowed) return { ok: false, error: DomainError.validation(verdict.reason) };

    const { indicatorId: _id, ...fields } = input;
    if (fields.targetBreakdowns !== undefined) {
      // Checked against the type and total target this edit will leave the indicator with.
      const breakdowns = validateTargetBreakdowns(fields.targetBreakdowns, { indicatorType: fields.type ?? indicator.type, target: fields.target ?? indicator.target });
      if (!breakdowns.ok) return breakdowns;
      fields.targetBreakdowns = breakdowns.value;
    }
    if (fields.targetSchedule !== undefined) {
      const problem = targetScheduleProblems(fields.targetSchedule)[0];
      if (problem) return { ok: false, error: DomainError.validation(`Target schedule, line ${problem.row}: ${problem.message}`) };
      fields.targetSchedule = sortedTargetSchedule(fields.targetSchedule);
    }
    const { formula: formulaInput, ...rest } = fields;
    let formulaPatch: { formula: IndicatorFormula | undefined } | undefined;
    const effectiveType = rest.type ?? indicator.type;
    if (formulaInput !== undefined) {
      if (formulaInput === null) { if (indicator.formula) formulaPatch = { formula: undefined }; }
      else {
        const siblings = await this.indicators.findByProject(indicator.projectId, ctx.tenant.tenantId);
        if (!siblings.ok) return siblings;
        if (values.value.length > 0 && !indicator.formula) return { ok: false, error: DomainError.validation("This indicator already has typed values; add a new indicator for the calculation, or remove the values first") };
        const checked = validateFormula(indicator.id, effectiveType, formulaInput, siblings.value.map((i) => ({ id: i.id, code: i.code, type: i.type, formula: i.formula })));
        if (!checked.ok) return checked;
        formulaPatch = { formula: checked.value };
      }
    } else if (indicator.formula && rest.type !== undefined && rest.type !== indicator.type) {
      return { ok: false, error: DomainError.validation("Remove the formula before changing the type") };
    }
    const patch = Object.fromEntries(Object.entries(rest).filter(([, value]) => value !== undefined));
    if (formulaPatch) Object.assign(patch, formulaPatch);
    if (Object.keys(patch).length === 0) return { ok: true, value: { id: indicator.id } };

    const before = JSON.stringify(Object.fromEntries(Object.keys(patch).map((k) => [k, (indicator as unknown as Record<string, unknown>)[k]])));
    try {
      indicator.update(patch);
    } catch (e) {
      return { ok: false, error: DomainError.validation(e instanceof Error ? e.message : "Invalid indicator") };
    }
    const saved = await this.indicators.update(indicator);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "logframe.indicator.updated",
      entityType: "indicator",
      entityId: indicator.id,
      projectId: indicator.projectId,
      oldValue: before,
      newValue: JSON.stringify(patch),
    });
    return { ok: true, value: { id: indicator.id } };
  }
}
