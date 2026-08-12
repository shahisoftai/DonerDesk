import { PrismaClient } from "@prisma/client";
import {
  ActivityUpdate,
  TenantId,
  DomainError,
  type Result,
  type ActivityStatus,
} from "@donordesk/domain";
import type { IActivityUpdateRepository } from "@donordesk/application";

function ok<T>(value: T): Result<T, DomainError> {
  return { ok: true, value };
}

export class PrismaActivityUpdateRepository implements IActivityUpdateRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(a: ActivityUpdate): Promise<Result<ActivityUpdate, DomainError>> {
    await this.prisma.activityUpdate.create({
      data: {
        id: a.id,
        tenantId: a.tenantIdValue,
        projectId: a.projectId,
        reportingPeriodId: a.reportingPeriodId,
        activityTitle: a.activityTitle,
        activityDate: a.activityDate,
        location: a.location,
        outputId: a.outputId,
        indicatorId: a.indicatorId,
        participantsTotal: a.participantsTotal,
        participantsMale: a.participantsMale,
        participantsFemale: a.participantsFemale,
        participantsChildren: a.participantsChildren,
        participantsDisability: a.participantsDisability,
        participantsOther: a.participantsOther,
        summary: a.summary,
        achievements: a.achievements,
        challenges: a.challenges,
        lessonsLearned: a.lessonsLearned,
        nextSteps: a.nextSteps,
        attachedEvidenceIds: JSON.stringify(a.attachedEvidenceIds),
        status: a.status,
        submittedById: a.submittedById,
        polishedNarrative: a.polishedNarrative,
      },
    });
    return ok(a);
  }

  async update(a: ActivityUpdate): Promise<Result<ActivityUpdate, DomainError>> {
    await this.prisma.activityUpdate.update({
      where: { id: a.id },
      data: {
        activityTitle: a.activityTitle,
        activityDate: a.activityDate,
        location: a.location,
        outputId: a.outputId,
        indicatorId: a.indicatorId,
        participantsTotal: a.participantsTotal,
        participantsMale: a.participantsMale,
        participantsFemale: a.participantsFemale,
        participantsChildren: a.participantsChildren,
        participantsDisability: a.participantsDisability,
        participantsOther: a.participantsOther,
        summary: a.summary,
        achievements: a.achievements,
        challenges: a.challenges,
        lessonsLearned: a.lessonsLearned,
        nextSteps: a.nextSteps,
        attachedEvidenceIds: JSON.stringify(a.attachedEvidenceIds),
        status: a.status,
        polishedNarrative: a.polishedNarrative,
      },
    });
    return ok(a);
  }

  async findById(id: string, tenantId: TenantId): Promise<Result<ActivityUpdate | null, DomainError>> {
    const row = await this.prisma.activityUpdate.findFirst({ where: { id, tenantId: tenantId.toString() } });
    if (!row) return ok(null);
    return ok(this.toDomain(row));
  }

  async findByReportingPeriod(reportingPeriodId: string, tenantId: TenantId): Promise<Result<ActivityUpdate[], DomainError>> {
    const rows = await this.prisma.activityUpdate.findMany({ where: { reportingPeriodId, tenantId: tenantId.toString() }, orderBy: { activityDate: "asc" } });
    return ok(rows.map((r) => this.toDomain(r)));
  }

  async findByProject(projectId: string, tenantId: TenantId): Promise<Result<ActivityUpdate[], DomainError>> {
    const rows = await this.prisma.activityUpdate.findMany({ where: { projectId, tenantId: tenantId.toString() }, orderBy: { activityDate: "desc" } });
    return ok(rows.map((r) => this.toDomain(r)));
  }

  private toDomain(row: {
    id: string;
    tenantId: string;
    projectId: string;
    reportingPeriodId: string;
    activityTitle: string;
    activityDate: Date;
    location: string | null;
    outputId: string | null;
    indicatorId: string | null;
    participantsTotal: number | null;
    participantsMale: number | null;
    participantsFemale: number | null;
    participantsChildren: number | null;
    participantsDisability: number | null;
    participantsOther: string | null;
    summary: string;
    achievements: string;
    challenges: string;
    lessonsLearned: string;
    nextSteps: string;
    attachedEvidenceIds: string;
    status: string;
    submittedById: string;
    polishedNarrative: string | null;
    createdAt: Date;
  }): ActivityUpdate {
    return ActivityUpdate.rehydrate({
      id: row.id,
      tenantId: row.tenantId,
      projectId: row.projectId,
      createdAt: row.createdAt,
      props: {
        reportingPeriodId: row.reportingPeriodId,
        activityTitle: row.activityTitle,
        activityDate: row.activityDate,
        location: row.location ?? undefined,
        outputId: row.outputId ?? undefined,
        indicatorId: row.indicatorId ?? undefined,
        participantsTotal: row.participantsTotal ?? undefined,
        participantsMale: row.participantsMale ?? undefined,
        participantsFemale: row.participantsFemale ?? undefined,
        participantsChildren: row.participantsChildren ?? undefined,
        participantsDisability: row.participantsDisability ?? undefined,
        participantsOther: row.participantsOther ?? undefined,
        summary: row.summary,
        achievements: row.achievements,
        challenges: row.challenges,
        lessonsLearned: row.lessonsLearned,
        nextSteps: row.nextSteps,
        attachedEvidenceIds: JSON.parse(row.attachedEvidenceIds),
        status: row.status as ActivityStatus,
        submittedById: row.submittedById,
        polishedNarrative: row.polishedNarrative ?? undefined,
      },
    });
  }
}
