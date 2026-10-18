"use client";

import { useState } from "react";
import Link from "next/link";
import { countOf } from "@donordesk/domain/core/plural.js";
import { formatShortDate } from "@donordesk/domain/contexts/workplan/index.js";
import type { WorkPlanRow } from "@/lib/server/schemas";
import { Badge } from "@/components/data/Badge";
import { groupPlanList } from "../domain/plan-list-view";
import { PlanStatusControl } from "./PlanStatusControl";

const SIGNAL_TONE = { ON_TIME: "success", LATE: "danger", DONE: "neutral", CANCELLED: "neutral" } as const;

function dates(row: WorkPlanRow, today: string): string {
  return row.plannedStart === row.plannedEnd ? formatShortDate(row.plannedStart, today) : `${formatShortDate(row.plannedStart, today)} to ${formatShortDate(row.plannedEnd, today)}`;
}

function leadName(row: WorkPlanRow, userId: string, names: Record<string, string>): string {
  if (!row.ownerUserId) return "No lead yet";
  if (row.ownerUserId === userId) return "You";
  return names[row.ownerUserId] ?? "A team member";
}

/** The List view: grouped This week / Next week / Later / Done. Buttons the person cannot use are not rendered. */
export function PlanListView({ projectId, rows, today, userId, names, defaultMine, changeableIds }: {
  projectId: string;
  rows: WorkPlanRow[];
  today: string;
  userId: string;
  names: Record<string, string>;
  defaultMine: boolean;
  /** Ids of the activities this person may change the status of (decided on the server; plain data so it can cross to the browser). */
  changeableIds: string[];
}) {
  const [mineOnly, setMineOnly] = useState(defaultMine);
  const groups = groupPlanList(rows, today, { mineOnly, userId });

  return (
    <div className="space-y-6">
      <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
        <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} className="h-4 w-4" />
        Only mine
      </label>
      {groups.length === 0 && <p className="text-sm text-slate-500">{mineOnly ? "Nothing planned for you." : "Nothing planned yet."}</p>}
      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`plan-${group.key}`}>
          <details open={!group.collapsed}>
            <summary id={`plan-${group.key}`} className="cursor-pointer text-sm font-semibold text-slate-800 dark:text-slate-100">
              {group.label} <span className="font-normal text-slate-500">({group.items.length})</span>
            </summary>
            <ul className="mt-2 divide-y divide-slate-200 rounded-xl border border-slate-200 dark:divide-white/10 dark:border-white/10">
              {group.items.map((row) => (
                <li key={row.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <Link href={`/projects/${projectId}/activities/plan/${row.id}`} className="font-medium text-brand-700 hover:underline dark:text-brand-300">{row.title}</Link>
                    <p className="text-xs text-slate-500">
                      {dates(row, today)}
                      {row.originalStart && row.originalEnd && (row.originalStart !== row.plannedStart || row.originalEnd !== row.plannedEnd) && (
                        <> · moved from {formatShortDate(row.originalStart, today)}</>
                      )}
                      {" · "}{leadName(row, userId, names)}
                      {row.completedActivities > 0 && <> · {countOf(row.completedActivities, "completed activity", "completed activities")}</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={SIGNAL_TONE[row.signal]} title={row.signalReason}>{row.signalLabel}</Badge>
                    <PlanStatusControl itemId={row.id} status={row.status} suggested={row.suggestedStatus} canChange={changeableIds.includes(row.id)} />
                  </div>
                </li>
              ))}
            </ul>
          </details>
        </section>
      ))}
    </div>
  );
}
