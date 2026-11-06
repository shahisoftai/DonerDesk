"use server";

import { proposePeriodForDate, type PeriodProposal } from "@donordesk/domain/contexts/reporting/period-for-date-proposal.js";
import { suggestDeadline, DEFAULT_DEADLINE_OFFSET_DAYS } from "@donordesk/domain/contexts/reporting/period-cadence.js";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { getProject } from "@/lib/server/project-queries";
import { ReportingPeriodsResponseSchema } from "@/lib/server/schemas";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { createReportingPeriodAction } from "./reporting";
import { createTaskAction } from "./tasks";

/**
 * The Record screens' help when a day lands in no reporting period (Phase 44). The decision of WHICH period to open is
 * `proposePeriodForDate` (the project's own cadence, the same function the period form uses); these actions only read the
 * project, ask it and carry the answer out through the existing create-period and request actions. Nothing here is a new write path.
 */

const refusal = (message: string): Result<never, AppError> => ({ ok: false, error: { kind: "validation", message, fields: {} } });

async function proposalFor(token: string, projectId: string, date: string): Promise<Result<{ proposal: PeriodProposal; managerId: string | undefined }, AppError>> {
  const [project, periods] = await Promise.all([
    getProject(token, projectId),
    gatewayRequest(`/v1/projects/${encodeURIComponent(projectId)}/reporting-periods`, ReportingPeriodsResponseSchema, token),
  ]);
  if (!project.ok) return project;
  if (!periods.ok) return periods;
  const proposal = proposePeriodForDate({
    date,
    projectStart: project.value.startDate.slice(0, 10),
    projectEnd: project.value.endDate.slice(0, 10),
    reportingFrequency: project.value.reportingFrequency,
    projectStatus: project.value.status,
    periods: periods.value.items.map((p) => ({ id: p.id, reportType: p.reportType, startDate: p.startDate.slice(0, 10), endDate: p.endDate.slice(0, 10), cancelled: p.cancelled })),
  });
  return { ok: true, value: { proposal, managerId: project.value.projectManagerId } };
}

/** What would be done for this day: already covered, the period(s) the project's cadence calls for, or why none can be. */
export async function periodProposalAction(projectId: string, date: string): Promise<Result<PeriodProposal, AppError>> {
  const context = await requireSession();
  const r = await proposalFor(context.token, projectId, date);
  return r.ok ? { ok: true, value: r.value.proposal } : r;
}

/** Opens the period(s) the proposal names, in order, then answers how many were opened. The server re-checks permission and overlap. */
export async function openPeriodForDateAction(projectId: string, date: string): Promise<Result<{ opened: number }, AppError>> {
  const context = await requireSession();
  const r = await proposalFor(context.token, projectId, date);
  if (!r.ok) return r;
  const { proposal } = r.value;
  if (proposal.kind === "COVERED") return { ok: true, value: { opened: 0 } };
  if (proposal.kind === "NONE") return refusal("No reporting period can be opened for that day.");
  let opened = 0;
  for (const p of proposal.periods) {
    const created = await createReportingPeriodAction({
      projectId,
      reportType: proposal.reportType,
      startDate: new Date(p.startDate).toISOString(),
      endDate: new Date(p.endDate).toISOString(),
      deadline: new Date(suggestDeadline(p.endDate, DEFAULT_DEADLINE_OFFSET_DAYS)).toISOString(),
    });
    if (!created.ok) return created;
    opened += 1;
  }
  return { ok: true, value: { opened } };
}

/** A field worker who cannot open the period asks the project's manager to, through an ordinary request. A repeat for the same day is the same request. */
export async function askToOpenPeriodAction(projectId: string, date: string): Promise<Result<{ id: string }, AppError>> {
  const context = await requireSession();
  const r = await proposalFor(context.token, projectId, date);
  if (!r.ok) return r;
  if (!r.value.managerId) return refusal("This project has no manager to ask yet.");
  return createTaskAction(
    projectId,
    { kind: "OTHER", assigneeId: r.value.managerId, title: `Open the reporting period for ${date}`, note: "A number was recorded for a day that no reporting period covers.", urgent: false },
    { idempotencyKey: `open-period-${projectId}-${date}` },
  );
}
