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
  WorkPlanResponseSchema,
  RisksResponseSchema,
  DeliveryHealthSchema,
  DataSheetResponseSchema,
  LogframeResponseSchema,
  ProjectBudgetSchema,
  BeneficiariesResponseSchema,
  TeamWorkResponseSchema,
  AssignmentsResponseSchema,
  ClosingPlanSchema,
  TemplatesResponseSchema,
  ReportingProfileResponseSchema,
  ProjectPeopleResponseSchema,
  type ProjectDetail,
} from "@/lib/server/schemas";
import type { AppError } from "@/lib/shared/app-error";
import type { Capability } from "@/lib/shared/capabilities";
import { hasShareOfTarget } from "@donordesk/domain/contexts/reporting/data-sheet.js";
import { sectionsFor, type OverviewFacts, type OverviewSection } from "@/features/projects/domain/overview-sections";
import {
  budgetPace,
  calendarItems,
  closeOut,
  headlineIndicator,
  latestPercentOfTarget,
  latestRecordedCell,
  lifecycle,
  movedThisQuarter,
  needsYouItems,
  resultsPace,
  teamsWeek,
  type CalendarItem,
  type Lifecycle,
  type NeedsYouItem,
} from "@/features/projects/domain/overview-derive";
import type {
  CloseOutData,
  DeliveryData,
  OverviewIdentity,
  PulseData,
  ReadinessBreakdown,
  ReportingData,
  ResultsData,
  ResultsIndicatorView,
  RisksData,
  SectionData,
  SetupData,
  TeamData,
} from "./overview-view";
import { planCounts, outputProgress } from "@/features/workplan/domain/delivery-overview";
import { loadProjectPeople } from "@/features/tasks/application/project-people";
import { REPORT_TYPE_LABEL } from "@/lib/labels";
import { BENEFICIARY_SEX_LABEL } from "@donordesk/domain/contexts/workplan/index.js";

export type { ReadinessBreakdown } from "./overview-view";

export interface OverviewPageData {
  identity: OverviewIdentity;
  life: Lifecycle;
  sections: OverviewSection[];
  needsYou: SectionData<NeedsYouItem[]>;
  pulse: SectionData<PulseData>;
  calendar: SectionData<CalendarItem[]>;
  reporting: SectionData<ReportingData>;
  delivery: SectionData<DeliveryData>;
  results: SectionData<ResultsData>;
  team: SectionData<TeamData>;
  risks: SectionData<RisksData>;
  closeOut: SectionData<CloseOutData>;
  setup: SectionData<SetupData>;
}

export type OverviewLoad = { ok: boolean; error?: AppError; value: OverviewPageData | null };

const ok = <T,>(value: T): SectionData<T> => ({ ok: true, value });
const failed: SectionData<never> = { ok: false };

/**
 * The whole Overview in one read: every call runs in parallel, every section is assembled on its
 * own, and a section whose data could not be read says so instead of breaking the page.
 */
