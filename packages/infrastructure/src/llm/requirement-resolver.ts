import { DomainError, resolveRequirements, type ResolvedReportingRequirements, type RequirementSourceType } from "@donordesk/domain";
import type { IRequirementResolver, IRequirementPackRepository, IAwardOverrideRepository, IResolvedRequirementsRepository, IReportingPeriodRepository, IReportPlanRepository, IRequirementEvaluator } from "@donordesk/application";
import type { IIdGenerator } from "@donordesk/application";
import type { TenantId } from "@donordesk/domain";
import { DeterministicRequirementEvaluator } from "./requirement-evaluator.js";

function normalize(value: string): string {
  return value.toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Deterministic requirement precedence resolver (Phase 5). Layers are merged
 * highest-precedence-first: signed award overrides beat mechanism packs, which
 * beat donor packs, which beat the conservative baseline. Every resolved
 * requirement records its provenance, and the coverage result drives the
 * REQUIREMENT_UNSATISFIED gate via a pluggable IRequirementEvaluator.
 */
export class DeterministicRequirementResolver implements IRequirementResolver {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly periods: IReportingPeriodRepository,
    private readonly packs: IRequirementPackRepository,
    private readonly overrides: IAwardOverrideRepository,
    private readonly plans: IReportPlanRepository,
    private readonly resolved: IResolvedRequirementsRepository,
    private readonly evaluator: IRequirementEvaluator = new DeterministicRequirementEvaluator(),
  ) {}

  async resolve(input: {
    tenantId: TenantId;
    reportingPeriodId: string;
    effectiveDate: Date;
  }): Promise<{ ok: true; value: ResolvedReportingRequirements } | { ok: false; error: DomainError }> {
    const periodResult = await this.periods.findById(input.reportingPeriodId, input.tenantId);
    if (!periodResult.ok) return periodResult;
    const period = periodResult.value;
    if (!period) return { ok: false, error: DomainError.notFound("ReportingPeriod", input.reportingPeriodId) };

    const layers: Array<{ sourceType: RequirementSourceType; requirements: ResolvedReportingRequirements["snapshot"] }> = [];

    const overridesResult = await this.overrides.findActiveForProject(period.projectId, input.tenantId, input.effectiveDate);
    if (!overridesResult.ok) return overridesResult;
    for (const override of overridesResult.value) {
      layers.push({ sourceType: "AWARD_AMENDMENT", requirements: override.requirements });
    }

    const template = this.parseTemplateSnapshot(period.templateSnapshotJson);
    if (template?.donorKey && template?.mechanismKey) {
      const packResult = await this.packs.findActiveByMechanism({
        donorKey: template.donorKey,
        mechanismKey: template.mechanismKey,
        reportType: period.reportType,
        language: "en",
        tenantId: input.tenantId.toString(),
      });
      if (!packResult.ok) return packResult;
      if (packResult.value) {
        layers.push({ sourceType: "DONOR_PACK", requirements: packResult.value.requirements });
      }
    }

    const merged = resolveRequirements({ layers });

    const plansResult = await this.plans.findByReportingPeriod(input.reportingPeriodId, input.tenantId);
    if (!plansResult.ok) return plansResult;
    const plan = plansResult.value[0];
    const titles = plan ? plan.sections.map((s) => s.title) : [];
    const sectionRequirementKeys = plan ? plan.sections.map((s) => s.requirementKeys ?? []) : [];
    const sectionContents = plan ? plan.sections.map(() => "") : [];

    const evaluation = await this.evaluator.evaluate({
      requirements: merged.requirements,
      sectionTitles: titles,
      sectionRequirementKeys,
      sectionContents,
    });
    if (!evaluation.ok) return evaluation;

    const now = new Date();
    const resolvedValue: ResolvedReportingRequirements = {
      id: this.ids.generate(),
      tenantId: input.tenantId.toString(),
      reportingPeriodId: input.reportingPeriodId,
      snapshot: merged.requirements,
      sourceTrace: merged.sourceTrace,
      coverage: {
        satisfied: evaluation.value.satisfied,
        unmet: evaluation.value.unmet,
      },
      resolvedAt: now,
      createdAt: now,
    };

    const saved = await this.resolved.create(resolvedValue);
    if (!saved.ok) return saved;
    return { ok: true, value: resolvedValue };
  }

  private parseTemplateSnapshot(json: string): { donorKey?: string; mechanismKey?: string } | null {
    if (!json || json === "{}") return null;
    try {
      const raw = JSON.parse(json) as { donorName?: string; donorKey?: string; templateName?: string; mechanismKey?: string };
      const donorKey = raw.donorKey ?? (raw.donorName ? normalize(raw.donorName).replace(/\s+/g, "-") : undefined);
      const mechanismKey = raw.mechanismKey ?? (raw.templateName ? normalize(raw.templateName).replace(/\s+/g, "-") : undefined);
      if (!donorKey || !mechanismKey) return null;
      return { donorKey, mechanismKey };
    } catch {
      return null;
    }
  }
}
