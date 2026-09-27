import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import {
  ReadinessSchema,
  ChecklistResponseSchema,
  ReportDraftResponseSchema,
  ExportsResponseSchema,
  ExportPreflightSchema,
  PeriodIndicatorsResponseSchema,
  ProjectDetailSchema,
  ReportingPeriodsResponseSchema,
} from "@/lib/server/schemas";
import { SmartReviewSummarySchema, StoryContextResponseSchema } from "@/lib/actions/_schemas";
import { InlineError } from "@/components/feedback/PageState";
import { ReportWorkspace, type WorkspaceView } from "@/features/reporting/presentation/ReportWorkspace";
import { ReportEditor } from "@/features/report-editor/presentation/ReportEditor";
import { parseEditorUrlState } from "@/features/report-editor/application/url-state";
import { countStoryAnswers } from "@/features/reporting/application/reporting-steps";
import { isReportEditorV2Enabled } from "@/lib/shared/feature-flags";
import { formatDate } from "@/lib/shared/dates";
import { REPORT_TYPE_LABEL } from "@/lib/labels";

const WORKSPACE_VIEWS: readonly WorkspaceView[] = ["editor", "review", "check", "preview", "versions"];

export const dynamic = "force-dynamic";

type Query = { section?: string; view?: string; panel?: string; claim?: string; editor?: string };

