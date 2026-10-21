import {
  DomainError, mapDonorIndicators, summariseDonorIndicatorMapping,
  type DonorIndicatorDecision, type DonorIndicatorMappingRow, type DonorIndicatorMappingSummary, type Result,
} from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IIdGenerator } from "../../ports/core.js";
import type { IDonorIndicatorMappingRepository } from "../../ports/donor-indicator-mapping.js";
import type { IIndicatorRepository } from "../../ports/logframe.js";
import type { IDonorTemplateRepository } from "../../ports/templates.js";
import { loadTemplate } from "./load-template.js";

export interface DonorIndicatorMappingView {
  templateId: string;
  rows: Array<DonorIndicatorMappingRow & { indicatorCode: string | null; indicatorName: string | null }>;
  indicators: Array<{ id: string; code: string; name: string }>;
  summary: DonorIndicatorMappingSummary;
}

/** The indicators a donor's template asks for, each with the project indicator that answers it (or why none does). */
export class GetDonorIndicatorMappingHandler {
  constructor(
    private readonly templates: IDonorTemplateRepository, private readonly indicators: IIndicatorRepository,
    private readonly decisions: IDonorIndicatorMappingRepository,
  ) {}

  /** Used by the template page and by the export preflight; reads only. */
  async handle(ctx: AuthenticatedContext, templateId: string): Promise<Result<DonorIndicatorMappingView, DomainError>> {
    const template = await loadTemplate(this.templates, templateId, ctx.tenant.tenantId);
    if (!template.ok) return template;
    const live = await this.indicators.findByProject(template.value.projectId, ctx.tenant.tenantId);
    if (!live.ok) return live;
    const stored = await this.decisions.listByTemplate(templateId, ctx.tenant.tenantId);
    if (!stored.ok) return stored;
    const decisions = new Map<string, DonorIndicatorDecision>(stored.value.map((d) => [d.requirementId, { indicatorId: d.indicatorId }]));
    const indicators = live.value.map((i) => ({ id: i.id, code: i.code, name: i.name }));
    const rows = mapDonorIndicators(template.value.requirements.indicatorRequirements.map((r) => ({ id: r.id, text: r.text })), indicators, decisions);
    const byId = new Map(indicators.map((i) => [i.id, i]));
    return {
      ok: true,
      value: {
        templateId,
        indicators,
        summary: summariseDonorIndicatorMapping(rows),
        rows: rows.map((r) => ({ ...r, indicatorCode: byId.get(r.indicatorId ?? "")?.code ?? null, indicatorName: byId.get(r.indicatorId ?? "")?.name ?? null })),
      },
    };
  }
}

export type SetDonorIndicatorMappingInput =
  | { action: "MAP"; indicatorId: string }
  | { action: "NOT_TRACKED" }
  | { action: "CLEAR" };

/** Confirms a match, records that the project will not report an indicator, or goes back to the automatic match. Audited. */
export class SetDonorIndicatorMappingHandler {
  constructor(
    private readonly templates: IDonorTemplateRepository, private readonly indicators: IIndicatorRepository,
    private readonly decisions: IDonorIndicatorMappingRepository, private readonly ids: IIdGenerator, private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, templateId: string, requirementId: string, input: SetDonorIndicatorMappingInput): Promise<Result<void, DomainError>> {
    const template = await loadTemplate(this.templates, templateId, ctx.tenant.tenantId);
    if (!template.ok) return template;
    if (!template.value.requirements.indicatorRequirements.some((r) => r.id === requirementId)) {
      return { ok: false, error: DomainError.notFound("Donor indicator requirement", requirementId) };
    }
    let indicatorId: string | null = null;
    if (input.action === "MAP") {
      const live = await this.indicators.findByProject(template.value.projectId, ctx.tenant.tenantId);
      if (!live.ok) return live;
      if (!live.value.some((i) => i.id === input.indicatorId)) {
        return { ok: false, error: DomainError.validation("Choose one of this project's indicators.") };
      }
      indicatorId = input.indicatorId;
    }
    const saved = input.action === "CLEAR"
      ? await this.decisions.clear(templateId, requirementId, ctx.tenant.tenantId)
      : await this.decisions.save({ id: this.ids.generate(), tenantId: ctx.tenant.tenantId, templateId, requirementId, indicatorId, decidedById: ctx.tenant.userId });
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "template.indicator_mapping.set", entityType: "donor_template",
      entityId: templateId, projectId: template.value.projectId, newValue: JSON.stringify({ requirementId, ...input }),
    });
    return { ok: true, value: undefined };
  }
}