export const loadProjectOverviewV2 = cache(
  async (token: string, projectId: string, options: { role: string | null; capabilities: ReadonlySet<Capability>; today: string; meId?: string }): Promise<OverviewLoad> => {
    const { role, capabilities, today, meId } = options;
    const projectResult = await gatewayRequest(`/v1/projects/${projectId}`, ProjectDetailSchema, token);
    if (!projectResult.ok) return { ok: false, error: projectResult.error, value: null };
    const project: ProjectDetail = projectResult.value;
    const planningVisible = project.showWorkPlanning !== false;

    const [periodsResult, planResult, risksResult, sheetResult, healthResult, logframeResult, budgetResult, peopleResult, beneficiariesResult, teamWorkResult, assignmentsResult, closingResult, templatesResult, profileResult] =
      await Promise.all([
        gatewayRequest(`/v1/projects/${projectId}/reporting-periods`, ReportingPeriodsResponseSchema, token),
        planningVisible ? gatewayRequest(`/v1/projects/${projectId}/work-plan`, WorkPlanResponseSchema, token) : Promise.resolve(null),
        planningVisible ? gatewayRequest(`/v1/projects/${projectId}/risks`, RisksResponseSchema, token) : Promise.resolve(null),
        gatewayRequest(`/v1/projects/${projectId}/data-sheet`, DataSheetResponseSchema, token),
        gatewayRequest(`/v1/projects/${projectId}/delivery-health`, DeliveryHealthSchema, token),
        gatewayRequest(`/v1/projects/${projectId}/logframe`, LogframeResponseSchema, token),
        planningVisible ? gatewayRequest(`/v1/projects/${projectId}/budget`, ProjectBudgetSchema, token) : Promise.resolve(null),
        gatewayRequest(`/v1/projects/${projectId}/people`, ProjectPeopleResponseSchema, token),
        gatewayRequest(`/v1/projects/${projectId}/beneficiaries`, BeneficiariesResponseSchema, token),
        gatewayRequest(`/v1/projects/${projectId}/team-work`, TeamWorkResponseSchema, token),
        gatewayRequest("/v1/me/assignments", AssignmentsResponseSchema, token),
        gatewayRequest(`/v1/projects/${projectId}/closing-report/plan`, ClosingPlanSchema, token),
        gatewayRequest(`/v1/projects/${projectId}/templates`, TemplatesResponseSchema, token),
        gatewayRequest(`/v1/projects/${projectId}/reporting-profile`, ReportingProfileResponseSchema, token),
      ]);

    const periods = periodsResult.ok ? periodsResult.value.items.filter((p) => !p.cancelled) : [];
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

    const life = lifecycle({
      startDate: project.startDate,
      endDate: project.endDate,
      today,
      reportingFrequency: project.reportingFrequency,
      periods: periods.map((p) => ({ reportType: p.reportType, startDate: p.startDate, endDate: p.endDate })),
    });

    const planRows = planResult?.ok ? planResult.value.items : [];
    const riskItems = risksResult?.ok ? risksResult.value.items : [];
    const sheet = sheetResult.ok ? sheetResult.value : null;
    const people = peopleResult.ok ? peopleResult.value.items : [];
    const assignments = assignmentsResult.ok
      ? assignmentsResult.value.groups.flatMap((group) => group.items)
      : [];

    const facts: OverviewFacts = {
      hasPeriods: periods.length > 0,
      hasPlan: planRows.length > 0,
      planningVisible,
      hasRisks: riskItems.length > 0 || capabilities.has("risk.raise"),
      finalYear: life.finalYear,
    };
    const sections = sectionsFor(role, capabilities, facts);

    const identity: OverviewIdentity = {
      id: project.id,
      title: project.title,
      projectCode: project.projectCode,
      donorName: project.donorName,
      country: project.country,
      sector: project.sector,
      status: project.status,
      reportingFrequency: project.reportingFrequency,
      startDate: project.startDate,
      endDate: project.endDate,
      daysRemaining: project.daysRemaining,
      isDemo: project.isDemo,
    };

    /* ---- needs you ---- */
    const needsYouItemsBuilt = needsYouItems({
      today,
      projectId,
      canApproveReport: capabilities.has("report.approve"),
      canReviewActivity: capabilities.has("activity.review"),
      canVerifyEvidence: capabilities.has("evidence.verify"),
      canManageRisks: capabilities.has("risk.manage"),
      periods: periods.map((p) => ({
        id: p.id,
        reportType: p.reportType,
        status: p.status,
        readinessScore: p.readinessScore,
        deadline: p.deadline,
        daysUntilDeadline: p.daysUntilDeadline,
      })),
      assignments: assignments.map((a) => ({
        key: a.key,
        kind: a.kind,
        title: a.title,
        dueDate: a.dueDate,
        state: a.state,
        href: a.href,
        projectId: a.projectId,
        because: a.because,
      })),
      risks: riskItems.map((r) => ({ id: r.id, title: r.title, reviewBy: r.reviewBy, status: r.status })),
    });

    /* ---- pulse ---- */
    const periodLabels = new Map((sheet?.periods ?? []).map((p) => [p.id, p.label]));
    const pace = sheet ? budgetPace(sheet, periodLabels) : [];
    const nextPeriod = [...periods]
      .filter((p) => p.daysUntilDeadline >= 0 && p.status !== "SUBMITTED" && p.status !== "CLOSED" && p.status !== "APPROVED")
      .sort((a, b) => a.daysUntilDeadline - b.daysUntilDeadline)[0];
    const openChecklist = (checklistResult && checklistResult.ok ? checklistResult.value.items : []).filter(
      (c) => c.status !== "RESOLVED" && c.status !== "ACCEPTED_RISK" && c.status !== "NOT_APPLICABLE",
    );
    const allChecklist = checklistResult && checklistResult.ok ? checklistResult.value.items : [];
    const pulse: SectionData<PulseData> = {
      ok: true,
      value: {
        delivery: healthResult.ok
          ? {
              band: healthResult.value.band,
              label: healthResult.value.label,
              reasons: healthResult.value.reasons,
              done: healthResult.value.health.done,
              planned: healthResult.value.health.planned,
              late: healthResult.value.health.doneLate,
            }
          : null,
        results: sheet ? resultsPace(sheet, life.timeElapsedPercent) : null,
        budget: sheet && pace.length > 0 ? { pace, timeElapsedPercent: life.timeElapsedPercent } : null,
        nextDeadline: nextPeriod
          ? {
              title: `${REPORT_TYPE_LABEL[nextPeriod.reportType] ?? "Project"} report`,
              date: nextPeriod.deadline,
              days: nextPeriod.daysUntilDeadline,
              readiness: nextPeriod.readinessScore,
            }
          : null,
        people: beneficiariesResult.ok
          ? {
              total: beneficiariesResult.value.counts.total,
              bySex: Object.entries(beneficiariesResult.value.counts.bySex).map(([key, count]) => ({
                label: BENEFICIARY_SEX_LABEL[key as keyof typeof BENEFICIARY_SEX_LABEL] ?? key,
                count,
              })),
            }
          : null,
        compliance: allChecklist.length > 0 || checklistResult
          ? {
              open: openChecklist.length,
              needsPerson: openChecklist.filter((c) => c.type !== "STATE").length,
              settled: allChecklist.length - openChecklist.length,
            }
          : null,
        time: { daysRemaining: life.daysRemaining, timeElapsedPercent: life.timeElapsedPercent, endDate: project.endDate },
      },
    };

    /* ---- calendar ---- */
    const calendar = calendarItems({
      today,
      projectId,
      meId,
      planRows: planRows.map((r) => ({ id: r.id, title: r.title, plannedEnd: r.plannedEnd, status: r.status, signal: r.signal, ownerUserId: r.ownerUserId })),
      periods: periods.map((p) => ({
        id: p.id,
        reportType: p.reportType,
        status: p.status,
        deadline: p.deadline,
        daysUntilDeadline: p.daysUntilDeadline,
        readinessScore: p.readinessScore,
      })),
      risks: riskItems.map((r) => ({ id: r.id, title: r.title, reviewBy: r.reviewBy, status: r.status, seriousness: r.seriousness })),
      assignments: assignments.map((a) => ({
        key: a.key,
        kind: a.kind,
        title: a.title,
        dueDate: a.dueDate,
        state: a.state,
        href: a.href,
        projectId: a.projectId,
      })),
    });

    /* ---- reporting ---- */
    const reporting: SectionData<ReportingData> = periodsResult.ok
      ? ok<ReportingData>({
          periods: periods.map((p) => ({
            id: p.id,
            title: `${REPORT_TYPE_LABEL[p.reportType] ?? "Project"} report`,
            reportType: p.reportType,
            status: p.status,
            readiness: p.readinessScore,
            deadline: p.deadline,
            daysUntilDeadline: p.daysUntilDeadline,
            current: p.id === activePeriodId,
          })),
          activePeriodId,
          readiness: readinessResult?.ok ? readinessResult.value : null,
          blockers: (readinessResult?.ok ? readinessResult.value.topBlockers ?? [] : []).map((b) => ({
            label: b.label,
            detail: b.detail,
            href: "",
          })),
          compliance: openChecklist.map((c) => ({ id: c.id, title: c.title, severity: c.severity, status: c.status })),
        })
      : failed;

    /* ---- delivery ---- */
    const delivery: SectionData<DeliveryData> = planResult?.ok
      ? ok<DeliveryData>({
          counts: planCounts(planRows),
          health: healthResult.ok ? { band: healthResult.value.band, label: healthResult.value.label, reasons: healthResult.value.reasons } : null,
          movements: movedThisQuarter(
            planRows.map((r) => ({ id: r.id, title: r.title, plannedEnd: r.plannedEnd, originalEnd: r.originalEnd, status: r.status, ownerUserId: r.ownerUserId })),
            today,
          ),
          week: teamsWeek(
            planRows.map((r) => ({ id: r.id, title: r.title, plannedEnd: r.plannedEnd, status: r.status, signal: r.signal, ownerUserId: r.ownerUserId })),
            today,
          ),
          outputs: outputProgress({
            rows: planRows,
            outputs: logframeResult.ok ? logframeResult.value.items.filter((i) => i.level === "OUTPUT").map((i) => ({ id: i.id, title: i.code ? `${i.code} ${i.title}` : i.title })) : [],
            indicators: logframeResult.ok ? logframeResult.value.indicators.map((i) => ({ id: i.id, logframeItemId: i.logframeItemId })) : [],
            parentOf: new Map(logframeResult.ok ? logframeResult.value.items.map((i) => [i.id, i.parentId ?? undefined]) : []),
            sheet: sheet ?? undefined,
            otherTitle: "Other activities",
          }),
          people: await loadProjectPeople(token, projectId, ""),
        })
      : failed;

    /* ---- results & money ---- */
    const results: SectionData<ResultsData> = sheet
      ? ok<ResultsData>({
          indicators: sheet.indicators.map((indicator): ResultsIndicatorView => {
            const percent = latestPercentOfTarget(sheet, indicator);
            const latest = latestRecordedCell(sheet, indicator.id);
            return {
              id: indicator.id,
              code: indicator.code,
              name: indicator.name,
              level: indicator.level,
              // A rate, or an indicator where lower is better, has no "% of target": it shows baseline, target and latest.
              isRate: !hasShareOfTarget(indicator),
              percent,
              baseline: indicator.baseline,
              target: indicator.target,
              latest: latest?.cumulativeValue || latest?.periodValue || "",
            };
          }),
          headline: headlineIndicator(sheet),
          finance: sheet.finance.map((row) => ({
            periodId: row.periodId,
            label: periodLabels.get(row.periodId) ?? row.periodId,
            budget: row.budget,
            expenditure: row.expenditure,
            burn: row.burnRatePercent ?? null,
            verified: row.verified,
          })),
          budgetPace: pace,
          timeElapsedPercent: life.timeElapsedPercent,
        })
      : failed;

    /* ---- team ---- */
    const requests = assignments
      .filter((a) => a.projectId === projectId && (a.kind === "TASK" || a.kind === "INDICATOR_VALUE"))
      .map((a) => ({ key: a.key, title: a.title, dueDate: a.dueDate ?? null, state: a.state, href: a.href, urgent: a.urgent }));
    const team: SectionData<TeamData> = teamWorkResult.ok
      ? ok<TeamData>({
          rows: teamWorkResult.value.rows.map((row) => ({
            userId: row.assigneeId,
            name: people.find((p) => p.userId === row.assigneeId)?.name ?? "Someone",
            role: people.find((p) => p.userId === row.assigneeId)?.role ?? "",
            open: row.open,
            late: row.late,
            dueThisWeek: row.dueThisWeek,
          })),
          requests,
        })
      : failed;

    /* ---- risks ---- */
    const risks: SectionData<RisksData> = risksResult?.ok
      ? ok<RisksData>({ items: riskItems, people: await loadProjectPeople(token, projectId, "") })
      : failed;

    /* ---- close-out ---- */
    const closing = closeOut(project.startDate, project.endDate, today);
    const closeOutData: SectionData<CloseOutData> = closingResult.ok
      ? ok<CloseOutData>({
          monthsRemaining: closing.monthsRemaining,
          finalPeriod: closingResult.value.existingFinalId
            ? { id: closingResult.value.existingFinalId, title: "Final report" }
            : null,
          steps: closingResult.value.steps.map((step) => ({
            key: step.key,
            label: step.label,
            status: step.status,
            detail: step.detail,
            href: null,
          })),
          todoCount: closingResult.value.todoCount,
        })
      : failed;

    /* ---- setup ---- */
    const setup: SectionData<SetupData> = {
      ok: true,
      value: {
        logframe: logframeResult.ok
          ? {
              outcomes: logframeResult.value.items.filter((i) => i.level === "OUTCOME").length,
              outputs: logframeResult.value.items.filter((i) => i.level === "OUTPUT").length,
              indicators: logframeResult.value.indicators.length,
              archived: 0,
            }
          : null,
        templates: templatesResult.ok ? templatesResult.value.items.length : null,
        profile: {
          reportingFrequency: project.reportingFrequency,
          autoCreate: profileResult.ok ? profileResult.value.profile?.autoPeriodCreation ?? null : null,
          secondApprover: profileResult.ok ? profileResult.value.profile?.requireSecondApprover ?? null : null,
        },
      },
    };

    return {
      ok: true,
      value: {
        identity,
        life,
        sections,
        needsYou: ok(needsYouItemsBuilt),
        pulse,
        calendar: ok(calendar),
        reporting,
        delivery,
        results,
        team,
        risks,
        closeOut: closeOutData,
        setup,
      },
    };
  },
);
