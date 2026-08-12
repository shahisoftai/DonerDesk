import "server-only";
import { cache } from "react";
import { gatewayRequest } from "@/lib/server/api-gateway";
import {
  ProjectDetailSchema,
  ReportingPeriodsResponseSchema,
  ChecklistResponseSchema,
  EvidenceResponseSchema,
  ActivitiesResponseSchema,
  ReadinessSchema,
  type ProjectDetail,
} from "@/lib/server/schemas";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";

export type ReadinessBreakdown = {
  overall: number;
  sectionsScore: number;
  indicatorsScore: number;
  evidenceScore: number;
  checklistScore: number;
  approvalScore: number;
};

export type ProjectOverview = {
  project: ProjectDetail;
  periods: Array<{
    id: string;
    reportType: string;
    status: string;
    readinessScore: number;
    deadline: string;
    daysUntilDeadline: number;
  }>;
  activePeriodId: string | null;
  readiness: ReadinessBreakdown | null;
  readinessPeriodId: string | null;
  checklist: Array<{ id: string; severity: string; status: string; title: string }>;
  pendingEvidence: number;
  activityCount: number;
};

export type OverviewLoad = {
  ok: boolean;
  error?: AppError;
  value: ProjectOverview | null;
};

export const loadProjectOverview = cache(
  async (token: string, projectId: string): Promise<OverviewLoad> => {
    const projectResult = await gatewayRequest(`/v1/projects/${projectId}`, ProjectDetailSchema, token);
    if (!projectResult.ok) {
      return { ok: false, error: projectResult.error, value: null };
    }
    const project = projectResult.value;

    const periodsResult = await gatewayRequest(
      `/v1/projects/${projectId}/reporting-periods`,
      ReportingPeriodsResponseSchema,
      token,
    );
    const periods = periodsResult.ok ? periodsResult.value.items : [];

    const activePeriodId = periods[0]?.id ?? null;

    const [readinessResult, checklistResult, evidenceResult, activitiesResult] = activePeriodId
      ? await Promise.all([
          gatewayRequest(`/v1/reporting-periods/${activePeriodId}/readiness`, ReadinessSchema, token),
          gatewayRequest(`/v1/reporting-periods/${activePeriodId}/checklist`, ChecklistResponseSchema, token),
          gatewayRequest("/v1/evidence/search", EvidenceResponseSchema, token, {
            method: "POST",
            body: { projectId, verificationStatus: "PENDING_REVIEW", page: 1, pageSize: 1 },
          }),
          gatewayRequest(`/v1/projects/${projectId}/activities`, ActivitiesResponseSchema, token),
        ])
      : [null, null, null, null];

    const overview: ProjectOverview = {
      project,
      periods,
      activePeriodId,
      readiness: readinessResult && readinessResult.ok ? readinessResult.value : null,
      readinessPeriodId: activePeriodId,
      checklist: checklistResult && checklistResult.ok ? checklistResult.value.items : [],
      pendingEvidence: evidenceResult && evidenceResult.ok ? (evidenceResult.value?.total ?? 0) : 0,
      activityCount: activitiesResult && activitiesResult.ok ? activitiesResult.value.items.length : 0,
    };

    return { ok: true, value: overview };
  },
);
