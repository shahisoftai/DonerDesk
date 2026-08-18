import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { ActivityDetailSchema, EvidenceResponseSchema } from "@/lib/server/schemas";
import { hasCapability } from "@/lib/server/auth-context";
import { InlineError } from "@/components/feedback/PageState";
import { Badge } from "@/components/data/Badge";
import { activityStatusTone } from "@/lib/shared/tone";
import { ACTIVITY_STATUS_LABEL } from "@/lib/labels";
import { formatDate } from "@/lib/shared/dates";
import { ActivityPolishPanel } from "@/features/activities/presentation/ActivityPolishPanel";
import { ActivityReviewPanel } from "@/features/activities/presentation/ActivityReviewPanel";
import { ActivityEvidencePanel } from "@/features/activities/presentation/ActivityEvidencePanel";

export const dynamic = "force-dynamic";

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ id: string; activityId: string }>;
}) {
  const resolvedParams = await params;
  const ctx = await requireSession();
  const result = await gatewayRequest(
    `/v1/activities/${resolvedParams.activityId}`,
    ActivityDetailSchema,
    ctx.token,
  );

  if (!result.ok) {
    if (result.error.kind === "not_found") notFound();
    return <InlineError title={result.error.message} referenceId={result.error.referenceId} />;
  }
  const activity = result.value;
  const attachedEvidenceIds = activity.attachedEvidenceIds ?? [];

  const evidenceResult = await gatewayRequest("/v1/evidence/search", EvidenceResponseSchema, ctx.token, {
    method: "POST",
    body: { projectId: resolvedParams.id, pageSize: 100 },
  });
  const availableEvidence = evidenceResult.ok
    ? evidenceResult.value.items.map((e: { id: string; title: string }) => ({
        id: e.id,
        label: e.title,
        checked: attachedEvidenceIds.includes(e.id),
      }))
    : [];

  const canReview = hasCapability(ctx, "activity.review") && activity.status === "SUBMITTED";
  const canPolish = hasCapability(ctx, "activity.create");
  const canManageEvidence = hasCapability(ctx, "activity.create");
  const demoMode = process.env.NODE_ENV !== "production";

  return (
    <div className="animate-fade-in space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{activity.activityTitle}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {formatDate(activity.activityDate)}
            {activity.location ? ` · ${activity.location}` : ""}
          </p>
        </div>
        <Badge tone={activityStatusTone(activity.status)}>
          {ACTIVITY_STATUS_LABEL[activity.status] ?? activity.status.replace(/_/g, " ")}
        </Badge>
      </header>

      <section className="card" aria-label="Activity summary">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Summary</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{activity.summary}</p>
      </section>

      {activity.achievements && (
        <section className="card" aria-label="Achievements">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Achievements</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{activity.achievements}</p>
        </section>
      )}
      {activity.challenges && (
        <section className="card" aria-label="Challenges">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Challenges</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{activity.challenges}</p>
        </section>
      )}
      {activity.lessonsLearned && (
        <section className="card" aria-label="Lessons learned">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Lessons learned</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{activity.lessonsLearned}</p>
        </section>
      )}
      {activity.nextSteps && (
        <section className="card" aria-label="Next steps">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Next steps</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{activity.nextSteps}</p>
        </section>
      )}

      {canManageEvidence && availableEvidence.length > 0 && (
        <ActivityEvidencePanel
          activityId={activity.id}
          projectId={activity.projectId}
          attachedEvidenceIds={attachedEvidenceIds}
          availableEvidence={availableEvidence}
        />
      )}

      {!canManageEvidence && attachedEvidenceIds.length > 0 && (
        <section className="card" aria-label="Attached evidence">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Attached evidence</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {attachedEvidenceIds.map((id) => (
              <li key={id}>
                <Link
                  href={`/projects/${activity.projectId}/evidence/${id}`}
                  className="text-brand-600 hover:underline dark:text-brand-400"
                >
                  Evidence record
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="card">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Participants</h2>
        <dl className="mt-2 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-slate-500 dark:text-slate-400">Total</dt>
            <dd className="font-medium">{activity.participantsTotal ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 dark:text-slate-400">Male</dt>
            <dd className="font-medium">{activity.participantsMale ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 dark:text-slate-400">Female</dt>
            <dd className="font-medium">{activity.participantsFemale ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 dark:text-slate-400">Children</dt>
            <dd className="font-medium">{activity.participantsChildren ?? "—"}</dd>
          </div>
        </dl>
      </div>

      {canPolish && (
        <ActivityPolishPanel
          activityId={activity.id}
          originalSummary={activity.summary}
          existingNarrative={activity.polishedNarrative}
          demoMode={demoMode}
        />
      )}

      {canReview && <ActivityReviewPanel activityId={activity.id} />}

      <div className="flex gap-3">
        <Link className="btn-secondary" href={`/projects/${activity.projectId}/activities`}>
          Back to activities
        </Link>
      </div>
    </div>
  );
}
