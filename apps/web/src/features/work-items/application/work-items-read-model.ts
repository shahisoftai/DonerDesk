import "server-only";
import { cache } from "react";
import { gatewayRequest } from "@/lib/server/api-gateway";
import {
  ProjectsResponseSchema,
  ReportingPeriodsResponseSchema,
  ChecklistResponseSchema,
  EvidenceResponseSchema,
  ActivitiesResponseSchema,
  NotificationsResponseSchema,
  type ProjectListItem,
} from "@/lib/server/schemas";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { classifyBand } from "@/features/dashboard/presentation/deadline-bands";
import { urgencyOf, type WorkItem } from "../domain/work-item.ts";

export type WorkItemsLoad = {
  ok: boolean;
  error?: AppError;
  items: WorkItem[];
  projectLookup: Map<string, string>;
};

export const loadWorkItems = cache(async (token: string): Promise<WorkItemsLoad> => {
  const projectsResult = await gatewayRequest("/v1/projects", ProjectsResponseSchema, token);
  if (!projectsResult.ok) return { ok: false, error: projectsResult.error, items: [], projectLookup: new Map() };
  const projects = projectsResult.value.items;
  const projectLookup = new Map(projects.map((p) => [p.id, p.title]));
  const capped = projects.slice(0, 12);

  const [notificationsResult, periodResults, checklistResults, evidenceResults, activityResults] =
    await Promise.all([
      gatewayRequest("/v1/notifications", NotificationsResponseSchema, token),
      Promise.all(capped.map((p) => gatewayRequest(`/v1/projects/${p.id}/reporting-periods`, ReportingPeriodsResponseSchema, token))),
      Promise.all(capped.map((p) => workChecklist(p, token))),
      Promise.all(capped.map((p) => workEvidence(p, token))),
      Promise.all(capped.map((p) => gatewayRequest(`/v1/projects/${p.id}/activities`, ActivitiesResponseSchema, token))),
    ]);

  const items: WorkItem[] = [];

  if (notificationsResult.ok) {
    for (const n of notificationsResult.value.items) {
      if (n.read) continue;
      items.push({
        kind: "notification",
        id: n.id,
        type: n.type ?? "",
        title: n.title ?? "",
        message: n.message ?? "",
        read: n.read ?? false,
        urgency: 5,
      });
    }
  }

  for (let i = 0; i < capped.length; i++) {
    const project = capped[i]!;
    const periodResult = periodResults[i];
    if (periodResult && periodResult.ok) {
      for (const period of periodResult.value.items) {
        const days = period.daysUntilDeadline ?? null;
        const band = classifyBand(days);
        if (band === null || band === "later") continue;
        items.push({
          kind: "report",
          id: period.id,
          projectId: project.id,
          projectTitle: project.title,
          periodId: period.id,
          periodStatus: period.status,
          deadline: period.deadline,
          daysUntilDeadline: days,
          urgency: urgencyOf(days, 30),
        });
      }
    }

    const checklist = checklistResults[i];
    if (checklist && checklist.ok) {
      for (const item of checklist.value.items) {
        if (item.status === "RESOLVED" || item.status === "ACCEPTED_RISK" || item.status === "NOT_APPLICABLE") continue;
        const dueDays = item.dueDate ? daysUntil(item.dueDate) : null;
        items.push({
          kind: "checklist",
          id: item.id,
          projectId: project.id,
          projectTitle: project.title,
          periodId: item.reportingPeriodId ?? "",
          severity: item.severity,
          title: item.title,
          dueDate: item.dueDate ?? null,
          daysUntilDeadline: dueDays,
          urgency: urgencyOf(dueDays, 15),
        });
      }
    }

    const evidence = evidenceResults[i];
    if (evidence && evidence.ok) {
      for (const file of evidence.value.items) {
        items.push({
          kind: "evidence",
          id: file.id,
          projectId: project.id,
          projectTitle: project.title,
          fileName: file.fileName,
          verificationStatus: file.verificationStatus,
          urgency: 10,
        });
      }
    }

    const activities = activityResults[i];
    if (activities && activities.ok) {
      for (const act of activities.value.items) {
        if (act.status !== "DRAFT" && act.status !== "NEEDS_REVISION") continue;
        items.push({
          kind: "activity",
          id: act.id,
          projectId: project.id,
          projectTitle: project.title,
          activityTitle: act.activityTitle,
          status: act.status,
          urgency: 12,
        });
      }
    }
  }

  items.sort((a, b) => (a.urgency ?? Infinity) - (b.urgency ?? Infinity));
  return { ok: true, items, projectLookup };
});

async function workChecklist(project: ProjectListItem, token: string): Promise<Result<ChecklistPayload, AppError>> {
  const periods = await gatewayRequest(`/v1/projects/${project.id}/reporting-periods`, ReportingPeriodsResponseSchema, token);
  if (!periods.ok) return periods;
  const periodId = periods.value.items[0]?.id;
  if (!periodId) return { ok: true, value: { items: [] } };
  const checklist = await gatewayRequest(`/v1/reporting-periods/${periodId}/checklist`, ChecklistResponseSchema, token);
  if (!checklist.ok) return checklist;
  return { ok: true, value: { items: checklist.value.items } };
}

type ChecklistPayload = { items: Array<{ id: string; reportingPeriodId?: string; severity: string; title: string; status: string; dueDate?: string | null }> };

async function workEvidence(project: ProjectListItem, token: string): Promise<Result<{ items: Array<{ id: string; fileName: string; verificationStatus: string }> }, AppError>> {
  return gatewayRequest("/v1/evidence/search", EvidenceResponseSchema, token, {
    method: "POST",
    body: { projectId: project.id, verificationStatus: "PENDING_REVIEW", page: 1, pageSize: 10 },
  });
}

function daysUntil(iso: string): number {
  const now = Date.now();
  const target = new Date(iso).getTime();
  return Math.round((target - now) / 86_400_000);
}
