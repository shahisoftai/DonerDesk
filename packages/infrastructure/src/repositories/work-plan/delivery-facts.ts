import type { IDeliveryFactsReader } from "@donordesk/application";
import { ok } from "@donordesk/domain";
import type { DeliveryFacts, TenantId } from "@donordesk/domain";
import type { PrismaClient } from "@prisma/client";
import { toDay } from "./plan-dates.js";

/** Completed activities per planned activity, withdrawn ones left out (`isLiveActivity`). */
export class PrismaDeliveryFactsReader implements IDeliveryFactsReader {
  constructor(private readonly prisma: PrismaClient) {}

  async factsByPlannedActivity(projectId: string, tenantId: TenantId) {
    const rows = await this.prisma.activityUpdate.findMany({
      where: { projectId, tenantId: tenantId.toString(), plannedActivityId: { not: null }, status: { not: "WITHDRAWN" } },
      select: { id: true, plannedActivityId: true, status: true, activityDate: true, activityEndDate: true },
    });
    // The kinds of file attached to those completed activities, per planned activity.
    const files = rows.length === 0 ? [] : await this.prisma.evidenceFile.findMany({
      where: { tenantId: tenantId.toString(), activityId: { in: rows.map((r) => r.id) } },
      select: { activityId: true, evidenceType: true },
    });
    const plannedOf = new Map(rows.map((r) => [r.id, r.plannedActivityId!]));
    const typesByPlanned = new Map<string, Set<string>>();
    for (const f of files) {
      const planned = plannedOf.get(f.activityId ?? "");
      if (planned) typesByPlanned.set(planned, (typesByPlanned.get(planned) ?? new Set()).add(f.evidenceType));
    }
    const facts = new Map<string, DeliveryFacts>();
    for (const r of rows) {
      const id = r.plannedActivityId!;
      const f = facts.get(id) ?? { liveRecords: 0, acceptedRecords: 0, deliveredCount: 0 };
      const day = toDay(r.activityDate);
      const last = toDay(r.activityEndDate ?? r.activityDate);
      facts.set(id, {
        liveRecords: f.liveRecords + 1,
        acceptedRecords: f.acceptedRecords + (r.status === "ACCEPTED" ? 1 : 0),
        deliveredCount: f.deliveredCount + (r.status === "ACCEPTED" ? 1 : 0),
        firstRecordDate: f.firstRecordDate && f.firstRecordDate < day ? f.firstRecordDate : day,
        lastRecordDate: f.lastRecordDate && f.lastRecordDate > last ? f.lastRecordDate : last,
        evidenceTypes: [...(typesByPlanned.get(id) ?? [])],
      });
    }
    return ok(facts as ReadonlyMap<string, DeliveryFacts>);
  }
}
