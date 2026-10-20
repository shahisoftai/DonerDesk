import { signOffRoles, type TenantId } from "@donordesk/domain";
import type { IProjectRepository } from "../ports/projects.js";
import type { IProjectMemberRepository } from "../ports/project-members.js";
import type { IPersonNotifier } from "../ports/reminders.js";

/** The part of a report the notifier needs; any ReportDraft satisfies it. */
export interface NotifiableReport {
  id: string;
  projectId: string;
  createdById: string;
}

/**
 * Tells the right people when a report changes hands: the project's approvers when it is sent for review, its author
 * when it is approved or sent back. Telling someone is additive: it never fails (or undoes) the change that caused it,
 * and nobody is told about their own action.
 */
export interface IReportNotifier {
  reviewRequested(tenantId: TenantId, actorId: string, report: NotifiableReport): Promise<void>;
  approved(tenantId: TenantId, actorId: string, report: NotifiableReport): Promise<void>;
  returned(tenantId: TenantId, actorId: string, report: NotifiableReport, notes?: string): Promise<void>;
}

export class ReportNotifier implements IReportNotifier {
  constructor(
    private readonly notify: IPersonNotifier,
    private readonly projects: IProjectRepository,
    private readonly members: IProjectMemberRepository,
  ) {}

  async reviewRequested(tenantId: TenantId, actorId: string, report: NotifiableReport): Promise<void> {
    try {
      const [project, members] = await Promise.all([
        this.projects.findById(report.projectId, tenantId),
        this.members.findByProject(report.projectId, tenantId),
      ]);
      if (!project.ok || !members.ok || !project.value) return;
      const roles = signOffRoles({
        projectManagerId: project.value.projectManagerId,
        meOfficerId: project.value.meOfficerId,
        reportingOfficerId: project.value.reportingOfficerId,
        members: members.value.map((m) => ({ userId: m.userId, role: m.role, status: m.status })),
      });
      for (const recipientId of roles.approverIds.filter((id) => id !== actorId)) {
        await this.notify.send({
          tenantId, recipientId, type: "ASSIGNMENT", urgent: false,
          title: "A report is waiting for your review",
          message: `A report for ${project.value.title} has been sent for review. Open it to approve it or send it back.`,
          relatedEntityType: "report_draft", relatedEntityId: report.id,
        });
      }
    } catch {
      /* additive */
    }
  }

  async approved(tenantId: TenantId, actorId: string, report: NotifiableReport): Promise<void> {
    if (report.createdById === actorId) return;
    await this.notify.send({
      tenantId, recipientId: report.createdById, type: "REPORT_APPROVED", urgent: false,
      title: "Your report was approved",
      message: "The report you wrote has been approved.",
      relatedEntityType: "report_draft", relatedEntityId: report.id,
    });
  }

  async returned(tenantId: TenantId, actorId: string, report: NotifiableReport, notes?: string): Promise<void> {
    if (report.createdById === actorId) return;
    const why = notes?.trim();
    await this.notify.send({
      tenantId, recipientId: report.createdById, type: "REPORT_RETURNED", urgent: true,
      title: "Your report was sent back",
      message: why ? `The reviewer sent your report back: ${why}` : "The reviewer sent your report back for changes.",
      relatedEntityType: "report_draft", relatedEntityId: report.id,
    });
  }
}
