import Link from "next/link";
import { CommentsDisclosure } from "@/features/comments/presentation/CommentsDisclosure";
import { notFound } from "next/navigation";
import { countOf } from "@donordesk/domain/core/plural.js";
import { canActOnPlanItem, formatShortDate, WORKPLAN_COPY } from "@donordesk/domain/contexts/workplan/index.js";
import type { Role } from "@/lib/shared/capabilities";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { ActivityPeopleSchema, LogframeResponseSchema, PlanItemBudgetSchema, PlanItemFieldsSchema, PlanRevisionsResponseSchema, ProgressResponseSchema, WorkPlanResponseSchema } from "@/lib/server/schemas";
import { loadPlanPageData } from "@/features/workplan/application/plan-page-data";
import { showsButton } from "@/features/workplan/domain/role-surfaces";
import { describeChanges } from "@/features/workplan/domain/plan-history-view";
import { AskPanel } from "@/features/tasks/presentation/AskPanel";
import { suggestTaskDueDate } from "@donordesk/domain/contexts/tasks/index.js";
import { RequiredFilesEditor } from "@/features/workplan/presentation/RequiredFilesEditor";
import { DependencyEditor } from "@/features/workplan/presentation/DependencyEditor";
import { LogframeLinkEditor } from "@/features/workplan/presentation/LogframeLinkEditor";
import { PlanItemFields } from "@/features/workplan/presentation/PlanItemFields";
import { PlanItemBudget } from "@/features/workplan/presentation/PlanItemBudget";
import { ProgressLog } from "@/features/workplan/presentation/ProgressLog";
import { ActivityPeople } from "@/features/workplan/presentation/ActivityPeople";
import { MarkDoneButton } from "@/features/workplan/presentation/MarkDoneButton";
import { dependencyOptions } from "@/features/workplan/domain/dependency-view";
import { PlanItemMenu } from "@/features/workplan/presentation/PlanItemMenu";
import { PlanStatusControl } from "@/features/workplan/presentation/PlanStatusControl";
import { Badge } from "@/components/data/Badge";
import { InlineError } from "@/components/feedback/PageState";

export const dynamic = "force-dynamic";

const SIGNAL_TONE = { ON_TIME: "success", LATE: "danger", DONE: "neutral", CANCELLED: "neutral" } as const;

