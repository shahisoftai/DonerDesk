import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import {
  TemplatesResponseSchema,
  ProjectDetailSchema,
  ReportingPeriodsResponseSchema,
  ReportingProfileResponseSchema,
  ActivitiesResponseSchema,
  type ProjectReadiness,
} from "@/lib/server/schemas";
import { InlineError } from "@/components/feedback/PageState";
import { loadProjectSetupAction } from "@/lib/actions/setup";
import { NewReportingPeriodForm } from "@/features/reporting/presentation/NewReportingPeriodForm";

export const dynamic = "force-dynamic";

export default async function NewReportingPeriodPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await requireSession();
  const [templatesResult, setupResult, projectResult, periodsResult, profileResult, activitiesResult] = await Promise.all([
    gatewayRequest(`/v1/projects/${resolvedParams.id}/templates`, TemplatesResponseSchema, ctx.token),
    loadProjectSetupAction(resolvedParams.id),
    gatewayRequest(`/v1/projects/${resolvedParams.id}`, ProjectDetailSchema, ctx.token),
    gatewayRequest(`/v1/projects/${resolvedParams.id}/reporting-periods`, ReportingPeriodsResponseSchema, ctx.token),
    gatewayRequest(`/v1/projects/${resolvedParams.id}/reporting-profile`, ReportingProfileResponseSchema, ctx.token),
    gatewayRequest(`/v1/projects/${resolvedParams.id}/activities`, ActivitiesResponseSchema, ctx.token),
  ]);

  const readiness: ProjectReadiness | null = setupResult.ok ? setupResult.value.setup.readiness : null;

  return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-semibold tracking-tight">New reporting period</h1>
      {!templatesResult.ok && <div className="mt-4"><InlineError title={templatesResult.error.message} /></div>}
      <NewReportingPeriodForm
        projectId={resolvedParams.id}
        templates={templatesResult.ok ? templatesResult.value.items.map((t) => ({
                id: t.id,
                templateName: t.templateName,
                reportType: t.reportType,
                status: t.status,
                deadlineOffsetDays: t.requirements.submission.deadlineOffsetDays,
                deadlineRule: t.requirements.submission.deadlineRule,
              })) : []}
        readiness={readiness}
        activities={activitiesResult.ok ? activitiesResult.value.items.map((a) => ({ id: a.id, title: a.activityTitle, date: a.activityDate, location: a.location })) : []}
        projectBounds={projectResult.ok ? { startDate: projectResult.value.startDate, endDate: projectResult.value.endDate } : null}
        situationHistory={periodsResult.ok ? periodsResult.value.items.filter((p) => p.reportType === "SITUATION").map((p) => ({ eventName: p.scope?.eventName, endDate: p.endDate })) : []}
        existingPeriodEnds={periodsResult.ok ? periodsResult.value.items.map((p) => p.endDate) : []}
        profileDeadlineOffsetDays={profileResult.ok ? (profileResult.value.profile?.deadlineOffsetDays ?? undefined) : undefined}
      />
    </div>
  );
}
