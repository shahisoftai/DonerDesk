import { plannedActivityFromRow } from "./planned-activity.js";
import type { IMyWeekReader, MyWeekSentBack } from "@donordesk/application";
import { ok } from "@donordesk/domain";
import type { PlainDate, TenantId } from "@donordesk/domain";
import type { PrismaClient } from "@prisma/client";
import { toDate, toDay } from "./plan-dates.js";

/** A person's own week across projects: open planned activities they lead or help with, and activities sent back to them. */
export class PrismaMyWeekReader implements IMyWeekReader {
  constructor(private readonly prisma: PrismaClient) {}

  async openPlannedFor(userId: string, tenantId: TenantId, startsOnOrBefore: PlainDate) {
    const rows = await this.prisma.plannedActivity.findMany({
      where: {
        tenantId: tenantId.toString(),
        status: { in: ["PLANNED", "IN_PROGRESS"] },
        plannedStart: { lte: toDate(startsOnOrBefore) },
        OR: [{ ownerUserId: userId }, { supportUserIds: { contains: JSON.stringify(userId) } }],
        project: { showWorkPlanning: true, archivedAt: null },
      },
      include: { project: { select: { title: true } } },
      orderBy: [{ plannedStart: "asc" }, { title: "asc" }],
    });
    return ok(rows.map((r) => ({ item: plannedActivityFromRow(r), projectTitle: r.project.title })));
  }

  async sentBackFor(userId: string, tenantId: TenantId) {
    const rows = await this.prisma.activityUpdate.findMany({
      where: { tenantId: tenantId.toString(), submittedById: userId, status: { in: ["NEEDS_REVISION", "REJECTED"] }, project: { archivedAt: null } },
      select: { id: true, projectId: true, activityTitle: true, activityDate: true, status: true, project: { select: { title: true } } },
      orderBy: { activityDate: "desc" },
      take: 50,
    });
    return ok(rows.map((r): MyWeekSentBack => ({ id: r.id, projectId: r.projectId, projectTitle: r.project.title, title: r.activityTitle, activityDate: toDay(r.activityDate), status: r.status as MyWeekSentBack["status"] })));
  }
}
