import type { Result } from "@donordesk/domain";
import { DomainError, compareLogframeItems, summariseActivityDelivery, describeSemantics, describeStandard, effectiveIndicatorSemantics, parseLink } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ILogframeRepository, IIndicatorRepository } from "../../ports/logframe.js";
import type { IActivityUpdateRepository } from "../../ports/activities.js";

export class ListLogframeHandler {
  constructor(
    private readonly items: ILogframeRepository,
    private readonly indicators: IIndicatorRepository,
    /** Absent in legacy wiring: ACTIVITY nodes then carry no delivery summary. */
    private readonly activities?: IActivityUpdateRepository,
  ) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<{ items: unknown[]; indicators: unknown[] }, DomainError>> {
    const itemResult = await this.items.findByProject(projectId, ctx.tenant.tenantId);
    const indResult = await this.indicators.findByProject(projectId, ctx.tenant.tenantId);
    if (!itemResult.ok) return itemResult;
    if (!indResult.ok) return indResult;
    const records = this.activities ? await this.activities.findByProject(projectId, ctx.tenant.tenantId) : null;
    if (records && !records.ok) return records;
    const delivery = records ? summariseActivityDelivery(records.value) : new Map();
    return {
      ok: true,
      value: {
        items: [...itemResult.value].sort(compareLogframeItems).map((i) => ({
          id: i.id,
          parentId: i.parentId,
          level: i.level,
          code: i.code,
          title: i.title,
          description: i.description,
          sortOrder: i.sortOrder,
          ...(i.assumptions ? { assumptions: i.assumptions } : {}),
          ...(i.rationale ? { rationale: i.rationale } : {}),
          ...(i.level === "ACTIVITY" && records ? { delivery: delivery.get(i.id) ?? { recordedCount: 0, acceptedCount: 0, lastActivityDate: null, participantsTotal: 0 } } : {}),
        })),
        indicators: indResult.value.map((i) => ({
          id: i.id,
          logframeItemId: i.logframeItemId,
          code: i.code,
          name: i.name,
          type: i.type,
          baseline: i.baseline,
          target: i.target,
          unit: i.unit,
          meansOfVerification: i.meansOfVerification,
          dataSource: i.dataSource,
          frequency: i.frequency,
          responsibleUserId: i.responsibleUserId,
          disaggregationRequired: i.disaggregationRequired,
          targetBreakdowns: i.targetBreakdowns,
          targetSchedule: i.targetSchedule,
          ...(i.formula ? { formula: i.formula } : {}),
          countedElsewhere: i.countedElsewhere,
          recordByPlace: i.recordByPlace,
          placeLevel: i.placeLevel,
          placeScope: i.placeScope,
          placeIds: i.placeIds,
          library: libraryInfo(i.libraryJson),
          semantics: i.semantics,
          semanticsDescription: describeSemantics(effectiveIndicatorSemantics(i), i.type),
        })),
      },
    };
  }
}

/** What the Logframe page shows of an indicator's library link: which entry, and its reference standard as a phrase and as data. */
function libraryInfo(json: string | undefined) {
  const link = parseLink(json);
  if (!link) return null;
  const std = link.snapshot.referenceStandard;
  return { id: link.id, version: link.version, adoptedOn: link.adoptedOn, referenceStandard: std, referenceText: std ? describeStandard(std) : null };
}
