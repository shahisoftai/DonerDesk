import { NO_DELIVERY, deliveryHealth, healthBand, healthReasons, HEALTH_BAND_LABEL, ok, collectionSummary, type DeliveryHealth, type DomainError, type HealthBand, type PlainDate, type Result, type TenantId } from "@donordesk/domain";
import type { ICollectionFactsReader } from "../ports/health.js";
import type { IDeliveryFactsReader, IPlannedActivityRepository } from "../ports/workplan.js";
import { toWorkPlanRow } from "../use-cases/workplan/work-plan-row.js";

export interface ProjectHealth {
  projectId: string;
  band: HealthBand;
  label: string;
  reasons: string[];
  health: DeliveryHealth;
}

/**
 * How projects stand, from the plan and the collection of indicator values, with the same rules the lists use (`toWorkPlanRow`,
 * `collectionSummary`). One service for the project card, the portfolio rows and the stored risk snapshot, so they cannot disagree.
 */
export class ProjectHealthService {
  constructor(
    private readonly plans: IPlannedActivityRepository, private readonly facts: IDeliveryFactsReader, private readonly collection: ICollectionFactsReader,
  ) {}

  async forProjects(tenantId: TenantId, projectIds: ReadonlyArray<string>, today: PlainDate): Promise<Result<ProjectHealth[], DomainError>> {
    if (projectIds.length === 0) return ok([]);
    const collections = await this.collection.forProjects(tenantId, projectIds);
    if (!collections.ok) return collections;
    const byProject = new Map(collections.value.map((c) => [c.projectId, c]));
    const out: ProjectHealth[] = [];
    for (const projectId of projectIds) {
      const items = await this.plans.findByProject(projectId, tenantId);
      if (!items.ok) return items;
      const facts = await this.facts.factsByPlannedActivity(projectId, tenantId);
      if (!facts.ok) return facts;
      const rows = items.value.map((i) => toWorkPlanRow(i, facts.value.get(i.id) ?? NO_DELIVERY, today, false));
      const c = byProject.get(projectId);
      const values = c ? collectionSummary({ projectStart: c.projectStart, dueDays: c.dueDays, indicators: c.indicators, periods: c.periods, recorded: c.recorded, today }) : { overdue: 0, due: 0, recorded: 0 };
      const health = deliveryHealth(rows, values);
      const band = healthBand(health);
      out.push({ projectId, band, label: HEALTH_BAND_LABEL[band], reasons: healthReasons(health), health });
    }
    return ok(out);
  }
}