export default async function ReportWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; periodId: string }>;
  searchParams: Promise<Query>;
}) {
  const { id: projectId, periodId } = await params;
  const query = await searchParams;
  const ctx = await requireSession();
  const v2 = isReportEditorV2Enabled(query.editor);

  const [readinessResult, checklistResult, draftResult, preflightResult, indicatorsResult, storyResult] = await Promise.all([
    gatewayRequest(`/v1/reporting-periods/${periodId}/readiness`, ReadinessSchema, ctx.token),
    gatewayRequest(`/v1/reporting-periods/${periodId}/checklist`, ChecklistResponseSchema, ctx.token),
    gatewayRequest(`/v1/reporting-periods/${periodId}/draft`, ReportDraftResponseSchema, ctx.token),
    gatewayRequest(`/v1/reporting-periods/${periodId}/export-preflight`, ExportPreflightSchema, ctx.token),
    gatewayRequest(`/v1/reporting-periods/${periodId}/indicators`, PeriodIndicatorsResponseSchema, ctx.token),
    gatewayRequest(`/v1/reporting-periods/${periodId}/story`, StoryContextResponseSchema, ctx.token),
  ]);

  if (!readinessResult.ok) {
    if (readinessResult.error.kind === "not_found") notFound();
    return (
      <div className="animate-fade-in">
        <InlineError title={readinessResult.error.message} referenceId={readinessResult.error.referenceId} />
      </div>
    );
  }

  const storyAnsweredCount = storyResult.ok ? countStoryAnswers(storyResult.value.storyContext) : 0;
  const unverifiedIndicatorCount = preflightResult.ok ? preflightResult.value.unverifiedIndicatorCount : 0;
  const sensitiveEvidenceCount = preflightResult.ok ? preflightResult.value.sensitiveCount : 0;
  const draftValue = draftResult.ok ? draftResult.value : null;

  if (v2) {
    const [smartReviewResult, projectResult, periodsResult] = await Promise.all([
      gatewayRequest(`/v1/reporting-periods/${periodId}/smart-review`, SmartReviewSummarySchema, ctx.token),
      gatewayRequest(`/v1/projects/${projectId}`, ProjectDetailSchema, ctx.token),
      gatewayRequest(`/v1/projects/${projectId}/reporting-periods`, ReportingPeriodsResponseSchema, ctx.token),
    ]);
    const period = periodsResult.ok ? periodsResult.value.items.find((p) => p.id === periodId) : undefined;
    const reportType = period ? (REPORT_TYPE_LABEL[period.reportType] ?? "Report") : "Report";
    const eyebrow = [
      projectResult.ok ? projectResult.value.title : null,
      period ? `${formatDate(period.startDate)} – ${formatDate(period.endDate)}` : null,
      period ? `due ${formatDate(period.deadline)}` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    return (
      <>
        {!draftResult.ok && <InlineError title={draftResult.error.message} />}
        {!checklistResult.ok && <InlineError title={checklistResult.error.message} />}
        <ReportEditor
          projectId={projectId}
          periodId={periodId}
          heading={{ eyebrow: eyebrow || reportType, title: reportType }}
          draft={draftValue?.draft ?? null}
          sections={[...(draftValue?.sections ?? [])].sort((a, b) => a.sectionOrder - b.sectionOrder)}
          artifacts={draftValue?.artifacts ?? {}}
          claims={draftValue?.claims ?? []}
          versions={draftValue?.versions ?? []}
          indicators={indicatorsResult.ok ? indicatorsResult.value.indicators : []}
          readinessPercent={readinessResult.value.overall}
          checklist={checklistResult.ok ? checklistResult.value.items : []}
          unverifiedIndicatorCount={unverifiedIndicatorCount}
          sensitiveEvidenceCount={sensitiveEvidenceCount}
          smartReviewItems={smartReviewResult.ok ? smartReviewResult.value.items : []}
          storyAnsweredCount={storyAnsweredCount}
          evidenceCount={preflightResult.ok ? preflightResult.value.evidence.length : 0}
          regeneratingSectionIds={draftValue?.regeneratingSectionIds ?? []}
          summaryStaleSectionIds={draftValue?.summaryStaleSectionIds ?? []}
          commentCounts={draftValue?.commentCounts ?? {}}
          inputsChangedSince={draftValue?.inputsChangedSince ?? null}
          capabilities={Array.from(ctx.capabilities)}
          initialUrlState={parseEditorUrlState(query)}
        />
      </>
    );
  }

  const exportsResult = await gatewayRequest(`/v1/projects/${projectId}/exports`, ExportsResponseSchema, ctx.token);
  const initialView = WORKSPACE_VIEWS.find((v) => v === query.view);

  return (
    <div className="animate-fade-in">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Report workspace</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">Reporting period {periodId.slice(0, 8)}</p>
        </div>
        <div className="flex gap-2">
          <Link className="btn-secondary" href={`/projects/${projectId}/reports/${periodId}/indicators`}>Enter indicator data</Link>
          <Link className="btn-secondary" href={`/projects/${projectId}/reports/${periodId}/export`}>Export center</Link>
          <Link className="btn-secondary" href={`/projects/${projectId}/reports`}>Back</Link>
        </div>
      </header>

      {!checklistResult.ok && <div className="mt-4"><InlineError title={checklistResult.error.message} /></div>}
      {!draftResult.ok && <div className="mt-4"><InlineError title={draftResult.error.message} /></div>}
      {!exportsResult.ok && <div className="mt-4"><InlineError title={exportsResult.error.message} /></div>}

      <ReportWorkspace
        projectId={projectId}
        periodId={periodId}
        draft={draftValue?.draft ?? null}
        sections={draftValue?.sections ?? []}
        artifacts={draftValue?.artifacts ?? {}}
        claims={draftValue?.claims ?? []}
        versions={draftValue?.versions ?? []}
        indicators={indicatorsResult.ok ? indicatorsResult.value.indicators : []}
        readiness={readinessResult.value}
        checklist={checklistResult.ok ? checklistResult.value.items : []}
        exports={exportsResult.ok ? exportsResult.value.items : []}
        unverifiedIndicatorCount={unverifiedIndicatorCount}
        sensitiveEvidenceCount={sensitiveEvidenceCount}
        capabilities={Array.from(ctx.capabilities)}
        storyAnsweredCount={storyAnsweredCount}
        initialSectionId={query.section}
        initialView={initialView}
      />
    </div>
  );
}