export default async function PlannedActivityPage({ params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id, itemId } = await params;
  const data = await loadPlanPageData(id);
  const [plan, history] = await Promise.all([
    gatewayRequest(`/v1/projects/${id}/work-plan`, WorkPlanResponseSchema, data.ctx.token),
    gatewayRequest(`/v1/work-plan/${itemId}/revisions`, PlanRevisionsResponseSchema, data.ctx.token),
  ]);
  if (!plan.ok) return <InlineError title={plan.error.message} referenceId={plan.error.referenceId} />;
  const fieldValues = await gatewayRequest(`/v1/work-plan/${itemId}/fields`, PlanItemFieldsSchema, data.ctx.token);
  const budget = await gatewayRequest(`/v1/work-plan/${itemId}/budget`, PlanItemBudgetSchema, data.ctx.token);
  const progress = await gatewayRequest(`/v1/work-plan/${itemId}/progress`, ProgressResponseSchema, data.ctx.token);
  const logframe = await gatewayRequest(`/v1/projects/${id}/logframe`, LogframeResponseSchema, data.ctx.token);
  const activityPeople = await gatewayRequest(`/v1/work-plan/${itemId}/people`, ActivityPeopleSchema, data.ctx.token);
  const row = plan.value.items.find((r) => r.id === itemId);
  if (!row) notFound();

  const people = { ownerUserId: row.ownerUserId, supportUserIds: row.supportUserIds };
  const actor = { userId: data.userId, role: (data.ctx.role ?? "VIEWER") as Role };
  const canChange = canActOnPlanItem(actor, people, "CHANGE_STATUS");
  const lead = !row.ownerUserId ? "No lead yet" : row.ownerUserId === data.userId ? "You" : data.names[row.ownerUserId] ?? "A team member";
  const dates = row.plannedStart === row.plannedEnd ? formatShortDate(row.plannedStart, data.today) : `${formatShortDate(row.plannedStart, data.today)} to ${formatShortDate(row.plannedEnd, data.today)}`;
  const moved = row.originalStart && row.originalEnd && (row.originalStart !== row.plannedStart || row.originalEnd !== row.plannedEnd);
  const canAddCompleted = showsButton(data.ctx.role, data.ctx.capabilities, "ADD_COMPLETED") && row.status !== "CANCELLED";

  return (
    <div className="animate-fade-in space-y-6">
      <p className="text-sm"><Link className="text-brand-700 hover:underline dark:text-brand-300" href={`/projects/${id}/activities?view=planned`}>Planned activities</Link></p>
      <header className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight">{row.title}</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {dates}{moved && <> · {WORKPLAN_COPY.movedFrom} {formatShortDate(row.originalStart!, data.today)}</>} · {lead}
          {row.location && <> · {row.location}</>}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={SIGNAL_TONE[row.signal]} title={row.signalReason}>{row.signalLabel}</Badge>
          {row.signalReason && <span className="text-xs text-slate-500">{row.signalReason}</span>}
          {canChange && (row.status === "PLANNED" || row.status === "IN_PROGRESS") && <MarkDoneButton itemId={row.id} title={row.title} today={data.today} size="md" />}
          <PlanStatusControl itemId={row.id} status={row.status} suggested={row.suggestedStatus} canChange={canChange} />
        </div>
        <PlanItemMenu
          itemId={row.id}
          status={row.status}
          plannedStart={row.plannedStart}
          plannedEnd={row.plannedEnd}
          inSeries={Boolean(row.seriesId)}
          reasonRequired={row.reasonRequired}
          {...(row.ownerUserId ? { ownerUserId: row.ownerUserId } : {})}
          leads={data.leads}
          canMove={canActOnPlanItem(actor, people, "MOVE")}
          canAssign={canActOnPlanItem(actor, people, "ASSIGN")}
          canCancel={canActOnPlanItem(actor, people, "CANCEL")}
        />
        {data.ctx.capabilities.has("task.assign") && row.status !== "CANCELLED" && row.status !== "DONE" && (
          <div className="flex flex-wrap gap-2">
            {row.completedActivities === 0 && (
              <AskPanel projectId={id} kind="RECORD_ACTIVITY" buttonLabel="Ask for completed activity" subject={{ type: "plannedActivity", id: row.id }} people={data.people} leadId={row.ownerUserId} suggestedDue={suggestTaskDueDate("RECORD_ACTIVITY", { today: data.today, subjectEnd: row.plannedEnd })} />
            )}
            <AskPanel projectId={id} kind="PROVIDE_EVIDENCE" buttonLabel="Ask for a file" subject={{ type: "plannedActivity", id: row.id }} people={data.people} leadId={row.ownerUserId} suggestedDue={suggestTaskDueDate("PROVIDE_EVIDENCE", { today: data.today, subjectEnd: row.plannedEnd })} />
          </div>
        )}
        {canAddCompleted && (
          <p><Link className="btn" href={`/projects/${id}/activities/new?planned=${row.id}`}>{WORKPLAN_COPY.addCompleted}</Link></p>
        )}
      </header>

      <RequiredFilesEditor itemId={row.id} title={row.title} required={row.requiredFiles} stillNeeded={row.stillNeeded} canEdit={canActOnPlanItem(actor, people, "EDIT") && row.status !== "CANCELLED"} />
      {logframe.ok && <LogframeLinkEditor itemId={row.id} current={row.logframeActivityId} options={logframe.value.items.filter((i) => i.level === "ACTIVITY").map((i) => ({ id: i.id, label: `${i.code ?? ""} ${i.title}`.trim() }))} canEdit={canActOnPlanItem(actor, people, "EDIT") && row.status !== "CANCELLED"} />}

      <DependencyEditor itemId={row.id} after={row.comesAfter} before={row.comesBefore} options={dependencyOptions(row.id, plan.value.items)} canEdit={canActOnPlanItem(actor, people, "EDIT") && row.status !== "CANCELLED"} />

      {fieldValues.ok && <PlanItemFields itemId={row.id} projectId={id} fields={fieldValues.value.fields} values={fieldValues.value.values} canEdit={canActOnPlanItem(actor, people, "EDIT_NOTES") && row.status !== "CANCELLED"} canDefine={canActOnPlanItem(actor, people, "EDIT")} />}
      {progress.ok && <ProgressLog itemId={row.id} title={row.title} today={data.today} activity={{ start: row.plannedStart, end: row.plannedEnd }} data={progress.value} indicators={logframe.ok ? logframe.value.indicators.map((i) => ({ id: i.id, code: i.code, name: i.name })) : []} canEdit={canActOnPlanItem(actor, people, "EDIT_NOTES") && row.status !== "CANCELLED"} uniquePeople={activityPeople.ok ? activityPeople.value.counts.total : null} />}
      {activityPeople.ok && <ActivityPeople itemId={row.id} data={activityPeople.value} canEdit={canActOnPlanItem(actor, people, "EDIT_NOTES") && row.status !== "CANCELLED"} />}

      {budget.ok && <PlanItemBudget itemId={row.id} lines={budget.value.items} canManage={canActOnPlanItem(actor, people, "EDIT")} canSpend={canActOnPlanItem(actor, people, "EDIT_NOTES") && row.status !== "CANCELLED"} today={data.today} />}

      <section aria-labelledby="done-title">
        <h2 id="done-title" className="text-sm font-semibold">Completed activities</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          {row.completedActivities === 0 ? "None yet." : <>{countOf(row.completedActivities, "completed activity", "completed activities")}{row.targetCount ? ` · ${row.deliveredCount} of ${row.targetCount} sessions accepted` : ""}.</>}
        </p>
      </section>

      <section aria-labelledby="changes-title">
        <h2 id="changes-title" className="text-sm font-semibold">Changes</h2>
        {!history.ok || history.value.items.length === 0 ? (
          <p className="mt-1 text-sm text-slate-500">No changes since it was planned.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {[...history.value.items].reverse().map((r) => (
              <li key={r.id} className="rounded-lg border border-slate-200 p-2 dark:border-white/10">
                <span className="text-xs text-slate-500">{formatShortDate(r.changedAt.slice(0, 10), data.today)}</span>
                <p>{describeChanges(r.changes, { today: data.today, userId: data.userId, names: data.names })}</p>
                {r.reason && <p className="text-slate-600 dark:text-slate-300">{WORKPLAN_COPY.whyMoved} {r.reason}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
      <CommentsDisclosure entityType="planned_activity" entityId={row.id} />
    </div>
  );
}
