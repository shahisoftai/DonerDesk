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

/** Numbers handed in and waiting to be verified, for people who verify numbers in a project. Role-based: nobody is named. */
export class ValueReviewAssignmentSource implements IAssignmentSource {
  readonly kind = "VALUE_REVIEW" as const;
  constructor(private readonly prisma: PrismaClient) {}

  async list(q: AssignmentQuery) {
    if (!q.assigneeId) return ok([] as Assignment[]);
    const projects = await projectsWithPermission(this.prisma, q.tenantId, q.assigneeId, "indicator.verify", q.projectId);
    if (projects.length === 0) return ok([] as Assignment[]);
    const rows = await this.prisma.indicatorUpdate.findMany({
      where: { tenantId: q.tenantId.toString(), verificationStatus: "SUBMITTED", indicator: { projectId: { in: projects } } },
      include: { indicator: { select: { code: true, name: true, projectId: true, project: { select: { title: true } } } } },
      orderBy: { updatedAt: "asc" }, take: CAP,
    });
    return ok(rows.map((r): Assignment => ({
      key: `VALUE_REVIEW:${r.id}`, kind: "VALUE_REVIEW", projectId: r.indicator.projectId, projectTitle: r.indicator.project.title,
      title: `${r.indicator.code}: ${r.periodAchievement}`, assigneeId: q.assigneeId!,
      state: "OPEN", urgent: false, href: `/projects/${r.indicator.projectId}/reports/${r.reportingPeriodId}/inputs?tab=indicators`, urgency: 9,
      because: ASSIGNMENT_KINDS.VALUE_REVIEW.because!,
    })));
  }
}

/** Answers sent in through a collection form and not yet accepted or rejected, for people who review them. Role-based. */
export class RecordReviewAssignmentSource implements IAssignmentSource {
  readonly kind = "RECORD_REVIEW" as const;
  constructor(private readonly prisma: PrismaClient) {}

  async list(q: AssignmentQuery) {
    if (!q.assigneeId) return ok([] as Assignment[]);
    const projects = await projectsWithPermission(this.prisma, q.tenantId, q.assigneeId, "indicator.verify", q.projectId);
    if (projects.length === 0) return ok([] as Assignment[]);
    // One row per form, not per record: a morning's worth of answers is one thing to look at.
    const groups = await this.prisma.collectionRecord.groupBy({
      by: ["formId", "projectId"],
      where: { tenantId: q.tenantId.toString(), projectId: { in: projects }, status: "PENDING" },
      _count: { _all: true },
      orderBy: { formId: "asc" },
      take: CAP,
    });
    if (groups.length === 0) return ok([] as Assignment[]);
    const forms = await this.prisma.collectionForm.findMany({ where: { id: { in: groups.map((g) => g.formId) } }, select: { id: true, name: true } });
    const titles = await this.prisma.project.findMany({ where: { id: { in: [...new Set(groups.map((g) => g.projectId))] } }, select: { id: true, title: true } });
    const byId = new Map(forms.map((f) => [f.id, f]));
    const titleOf = new Map(titles.map((p) => [p.id, p.title]));
    return ok(groups.flatMap((g): Assignment[] => {
      const form = byId.get(g.formId);
      const projectTitle = titleOf.get(g.projectId);
      if (!form || !projectTitle) return [];
      return [{
        key: `RECORD_REVIEW:${g.formId}`, kind: "RECORD_REVIEW", projectId: g.projectId, projectTitle,
        title: `${form.name} · ${g._count._all}`, assigneeId: q.assigneeId!,
        state: "OPEN", urgent: false, href: `/projects/${g.projectId}/forms/${g.formId}`, urgency: 8,
        because: ASSIGNMENT_KINDS.RECORD_REVIEW.because!,
      }];
    }));
  }
}
