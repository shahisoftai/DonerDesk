import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { ActivitiesResponseSchema, LogframeResponseSchema, OrganizationSchema, ReportingPeriodsResponseSchema } from "@/lib/server/schemas";
import { activityOptionLabel, periodOptionLabel, recentFirst } from "@/lib/shared/option-labels";
import { EvidenceUploadQueue } from "@/features/evidence/presentation/EvidenceUploadQueue";

export const dynamic = "force-dynamic";

export default async function NewEvidencePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ activityId?: string }> }) {
  const resolvedParams = await params;
  const { activityId: initialActivityId } = await searchParams;
  const ctx = await requireSession();
  const [orgResult, activitiesResult, logframeResult, periodsResult] = await Promise.all([
    gatewayRequest("/v1/organization", OrganizationSchema, ctx.token),
    gatewayRequest(`/v1/projects/${resolvedParams.id}/activities`, ActivitiesResponseSchema, ctx.token),
    gatewayRequest(`/v1/projects/${resolvedParams.id}/logframe`, LogframeResponseSchema, ctx.token),
    gatewayRequest(`/v1/projects/${resolvedParams.id}/reporting-periods`, ReportingPeriodsResponseSchema, ctx.token),
  ]);
  const storageProvider = orgResult.ok ? orgResult.value.storageProvider : "LOCAL";
  const driveMode = storageProvider === "GOOGLE_DRIVE";
  const periodLabelById = new Map((periodsResult.ok ? periodsResult.value.items : []).map((p) => [p.id, periodOptionLabel(p)]));

  return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-semibold tracking-tight">Upload evidence</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        {driveMode
          ? "Add one or more files — each is saved into your project's Google Drive folder. You can also link a file that is already in your Drive."
          : "Add one or more files. Each file is uploaded separately; AI tagging runs after upload where enabled."}
      </p>
      <EvidenceUploadQueue
        projectId={resolvedParams.id}
        storageProvider={storageProvider}
        initialActivityId={initialActivityId}
        activities={activitiesResult.ok ? recentFirst(activitiesResult.value.items, (a) => a.activityDate).map((a) => ({ id: a.id, label: activityOptionLabel(a), periodLabel: a.reportingPeriodId ? periodLabelById.get(a.reportingPeriodId) : undefined })) : []}
        indicators={logframeResult.ok ? logframeResult.value.indicators.map((i) => ({ id: i.id, label: `${i.code} — ${i.name}` })) : []}
        periods={periodsResult.ok ? recentFirst(periodsResult.value.items, (p) => p.startDate).map((p) => ({ id: p.id, label: periodOptionLabel(p) })) : []}
      />
    </div>
  );
}
