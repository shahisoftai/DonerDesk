"use client";

import { importWorkPlanAction } from "@/lib/actions/workplan";
import { TextImportPanel } from "@/features/imports/presentation/TextImportPanel";
import type { ImportWorkPlanResponse } from "@/lib/server/schemas";

/** The one import screen (file, paste or dictate) for the work plan. Any row that cannot be read stops the import. */
export function ImportWorkPlanForm({ projectId }: { projectId: string }) {
  return (
    <TextImportPanel<ImportWorkPlanResponse>
      kind="work-plan"
      title="Import planned activities"
      intro="Upload a file, or paste your plan. If any row cannot be read, nothing is imported, and the message says which rows to fix."
      noun={["planned activity", "planned activities"]}
      fileHelp="XLSX, CSV or TXT. Logframe codes and lead emails are matched against this project."
      pastePlaceholder={"Logframe Code,Title,Start,End,Lead email,Location,Sessions,Repeats\nA1.1,Outreach visits,2026-03-10,2026-03-12,amina@example.org,Ward 4,4,Monthly"}
      noneCreatedMessage="No new planned activities were created. Rows that are already planned for the same dates are skipped."
      createLabel="Create planned activities"
      viewHref={`/projects/${projectId}/activities?view=planned`}
      viewLabel="View planned activities"
      runImport={(text, sourceName) => importWorkPlanAction(projectId, { apply: true, text, ...(sourceName ? { sourceName } : {}) })}
      renderItem={(item) => (
        <>
          <span className="min-w-0 flex-1">{item.title}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">{item.plannedStart}{item.plannedEnd !== item.plannedStart ? ` to ${item.plannedEnd}` : ""}</span>
        </>
      )}
    />
  );
}
