import Link from "next/link";
import { Panel } from "@/features/dashboard/presentation/HomeParts";
import { Badge } from "@/components/data/Badge";
import { listMyFacilityAssignmentsAction } from "@/lib/actions/assessments";
import { assignmentHref, openAssignments, summariseAssignments } from "../domain/my-assignments";
import { formatDate } from "@/lib/shared/dates";

const SHOWN = 6;

/**
 * "Given to you" on a field worker's Home: the facilities (or places) assigned to them for a form, the next ones first, one tap to open the
 * form, and the one card that sets the phone up to work without signal. It renders nothing when nothing is assigned, so a project with no
 * facility forms looks as it did before. It reads one endpoint and decides nothing: the order and counts come from the domain module.
 */
export async function MyFacilitiesPanel() {
  const r = await listMyFacilityAssignmentsAction();
  if (!r.ok || r.value.length === 0) return null;
  const queue = openAssignments(r.value);
  const sum = summariseAssignments(r.value);
  return (
    <Panel title="Given to you">
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
        {sum.toDo + sum.started === 0 ? "All your facilities are done." : `${sum.toDo + sum.started} to visit${sum.started ? `, ${sum.started} started` : ""}.`}
        {sum.done > 0 && ` ${sum.done} done.`}
      </p>
      <ul className="space-y-2">
        {queue.slice(0, SHOWN).map((a) => (
          <li key={a.id}>
            <Link href={assignmentHref(a)} prefetch={false} className="card flex min-h-[56px] items-center justify-between gap-3 transition hover:border-brand-400/40">
              <span className="min-w-0">
                <span className="block break-words text-sm font-semibold">{a.placeName}</span>
                <span className="block break-words text-xs text-slate-500 dark:text-slate-400">{a.formName ?? "Form"}{a.dueOn ? ` · due ${formatDate(a.dueOn)}` : ""}</span>
              </span>
              <Badge tone={a.status === "IN_PROGRESS" ? "warning" : "info"}>{a.status === "IN_PROGRESS" ? "Started" : "To do"}</Badge>
            </Link>
          </li>
        ))}
      </ul>
      {queue.length > SHOWN && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">and {queue.length - SHOWN} more in the form.</p>}
      <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">
        No signal where you work? Open <a className="link" href="/field">the field app</a> once while online and tap Download or refresh.
      </p>
    </Panel>
  );
}
