import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { ExportPreflightSchema, ProjectDetailSchema, ReportingPeriodsResponseSchema } from "@/lib/server/schemas";
import { StoryContextResponseSchema } from "@/lib/actions/_schemas";
import { loadPeriodIndicatorsAction } from "@/lib/actions/indicators";
import { InlineError } from "@/components/feedback/PageState";
import { IndicatorEntryGrid } from "@/features/reporting/presentation/IndicatorEntryGrid";
import { StoryInputs } from "@/features/report-editor/presentation/inputs/StoryInputs";
import { ImportInputs } from "@/features/report-editor/presentation/inputs/ImportInputs";
import { countStoryAnswers } from "@/features/reporting/application/reporting-steps";
import { formatDate } from "@/lib/shared/dates";

export const dynamic = "force-dynamic";

const TABS = ["indicators", "story", "import"] as const;
type Tab = (typeof TABS)[number];

/**
 * Report inputs (Report Editor P5): everything a report is written from, on
 * one page with three tabs — Indicators, Story (autosave) and Import. The
 * report editor links here instead of holding input forms itself.
 */
export default async function ReportInputsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; periodId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id: projectId, periodId } = await params;
  const { tab: tabParam } = await searchParams;
  const tab: Tab = TABS.find((t) => t === tabParam) ?? "indicators";
  const ctx = await requireSession();

  const [indicatorsResult, storyResult, preflightResult, projectResult, periodsResult] = await Promise.all([
    loadPeriodIndicatorsAction(periodId),
    gatewayRequest(`/v1/reporting-periods/${periodId}/story`, StoryContextResponseSchema, ctx.token),
    gatewayRequest(`/v1/reporting-periods/${periodId}/export-preflight`, ExportPreflightSchema, ctx.token),
    gatewayRequest(`/v1/projects/${projectId}`, ProjectDetailSchema, ctx.token),
    gatewayRequest(`/v1/projects/${projectId}/reporting-periods`, ReportingPeriodsResponseSchema, ctx.token),
  ]);
  if (!indicatorsResult.ok && indicatorsResult.error.kind === "not_found") notFound();

  const period = periodsResult.ok ? periodsResult.value.items.find((p) => p.id === periodId) : undefined;
  const eyebrow = [projectResult.ok ? projectResult.value.title : null, period ? `${formatDate(period.startDate)} – ${formatDate(period.endDate)}` : null]
    .filter(Boolean)
    .join(" · ");
  const reportHref = `/projects/${projectId}/reports/${periodId}`;
  const indicators = indicatorsResult.ok ? indicatorsResult.value.indicators : [];
  const verified = indicators.filter((i) => i.update?.verificationStatus === "VERIFIED").length;
  const story = storyResult.ok ? (storyResult.value.storyContext ?? {}) : {};
  const evidenceCount = preflightResult.ok ? preflightResult.value.evidence.length : 0;
  const canImport = ctx.capabilities.has("indicator.update");

  const tabs: Array<{ id: Tab; label: string; count: string }> = [
    { id: "indicators", label: "Indicators", count: indicators.length > 0 ? `${verified}/${indicators.length} verified` : "none yet" },
    { id: "story", label: "Story", count: `${countStoryAnswers(story)}/5 answered` },
    { id: "import", label: "Import", count: `${evidenceCount} evidence file${evidenceCount === 1 ? "" : "s"}` },
  ];

  return (
    <div className="animate-fade-in space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{eyebrow}</p>}
          <h1 className="mt-1 text-xl font-semibold tracking-tight">Report inputs</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">What the AI writes the report from. Changes here are picked up when you re-check or regenerate.</p>
        </div>
        <Link className="btn-secondary" href={reportHref}>
          Back to the report
        </Link>
      </header>

      <nav aria-label="Report inputs" className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-white/10">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={`?tab=${t.id}`}
            aria-current={tab === t.id ? "page" : undefined}
            className={`-mb-px flex min-h-[44px] items-center gap-2 whitespace-nowrap border-b-2 px-3 text-sm transition ${
              tab === t.id
                ? "border-brand-600 font-medium text-brand-700 dark:border-brand-400 dark:text-brand-300"
                : "border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            }`}
          >
            {t.label}
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{t.count}</span>
          </Link>
        ))}
      </nav>

      {tab === "indicators" &&
        (indicatorsResult.ok ? (
          <IndicatorEntryGrid
            projectId={projectId}
            periodId={periodId}
            rows={indicatorsResult.value.indicators}
            canEdit={ctx.capabilities.has("indicator.update")}
            canVerify={ctx.capabilities.has("indicator.verify")}
          />
        ) : (
          <InlineError title={indicatorsResult.error.message} referenceId={indicatorsResult.error.referenceId} />
        ))}

      {tab === "story" &&
        (storyResult.ok ? (
          <StoryInputs periodId={periodId} initialStory={story} canEdit={ctx.capabilities.has("reporting.edit")} />
        ) : (
          <InlineError title={storyResult.error.message} />
        ))}

      {tab === "import" &&
        (canImport ? (
          <ImportInputs projectId={projectId} periodId={periodId} evidenceCount={evidenceCount} />
        ) : (
          <p className="card text-sm text-slate-600 dark:text-slate-300">Importing indicator values needs permission to update indicator data.</p>
        ))}
    </div>
  );
}
