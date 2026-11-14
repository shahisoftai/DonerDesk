import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { ExportPreflightSchema, PeriodIndicatorsResponseSchema, ReportDraftResponseSchema } from "@/lib/server/schemas";
import { StoryContextResponseSchema } from "@/lib/actions/_schemas";
import { countStoryAnswers } from "../application/reporting-steps";
import { ReportStepper } from "./ReportStepper";

/** The report stepper on a stage page (inputs, indicators, export): reads what the stages need; a failed read shows nothing. */
export async function PeriodStepper({ projectId, periodId }: { projectId: string; periodId: string }) {
  const ctx = await requireSession();
  const [indicators, preflight, story, draft] = await Promise.all([
    gatewayRequest(`/v1/reporting-periods/${periodId}/indicators`, PeriodIndicatorsResponseSchema, ctx.token),
    gatewayRequest(`/v1/reporting-periods/${periodId}/export-preflight`, ExportPreflightSchema, ctx.token),
    gatewayRequest(`/v1/reporting-periods/${periodId}/story`, StoryContextResponseSchema, ctx.token),
    gatewayRequest(`/v1/reporting-periods/${periodId}/draft`, ReportDraftResponseSchema, ctx.token),
  ]);
  if (!indicators.ok) return null;
  return (
    <div className="mb-6">
      <ReportStepper
        base={`/projects/${projectId}/reports/${periodId}`}
        input={{
          indicatorCount: indicators.value.indicators.length,
          unverifiedIndicatorCount: preflight.ok ? preflight.value.unverifiedIndicatorCount : 0,
          storyAnswered: story.ok ? countStoryAnswers(story.value.storyContext) : 0,
          hasDraft: draft.ok && Boolean(draft.value.draft),
          draftStatus: draft.ok ? draft.value.draft?.status ?? null : null,
        }}
      />
    </div>
  );
}
