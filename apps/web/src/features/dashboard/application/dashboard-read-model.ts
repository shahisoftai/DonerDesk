import "server-only";
import { cache } from "react";
import { gatewayRequest } from "@/lib/server/api-gateway";
import {
  ProjectsResponseSchema,
  NotificationsResponseSchema,
  ReportingPeriodsResponseSchema,
  ChecklistResponseSchema,
  EvidenceResponseSchema,
  ActivitiesResponseSchema,
  type ProjectListItem,
} from "@/lib/server/schemas";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
export type { DeadlineBand } from "../presentation/deadline-bands";
import { classifyBand, type DeadlineBand } from "../presentation/deadline-bands";

export type ProjectDeadline = {
  projectId: string;
  projectTitle: string;
  periodId: string;
  periodStatus: string;
  readinessScore: number | null;
  deadline: string;
  daysUntilDeadline: number | null;
  band: DeadlineBand | null;
};

export type DashboardWidget<T> = {
  ok: boolean;
  value: T | null;
  error?: AppError;
};

export type DashboardSnapshot = {
  projects: DashboardWidget<ProjectListItem[]>;
  notifications: DashboardWidget<Array<{ id: string; type: string; title: string; message: string; read: boolean; createdAt: string; relatedEntityType?: string; relatedEntityId?: string }>>;
  pendingEvidence: DashboardWidget<number>;
  deadlineData: DashboardWidget<ProjectDeadline[]>;
};

const PAGE_SIZE = 50;

export const loadDashboard = cache(async (token: string): Promise<DashboardSnapshot> => {
  const [projectsResult, notificationsResult] = await Promise.all([
    gatewayRequest("/v1/projects", ProjectsResponseSchema, token),
    gatewayRequest("/v1/notifications", NotificationsResponseSchema, token),
  ]);

  const projectsWidget: DashboardWidget<ProjectListItem[]> = projectsResult.ok
    ? { ok: true, value: projectsResult.value.items }
    : { ok: false, value: null, error: projectsResult.error };

  const notificationsWidget = notificationsResult.ok
    ? {
        ok: true,
        value: notificationsResult.value.items as Array<{ id: string; type: string; title: string; message: string; read: boolean; createdAt: string; relatedEntityType?: string; relatedEntityId?: string }>,
      }
    : { ok: false, value: null, error: notificationsResult.error };

  const projectIds = projectsResult.ok ? projectsResult.value.items.map((p) => p.id) : [];
  const capped = projectIds.slice(0, 12);

  const periodResults = await Promise.all(
    capped.map((id) => gatewayRequest(`/v1/projects/${id}/reporting-periods`, ReportingPeriodsResponseSchema, token)),
  );

  const deadlines: ProjectDeadline[] = [];
  const projectItems = projectsResult.ok ? projectsResult.value.items : [];
  for (let index = 0; index < capped.length; index++) {
    const periodResult = periodResults[index];
    if (!periodResult || !periodResult.ok) continue;
    const project = projectItems.find((p) => p.id === capped[index]);
    const periods = periodResult.value.items;
    const upcoming = [...periods].sort(
      (a, b) => (a.daysUntilDeadline ?? Infinity) - (b.daysUntilDeadline ?? Infinity),
    )[0];
    if (!project || !upcoming) continue;
    deadlines.push({
      projectId: project.id,
      projectTitle: project.title,
      periodId: upcoming.id,
      periodStatus: upcoming.status,
      readinessScore: upcoming.readinessScore ?? null,
      deadline: upcoming.deadline,
      daysUntilDeadline: upcoming.daysUntilDeadline,
      band: classifyBand(upcoming.daysUntilDeadline),
    });
  }

  const evidenceWidget = await loadPendingEvidence(token, capped);

  return {
    projects: projectsWidget,
    notifications: notificationsWidget,
    deadlineData: { ok: true, value: deadlines },
    pendingEvidence: evidenceWidget,
  };
});

async function loadPendingEvidence(
  token: string,
  projectIds: string[],
): Promise<DashboardWidget<number>> {
  const counts = await Promise.all(
    projectIds.map((id) =>
      gatewayRequest(
        "/v1/evidence/search",
        EvidenceResponseSchema,
        token,
        {
          method: "POST",
          body: { projectId: id, verificationStatus: "PENDING_REVIEW", page: 1, pageSize: 1 },
        },
      ),
    ),
  );
  const anyFailed = counts.some((c) => !c.ok);
  if (anyFailed) {
    return { ok: false, value: null, error: counts.find((c) => !c.ok)!.error };
  }
  const total = counts.reduce((sum, c) => (c.ok ? sum + (c.value?.total ?? 0) : sum), 0);
  return { ok: true, value: total };
}
