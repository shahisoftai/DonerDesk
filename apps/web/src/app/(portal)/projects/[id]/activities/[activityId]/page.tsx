import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { ActivityDetailSchema, EvidenceResponseSchema, EvidenceSupportResponseSchema, LogframeResponseSchema } from "@/lib/server/schemas";
import { hasCapability } from "@/lib/server/auth-context";
import { InlineError } from "@/components/feedback/PageState";
import { Badge } from "@/components/data/Badge";
import { activityStatusTone } from "@/lib/shared/tone";
import { ACTIVITY_STATUS_LABEL } from "@/lib/labels";
import { formatDate } from "@/lib/shared/dates";
import { ActivityPolishPanel } from "@/features/activities/presentation/ActivityPolishPanel";
import { ActivityReopenPanel } from "@/features/activities/presentation/ActivityReopenPanel";
import { ActivityReviewPanel } from "@/features/activities/presentation/ActivityReviewPanel";
import { EvidenceSupportPanel } from "@/features/evidence/presentation/EvidenceSupportPanel";
import { ActivityResubmitPanel } from "@/features/activities/presentation/ActivityResubmitPanel";
import { ActivityLifecyclePanel } from "@/features/activities/presentation/ActivityLifecyclePanel";
import { splitReviewerNotes, canApplyActivityAction } from "@donordesk/domain/contexts/activities/activity-transitions.js";
import { activityOptionLabel } from "@/lib/shared/option-labels";
import { ActivitiesResponseSchema } from "@/lib/server/schemas";
import { AskPanel } from "@/features/tasks/presentation/AskPanel";
import { loadProjectPeople } from "@/features/tasks/application/project-people";
import { decodeSessionPayload } from "@/lib/shared/jwt-session";
import { suggestTaskDueDate } from "@donordesk/domain/contexts/tasks/index.js";
import { FileNeedsSchema } from "@/lib/server/schemas";
import { stillNeededLine } from "@/features/workplan/domain/file-needs-view";
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

  const support = await gatewayRequest(`/v1/activities/${resolvedParams.activityId}/evidence-support`, EvidenceSupportResponseSchema, ctx.token);

  const status = activity.status as Parameters<typeof canApplyActivityAction>[0];
  const canReview = hasCapability(ctx, "activity.review") && activity.status === "SUBMITTED";
  // The reviewer's notes live at the end of the stored summary; show them beside the text, not inside it.
  const { summary: cleanSummary, notes: reviewerNotes } = splitReviewerNotes(activity.summary);
  const canReopen = hasCapability(ctx, "activity.review") && activity.status === "ACCEPTED";
  const canResubmit = hasCapability(ctx, "activity.create") && activity.status === "NEEDS_REVISION";
  const canWithdraw = hasCapability(ctx, "activity.review") && (canApplyActivityAction(status, "WITHDRAW") || canApplyActivityAction(status, "RESTORE"));
  const siblingsResult = canWithdraw
    ? await gatewayRequest(`/v1/projects/${resolvedParams.id}/activities`, ActivitiesResponseSchema, ctx.token)
    : null;
  const siblings = siblingsResult?.ok ? siblingsResult.value.items : [];
  const replacements = siblings.filter((a) => a.id !== activity.id && a.status !== "WITHDRAWN").map((a) => ({ id: a.id, label: `${activityOptionLabel(a)} · ${ACTIVITY_STATUS_LABEL[a.status] ?? a.status}` }));
  const replacedBy = activity.supersededById ? siblings.find((a) => a.id === activity.supersededById) : undefined;
  const logframeResult = canResubmit ? await gatewayRequest(`/v1/projects/${resolvedParams.id}/logframe`, LogframeResponseSchema, ctx.token) : null;
  const logframeActivities = logframeResult?.ok
    ? logframeResult.value.items.filter((n) => n.level === "ACTIVITY").map((n) => ({ id: n.id, label: `${n.code ? `${n.code} — ` : ""}${n.title}` }))
    : [];
  // Files the planned activity asked for that this one does not have yet: said once, never blocking.
  const needs = activity.plannedActivityId ? await gatewayRequest(`/v1/activities/${activity.id}/file-needs`, FileNeedsSchema, ctx.token) : null;
  const stillNeeded = needs?.ok ? needs.value.stillNeeded : [];
  const canAsk = hasCapability(ctx, "task.assign") && activity.status === "SUBMITTED";
  const canAskFile = hasCapability(ctx, "task.assign") && stillNeeded.length > 0 && activity.status !== "WITHDRAWN";
  const me = decodeSessionPayload(ctx.token)?.sub ?? "";
  const askPeople = canAsk ? await loadProjectPeople(ctx.token, resolvedParams.id, me) : [];
  const canPolish = hasCapability(ctx, "activity.create");
  const canManageEvidence = hasCapability(ctx, "activity.create");
  const demoMode = process.env.NODE_ENV !== "production";

  return (
    <div className="animate-fade-in space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{activity.activityTitle}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {formatDate(activity.activityDate)}{activity.activityEndDate && activity.activityEndDate.slice(0, 10) !== activity.activityDate.slice(0, 10) ? ` – ${formatDate(activity.activityEndDate)}` : ""}
            {activity.location ? ` · ${activity.location}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canManageEvidence && (
            <Link className="btn-secondary" href={`/projects/${activity.projectId}/evidence/new?activityId=${activity.id}`}>
              Add evidence
            </Link>
          )}
          <Badge tone={activityStatusTone(activity.status)}>
            {ACTIVITY_STATUS_LABEL[activity.status] ?? activity.status.replace(/_/g, " ")}
          </Badge>
        </div>
      </header>

      {stillNeeded.length > 0 && <p role="status" className="text-sm font-medium text-amber-700 dark:text-amber-400">{stillNeededLine(stillNeeded)}</p>}
      {canAskFile && (
        <AskPanel projectId={resolvedParams.id} kind="PROVIDE_EVIDENCE" buttonLabel="Ask for a file" subject={{ type: "activityUpdate", id: activity.id }} people={askPeople.length ? askPeople : await loadProjectPeople(ctx.token, resolvedParams.id, me)} leadId={activity.submittedById} suggestedDue={suggestTaskDueDate("PROVIDE_EVIDENCE", { today: new Date().toISOString().slice(0, 10) })} />
      )}
      {canAsk && (
        <AskPanel
          projectId={resolvedParams.id}
          kind="REVIEW_RECORD"
          buttonLabel="Ask for a review"
          subject={{ type: "activityUpdate", id: activity.id }}
          people={askPeople}
          suggestedDue={suggestTaskDueDate("REVIEW_RECORD", { today: new Date().toISOString().slice(0, 10) })}
        />
      )}

      <section className="card" aria-label="Activity summary">
        <h2 className="text-sm font-medium text-slate-700 dark:text-slate-200">Summary</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{cleanSummary}</p>
        {reviewerNotes.length > 0 && (
          <div role="note" className="mt-3 rounded-lg border border-warning-500/30 bg-warning-500/5 p-3 text-sm text-slate-700 dark:text-slate-200">
            <p className="font-medium">Reviewer note</p>
            {reviewerNotes.map((n, i) => <p key={i} className="mt-1 whitespace-pre-wrap">{n}</p>)}
          </div>
        )}
      </section>

      {activity.achievements && (
        <section className="card" aria-label="Achievements">
          <h2 className="text-sm font-medium text-slate-700 dark:text-slate-200">Achievements</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{activity.achievements}</p>
        </section>
      )}
      {activity.challenges && (
        <section className="card" aria-label="Challenges">
          <h2 className="text-sm font-medium text-slate-700 dark:text-slate-200">Challenges</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{activity.challenges}</p>
        </section>
      )}
      {activity.lessonsLearned && (
        <section className="card" aria-label="Lessons learned">
          <h2 className="text-sm font-medium text-slate-700 dark:text-slate-200">Lessons learned</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{activity.lessonsLearned}</p>
        </section>
      )}
      {activity.nextSteps && (
        <section className="card" aria-label="Next steps">
          <h2 className="text-sm font-medium text-slate-700 dark:text-slate-200">Next steps</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{activity.nextSteps}</p>
        </section>
      )}

      {support.ok && <EvidenceSupportPanel support={support.value} projectId={resolvedParams.id} />}

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
          <h2 className="text-sm font-medium text-slate-700 dark:text-slate-200">Attached evidence</h2>
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
        <h2 className="text-sm font-medium text-slate-700 dark:text-slate-200">Participants</h2>
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

      {canResubmit && (
        <ActivityResubmitPanel
          activityId={activity.id}
          notes={reviewerNotes}
          initial={{ summary: cleanSummary, achievements: activity.achievements ?? "", challenges: activity.challenges ?? "", lessonsLearned: activity.lessonsLearned ?? "", nextSteps: activity.nextSteps ?? "", location: activity.location ?? "", logframeActivityId: activity.logframeActivityId ?? "" }}
          logframeActivities={logframeActivities}
        />
      )}

      {canReview && <ActivityReviewPanel activityId={activity.id} stillNeeded={stillNeeded} />}
      {canReopen && <ActivityReopenPanel activityId={activity.id} />}

      {canWithdraw && (
        <ActivityLifecyclePanel
          activityId={activity.id}
          withdrawn={activity.status === "WITHDRAWN"}
          supersededByLabel={replacedBy ? activityOptionLabel(replacedBy) : undefined}
          canWithdraw={canWithdraw}
          replacements={replacements}
        />
      )}

      <div className="flex gap-3">
        <Link className="btn-secondary" href={`/projects/${activity.projectId}/activities`}>
          Back to activities
        </Link>
      </div>
    </div>
  );
}
