import type { PrismaClient } from "@prisma/client";
import type { TenantId } from "@donordesk/domain";
import type { ICommentTargets } from "@donordesk/application";

type Found = { title: string; owners: string[] } | null;

const parseIds = (json: string | null | undefined): string[] => {
  try { const v = JSON.parse(json ?? "[]"); return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []; } catch { return []; }
};
const some = (...ids: Array<string | null | undefined>): string[] => ids.filter((x): x is string => !!x);

/** One lookup per commentable type, always inside the organisation; an unknown type or another organisation's id is null. */
export class PrismaCommentTargets implements ICommentTargets {
  constructor(private readonly prisma: PrismaClient) {}

  async resolve(tenantId: TenantId, entityType: string, id: string): Promise<Found> {
    const where = { id, tenantId: tenantId.toString() };
    switch (entityType) {
      case "planned_activity": {
        const r = await this.prisma.plannedActivity.findFirst({ where });
        return r ? { title: r.title, owners: [...some(r.ownerUserId), ...parseIds(r.supportUserIds)] } : null;
      }
      case "project_risk": {
        const r = await this.prisma.projectRisk.findFirst({ where });
        return r ? { title: r.title, owners: some(r.ownerId, r.raisedById) } : null;
      }
      case "activity_update": {
        const r = await this.prisma.activityUpdate.findFirst({ where });
        return r ? { title: r.activityTitle, owners: some(r.submittedById) } : null;
      }
      case "indicator": {
        const r = await this.prisma.indicator.findFirst({ where });
        return r ? { title: r.name, owners: some(r.responsibleUserId) } : null;
      }
      case "evidence": {
        const r = await this.prisma.evidenceFile.findFirst({ where });
        return r ? { title: r.title, owners: some(r.uploadedById) } : null;
      }
      case "report_section": {
        const r = await this.prisma.reportSection.findFirst({ where });
        return r ? { title: r.sectionTitle, owners: [] } : null;
      }
      case "indicator_update": {
        const r = await this.prisma.indicatorUpdate.findFirst({ where });
        return r ? { title: "Indicator value", owners: [] } : null;
      }
      case "checklist_item": {
        const r = await this.prisma.checklistItem.findFirst({ where });
        return r ? { title: "Checklist item", owners: [] } : null;
      }
      default:
        return null;
    }
  }
}
