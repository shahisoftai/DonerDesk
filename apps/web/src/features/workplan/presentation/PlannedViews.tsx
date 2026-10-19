"use client";

import { useState } from "react";
import type { WorkPlanRow } from "@/lib/server/schemas";
import type { DateRange, TimelineDeadline } from "../domain/timeline-layout";
import type { PlanViewKey } from "../domain/role-surfaces";
import { PlanListView } from "./PlanListView";
import { PlanTimeline } from "./PlanTimeline";

const LABEL: Record<PlanViewKey, string> = { LIST: "List", TIMELINE: "Timeline" };

/**
 * List or Timeline for the Planned side. A person's role decides which opens first. Under 640 px the Timeline is not
 * offered at all: the List is shown, so there is never sideways scrolling on a phone.
 */
export function PlannedViews(props: {
  projectId: string;
  rows: WorkPlanRow[];
  today: string;
  userId: string;
  names: Record<string, string>;
  initialView: PlanViewKey;
  defaultMine: boolean;
  deadlines: TimelineDeadline[];
  project: DateRange;
  outputTitles: Record<string, string>;
  changeableIds: string[];
  /** itemId -> "Label: value" for the project's own fields that have a value. */
  fieldChips?: Record<string, string[]>;
  movableIds: string[];
}) {
  const [view, setView] = useState<PlanViewKey>(props.initialView);
  const list = (
    <PlanListView projectId={props.projectId} rows={props.rows} today={props.today} userId={props.userId} names={props.names} defaultMine={props.defaultMine} changeableIds={props.changeableIds} fieldChips={props.fieldChips ?? {}} />
  );
  return (
    <div className="space-y-4">
      <div role="group" aria-label="View" className="hidden overflow-hidden rounded-lg border border-slate-300 sm:inline-flex dark:border-white/15">
        {(Object.keys(LABEL) as PlanViewKey[]).map((key) => (
          <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)}
            className={`min-h-[32px] px-3 text-xs font-medium ${view === key ? "bg-brand-600 text-white" : "bg-white text-slate-700 dark:bg-slate-900/40 dark:text-slate-200"}`}>
            {LABEL[key]}
          </button>
        ))}
      </div>
      {view === "LIST" ? list : (
        <>
          <div className="hidden sm:block">
            <PlanTimeline projectId={props.projectId} rows={props.rows} deadlines={props.deadlines} project={props.project} today={props.today} outputTitles={props.outputTitles} movableIds={props.movableIds} />
          </div>
          <div className="sm:hidden">{list}</div>
        </>
      )}
    </div>
  );
}
