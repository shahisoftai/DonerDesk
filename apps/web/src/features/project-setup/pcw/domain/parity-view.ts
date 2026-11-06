import type { SlideKey } from "@donordesk/domain";
import type { SetupDraftView } from "../../../../lib/server/schemas-project-setup-draft.ts";
import { LEVELS, LEVEL_LABEL, parentChoices } from "./results-view.ts";
import type { SetupLogLevel } from "@donordesk/domain";

/** The reading parts that feed each slide (a slide with none has nothing to read again). */
export const AREAS_OF_SLIDE: Partial<Record<SlideKey, readonly string[]>> = {
  START: ["FACTS"], RESULTS: ["LOGFRAME"], INDICATORS: ["INDICATORS"], PLACES: ["PLACES"],
  WORK_PLAN: ["PLAN"], FINANCE: ["FUNDING_BUDGET"], REPORTING: ["PERIODS"], LAUNCH: ["RISKS"],
};

export const LEFT_OUT_REASON: Record<string, string> = {
  QUOTE_NOT_FOUND: "words not found in the documents",
  FIGURE_NOT_IN_QUOTE: "a figure is not in the quoted words",
  DATE_NOT_IN_QUOTE: "a date is not in the quoted words",
};

export const DOCUMENT_KINDS: Record<string, string> = {
  PROPOSAL: "Proposal or narrative", LOGFRAME_MATRIX: "Logframe table", WORK_PLAN_GANTT: "Work plan or Gantt chart",
  BUDGET: "Budget", INDICATOR_TABLE: "Indicator table", OTHER: "Other",
};

export function leftOutFor(view: SetupDraftView, slide: SlideKey): SetupDraftView["leftOut"] {
  const areas = AREAS_OF_SLIDE[slide] ?? [];
  return view.leftOut.filter((l) => areas.includes(l.area) && l.total > 0);
}

/** What the documents said about this step's part: blank sections, or no such part at all. FOUND with nothing blank says nothing. */
export function sectionNoticeFor(view: SetupDraftView, slide: SlideKey): SetupDraftView["sectionFindings"] {
  const areas = AREAS_OF_SLIDE[slide] ?? [];
  return view.sectionFindings.filter((f) => areas.includes(f.area) && f.state !== "FOUND");
}

/** True while any part is being read (again): the shell keeps asking until none is. */
export const anyAreaRunning = (view: SetupDraftView): boolean => Object.values(view.areaRuns).includes("RUNNING");

export const areaState = (view: SetupDraftView, slide: SlideKey): "RUNNING" | "FAILED" | null => {
  const states = (AREAS_OF_SLIDE[slide] ?? []).map((a) => view.areaRuns[a]);
  return states.includes("RUNNING") ? "RUNNING" : states.includes("FAILED") ? "FAILED" : null;
};

/** Where a result may be moved: any level, with the parents that level allows (a result is never offered itself or what sits under it). */
export function moveParents(level: SetupLogLevel, view: SetupDraftView, selfCode: string | null) {
  const below = new Set<string>();
  if (selfCode) {
    below.add(selfCode);
    let grew = true;
    while (grew) {
      grew = false;
      for (const i of view.logframe) {
        const n = i.value as { code: string | null; parentCode: string | null };
        if (n.code && n.parentCode && below.has(n.parentCode) && !below.has(n.code)) { below.add(n.code); grew = true; }
      }
    }
  }
  return parentChoices(level, view.logframe).filter((p) => !below.has(p.code));
}
export { LEVELS, LEVEL_LABEL };
