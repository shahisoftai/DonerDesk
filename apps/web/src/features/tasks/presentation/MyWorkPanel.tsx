"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { countOf } from "@donordesk/domain/core/plural.js";
import { ASSIGNMENT_KINDS } from "@donordesk/domain/contexts/tasks/index.js";
import type { AssignmentsResponse } from "@/lib/server/schemas";
import { cancelTaskAction, completeTaskAction } from "@/lib/actions/tasks";
import { useActionState } from "@/lib/client/action-state";
import { Badge } from "@/components/data/Badge";
import { Button } from "@/components/ui/Button";
import { askedByText, dueText, filterGroupsByProject, projectChips, totalIn } from "../domain/my-work-view";

/**
 * One list of everything a person is responsible for, grouped Late / Today / This week / Later / No date (empty groups hidden),
 * with project chips. Reviews that arrive because of the person's role sit in the same list with a short "because you approve".
 */
export function MyWorkPanel({ data, names, userId, mine }: { data: AssignmentsResponse; names: Record<string, string>; userId: string; mine: boolean }) {
  const router = useRouter();
  const state = useActionState();
  const [project, setProject] = useState<string>("all");
  const chips = projectChips(data.groups);
  const groups = filterGroupsByProject(data.groups, project);

  async function act(run: () => Promise<{ ok: boolean }>) {
    const done = await state.run(async () => (await run()) as never);
    if (done === true) router.refresh();
  }

  if (data.total === 0) {
    return <p className="mt-6 text-sm text-slate-600 dark:text-slate-300">{mine ? "Nothing needs you right now." : "Nothing is assigned to this person."}</p>;
  }

  return (
    <div className="mt-4 space-y-5">
      {chips.length > 1 && (
        <div role="group" aria-label="Project" className="flex flex-wrap gap-2">
          {[{ id: "all", title: "All projects", count: data.total }, ...chips].map((c) => (
            <button key={c.id} type="button" aria-pressed={project === c.id} onClick={() => setProject(c.id)}
              className={`rounded-full px-3 py-1 text-xs ${project === c.id ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200"}`}>
              {c.title} <span className="opacity-70">{c.count}</span>
            </button>
          ))}
        </div>
      )}
      {groups.map((g) => (
        <section key={g.key} aria-labelledby={`mw-${g.key}`}>
          <h2 id={`mw-${g.key}`} className="text-sm font-semibold">{g.label} <span className="font-normal text-slate-500">({g.items.length})</span></h2>
          <ul className="mt-2 divide-y divide-slate-200 rounded-xl border border-slate-200 dark:divide-white/10 dark:border-white/10">
            {g.items.map((a) => (
              <li key={a.key} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <Link href={a.href} className="font-medium text-brand-700 hover:underline dark:text-brand-300">{a.title}</Link>
                  <p className="text-xs text-slate-500">
                    {ASSIGNMENT_KINDS[a.kind].label} · {a.projectTitle}
                    {dueText(a, data.today) ? ` · ${dueText(a, data.today)}` : ""}
                    {askedByText(a, userId, names) ? ` · ${askedByText(a, userId, names)}` : ""}
                    {a.because ? ` · ${a.because}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {a.urgent && <Badge tone="danger">Urgent</Badge>}
                  {a.state === "LATE" && <Badge tone="danger">Late</Badge>}
                  {mine && a.kind === "TASK" && a.manual && (
                    <Button size="sm" variant="secondary" disabled={state.busy} onClick={() => act(() => completeTaskAction(a.key.replace("TASK:", "")))}>Mark done</Button>
                  )}
                  {a.kind === "TASK" && a.askedById === userId && (
                    <Button size="sm" variant="ghost" disabled={state.busy} onClick={() => act(() => cancelTaskAction(a.key.replace("TASK:", "")))}>Withdraw</Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {state.error && <p role="alert" className="text-sm text-danger-600">{state.error}</p>}
      <p className="text-xs text-slate-500">{countOf(totalIn(groups), "item")} shown.</p>
    </div>
  );
}
