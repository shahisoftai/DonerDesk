"use client";

import type { SetupProposalView } from "@/lib/server/schemas-project-setup";
import type { AreaKey } from "../domain/slide-deck";
import { DocumentsPanel } from "./DocumentsPanel";
import { GuidancePanel } from "./GuidancePanel";
import { ReviewRows } from "./ReviewRows";
import { useSetupCopy } from "./useSetupCopy";

/** One review step: the step's own instructions (collapsible once you know them) above the items to decide. */
export function AreaSlide({ view, area }: { view: SetupProposalView; area: AreaKey }) {
  const { c } = useSetupCopy();
  const readOnly = view.proposal.status === "APPLIED";
  return (
    <>
      <details open className="group rounded-xl border border-brand-300/40 bg-brand-50/50 p-1 dark:border-brand-400/20 dark:bg-brand-400/5">
        <summary className="cursor-pointer select-none rounded-lg px-4 py-2 text-sm font-semibold text-brand-800 dark:text-brand-200">{c.common.instructions}</summary>
        <div className="px-3 pb-3 pt-2"><GuidancePanel guide={c.areas[area]} /></div>
      </details>
      {area === "FACTS" && <DocumentsPanel view={view} readOnly={readOnly} />}
      <ReviewRows view={view} area={area} readOnly={readOnly} />
    </>
  );
}
