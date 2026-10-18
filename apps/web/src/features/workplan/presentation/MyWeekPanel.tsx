"use client";

import { useState } from "react";
import Link from "next/link";
import { countOf } from "@donordesk/domain/core/plural.js";
import { formatShortDate, WORKPLAN_COPY } from "@donordesk/domain/contexts/workplan/index.js";
import type { MyWeek } from "@/lib/server/schemas";
import { Badge } from "@/components/data/Badge";
import { Select } from "@/components/ui/Select";
import { groupMyWeek } from "../domain/my-week";
import { monthCells, weekCells } from "../domain/calendar-layout";
import { PlanStatusControl } from "./PlanStatusControl";

const SIGNAL_TONE = { ON_TIME: "success", LATE: "danger", DONE: "neutral", CANCELLED: "neutral" } as const;
type Layout = "list" | "week" | "month";
const LAYOUT_LABEL: Record<Layout, string> = { list: "List", week: "Week", month: "Month" };
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dates(start: string, end: string, today: string): string {
  return start === end ? formatShortDate(start, today) : `${formatShortDate(start, today)} to ${formatShortDate(end, today)}`;
}

/** Where "Add completed activity" goes: straight there for one project, a choice for several. */
function AddCompleted({ projects }: { projects: Array<{ id: string; title: string }> }) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  if (projects.length === 0) return null;
  const href = `/projects/${projectId}/activities/new`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {projects.length > 1 && (
        <label className="sr-only" htmlFor="my-week-project">Project</label>
      )}
      {projects.length > 1 && (
        <Select id="my-week-project" className="max-w-xs" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </Select>
      )}
      <Link className="btn text-base" href={href}>{WORKPLAN_COPY.addCompleted}</Link>
    </div>
  );
}

/**
 * A field officer's landing: late, this week and next week as a list, or as a week / month calendar; the activities a
 * reviewer sent back; and one big "Add completed activity". Status changes are kept on the device when offline.
 */
export function MyWeekPanel({ week, projects }: { week: MyWeek; projects: Array<{ id: string; title: string }> }) {
  const [layout, setLayout] = useState<Layout>("list");
  const today = week.today;
  const groups = groupMyWeek(week.planned, today);
  const open = week.planned.filter((p) => groups.some((g) => g.items.includes(p)));

  const row = (p: MyWeek["planned"][number]) => (
    <li key={p.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <Link href={`/projects/${p.projectId}/activities/plan/${p.id}`} className="font-medium text-brand-700 hover:underline dark:text-brand-300">{p.title}</Link>
        <p className="text-xs text-slate-500">{dates(p.plannedStart, p.plannedEnd, today)} · {p.projectTitle}{p.location ? ` · ${p.location}` : ""}</p>
      </div>
      <div className="flex items-center gap-3">
        <Badge tone={SIGNAL_TONE[p.signal]} title={p.signalReason}>{p.signalLabel}</Badge>
        <PlanStatusControl itemId={p.id} status={p.status} suggested={p.suggestedStatus} canChange queueOffline={{ title: p.title }} />
      </div>
    </li>
  );

  return (
    <section aria-labelledby="my-week-title" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="my-week-title" className="text-lg font-semibold tracking-tight">My week</h2>
        <AddCompleted projects={projects} />
      </div>

      {week.sentBack.length > 0 && (
        <div role="region" aria-label="Sent back to you" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-500/40 dark:bg-amber-500/10">
          <p className="font-medium">{countOf(week.sentBack.length, "completed activity", "completed activities")} to fix</p>
          <ul className="mt-1 space-y-1">
            {week.sentBack.map((a) => (
              <li key={a.id}><Link className="underline" href={`/projects/${a.projectId}/activities/${a.id}`}>{a.title}</Link> <span className="text-xs text-slate-600 dark:text-slate-300">· {formatShortDate(a.activityDate, today)} · {a.projectTitle}</span></li>
            ))}
          </ul>
        </div>
      )}

      <div role="group" aria-label="Layout" className="inline-flex overflow-hidden rounded-lg border border-slate-300 dark:border-white/15">
        {(Object.keys(LAYOUT_LABEL) as Layout[]).map((key) => (
          <button key={key} type="button" aria-pressed={layout === key} onClick={() => setLayout(key)}
            className={`min-h-[32px] px-3 text-xs font-medium ${layout === key ? "bg-brand-600 text-white" : "bg-white text-slate-700 dark:bg-slate-900/40 dark:text-slate-200"}`}>
            {LAYOUT_LABEL[key]}
          </button>
        ))}
      </div>

      {layout === "list" && (
        groups.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing planned for you this week or next.</p>
        ) : (
          <div className="space-y-5">
            {groups.map((g) => (
              <div key={g.key}>
                <h3 className="text-sm font-semibold">{g.label} <span className="font-normal text-slate-500">({g.items.length})</span></h3>
                <ul className="mt-2 divide-y divide-slate-200 rounded-xl border border-slate-200 dark:divide-white/10 dark:border-white/10">{g.items.map(row)}</ul>
              </div>
            ))}
          </div>
        )
      )}

      {layout === "week" && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
          {weekCells(today, open).map((cell, i) => (
            <div key={cell.date} className={`min-h-[96px] rounded-lg border p-2 text-xs ${cell.isToday ? "border-brand-500" : "border-slate-200 dark:border-white/10"}`}>
              <p className="font-medium">{WEEKDAYS[i]} {Number(cell.date.slice(8, 10))}</p>
              <ul className="mt-1 space-y-1">{cell.items.map((p) => <li key={p.id}><Link className="underline" href={`/projects/${p.projectId}/activities/plan/${p.id}`}>{p.title}</Link></li>)}</ul>
            </div>
          ))}
        </div>
      )}

      {layout === "month" && (
        <div className="hidden sm:block" role="table" aria-label="Month">
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500" role="row">{WEEKDAYS.map((d) => <span key={d} role="columnheader">{d}</span>)}</div>
          {monthCells(today, open).map((weekRow, wi) => (
            <div key={wi} className="mt-1 grid grid-cols-7 gap-1" role="row">
              {weekRow.map((cell) => (
                <div key={cell.date} role="cell" className={`min-h-[72px] rounded border p-1 text-xs ${cell.inMonth ? "" : "opacity-40"} ${cell.isToday ? "border-brand-500" : "border-slate-200 dark:border-white/10"}`}>
                  <p>{Number(cell.date.slice(8, 10))}</p>
                  {cell.items.slice(0, 2).map((p) => <Link key={p.id} className="block truncate underline" href={`/projects/${p.projectId}/activities/plan/${p.id}`}>{p.title}</Link>)}
                  {cell.items.length > 2 && <span className="text-slate-500">+{cell.items.length - 2} more</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {layout === "month" && <p className="text-sm text-slate-500 sm:hidden">The month view needs a wider screen. Use List or Week.</p>}
    </section>
  );
}
