import type { SlideKey } from "@donordesk/domain";
import type { SetupDraftView } from "../../../../lib/server/schemas-project-setup-draft.ts";

/**
 * "What we found" (Phase 59): when documents were read, the first thing the person sees is what the reading put in each area, and one
 * click confirms everything that is waiting. A new area is a row. Only items that came from a document and are still waiting count.
 */
export type FoundAreaKey = "LOGFRAME" | "INDICATORS" | "PLACES" | "PLAN" | "FUNDING_BUDGET" | "RISKS";
export interface FoundArea { key: FoundAreaKey; slide: SlideKey; found: number; waiting: number; waitingPaths: string[] }

type Item = { path: string; status: string; origin: string };
const FOUND_AREAS: ReadonlyArray<{ key: FoundAreaKey; slide: SlideKey; items(view: SetupDraftView): readonly Item[] }> = [
  { key: "LOGFRAME", slide: "RESULTS", items: (v) => v.logframe },
  { key: "INDICATORS", slide: "INDICATORS", items: (v) => v.indicators },
  { key: "PLACES", slide: "PLACES", items: (v) => v.places },
  { key: "PLAN", slide: "WORK_PLAN", items: (v) => v.plan },
  { key: "FUNDING_BUDGET", slide: "FINANCE", items: (v) => [...v.funding, ...v.budget] },
  { key: "RISKS", slide: "LAUNCH", items: (v) => v.risks },
];

export interface FoundSummary { areas: FoundArea[]; waiting: number; found: number; firstToReview: SlideKey | null }

export function foundSummary(view: SetupDraftView): FoundSummary {
  const areas = FOUND_AREAS.flatMap((a): FoundArea[] => {
    const fromDocument = a.items(view).filter((i) => i.origin === "DOCUMENT" && i.status !== "REJECTED");
    if (fromDocument.length === 0) return [];
    const waitingPaths = fromDocument.filter((i) => i.status === "PROPOSED").map((i) => i.path);
    return [{ key: a.key, slide: a.slide, found: fromDocument.length, waiting: waitingPaths.length, waitingPaths }];
  });
  const open = new Set(view.progress.filter((p) => !p.complete).map((p) => p.slide));
  return {
    areas,
    waiting: areas.reduce((n, a) => n + a.waiting, 0),
    found: areas.reduce((n, a) => n + a.found, 0),
    firstToReview: view.progress.map((p) => p.slide).find((s) => open.has(s)) ?? null,
  };
}

/** Whether the card is offered: documents exist, reading is over, and something was found. */
export const offersFound = (view: SetupDraftView, summary: FoundSummary): boolean => view.sources.length > 0 && view.status === "READY" && summary.found > 0;
