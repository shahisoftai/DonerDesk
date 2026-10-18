import type { PrismaClient } from "@prisma/client";
import { ASSIGNMENT_KINDS, ok, type Assignment } from "@donordesk/domain";
import type { AssignmentQuery, IAssignmentSource } from "@donordesk/application";
import { projectsWithPermission } from "../repositories/tasks.js";

/** More than this is a backlog, not a to-do list: the page links to the full screen. */
const CAP = 50;
const AWAITING_VERIFICATION = ["UPLOADED", "AI_TAGGED", "PENDING_REVIEW"];

/** Files to check, for people who can verify files in a project. Role-based: nobody is named, so a team query returns nothing. */
export class EvidenceReviewAssignmentSource implements IAssignmentSource {
  readonly kind = "EVIDENCE_REVIEW" as const;
  constructor(private readonly prisma: PrismaClient) {}

  async list(q: AssignmentQuery) {
    if (!q.assigneeId) return ok([] as Assignment[]);
    const projects = await projectsWithPermission(this.prisma, q.tenantId, q.assigneeId, "evidence.verify", q.projectId);
    if (projects.length === 0) return ok([] as Assignment[]);
    const rows = await this.prisma.evidenceFile.findMany({
      where: { tenantId: q.tenantId.toString(), projectId: { in: projects }, verificationStatus: { in: AWAITING_VERIFICATION } },
      include: { project: { select: { title: true } } },
      orderBy: { createdAt: "asc" }, take: CAP,
    });
    return ok(rows.map((r): Assignment => ({
      key: `EVIDENCE_REVIEW:${r.id}`, kind: "EVIDENCE_REVIEW", projectId: r.projectId!, projectTitle: r.project!.title, title: r.fileName, assigneeId: q.assigneeId!,
      state: "OPEN", urgent: false, href: `/projects/${r.projectId}/evidence`, urgency: 10, because: ASSIGNMENT_KINDS.EVIDENCE_REVIEW.because!,
    })));
  }
}

/** Completed activities waiting for a decision, for people who approve them. Role-based. */
export class ActivityReviewAssignmentSource implements IAssignmentSource {
  readonly kind = "ACTIVITY_REVIEW" as const;
  constructor(private readonly prisma: PrismaClient) {}

  async list(q: AssignmentQuery) {
    if (!q.assigneeId) return ok([] as Assignment[]);
    const projects = await projectsWithPermission(this.prisma, q.tenantId, q.assigneeId, "activity.approve", q.projectId);
    if (projects.length === 0) return ok([] as Assignment[]);
    const rows = await this.prisma.activityUpdate.findMany({
      where: { tenantId: q.tenantId.toString(), projectId: { in: projects }, status: "SUBMITTED" },
      include: { project: { select: { title: true } } },
      orderBy: { activityDate: "asc" }, take: CAP,
    });
    return ok(rows.map((r): Assignment => ({
      key: `ACTIVITY_REVIEW:${r.id}`, kind: "ACTIVITY_REVIEW", projectId: r.projectId, projectTitle: r.project.title, title: r.activityTitle, assigneeId: q.assigneeId!,
      state: "OPEN", urgent: false, href: `/projects/${r.projectId}/activities/${r.id}`, urgency: 12, because: ASSIGNMENT_KINDS.ACTIVITY_REVIEW.because!,
    })));
  }
}

/** A person's own completed activities that were sent back (or not finished): the old My Work showed these too. */
export class ActivityFixAssignmentSource implements IAssignmentSource {
  readonly kind = "ACTIVITY_FIX" as const;
  constructor(private readonly prisma: PrismaClient) {}

  async list(q: AssignmentQuery) {
    const rows = await this.prisma.activityUpdate.findMany({
      where: {
        tenantId: q.tenantId.toString(), status: { in: ["DRAFT", "NEEDS_REVISION", "REJECTED"] }, project: { archivedAt: null },
        ...(q.assigneeId ? { submittedById: q.assigneeId } : {}), ...(q.projectId ? { projectId: q.projectId } : {}),
      },
      include: { project: { select: { title: true } } },
      orderBy: { activityDate: "desc" }, take: CAP,
    });
    return ok(rows.map((r): Assignment => ({
      key: `ACTIVITY_FIX:${r.id}`, kind: "ACTIVITY_FIX", projectId: r.projectId, projectTitle: r.project.title, title: r.activityTitle, assigneeId: r.submittedById,
      state: "OPEN", urgent: false, href: `/projects/${r.projectId}/activities/${r.id}`, urgency: 11,
    })));
  }
}
