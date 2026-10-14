"use client";

import { useState } from "react";
import { importActivitiesTextAction } from "@/lib/actions/activities";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { TextImportPanel } from "@/features/imports/presentation/TextImportPanel";
import type { ImportActivitiesResponse } from "@/lib/server/schemas";

export function ImportActivitiesForm({
  projectId,
  reportingPeriods,
}: {
  projectId: string;
  reportingPeriods: Array<{ id: string; label: string }>;
}) {
  // Each row goes to the period containing its own date; this only catches dates no period contains ("" = skip them).
  const [fallbackPeriodId, setFallbackPeriodId] = useState("");
  return (
    <TextImportPanel<ImportActivitiesResponse>
      kind="activities"
      title="Import activities"
      intro="Upload a file, or paste your activity updates. Rows with Activity Title, Activity Date and Summary are submitted for review."
      noun={["activity", "activities"]}
      fileHelp="XLSX, CSV or TXT. Output and indicator codes are matched against this project's logframe."
      templateHref="/api/templates/activities"
      pastePlaceholder={"Activity Title,Activity Date,Summary\nHygiene session,2027-03-12,Held a session with 40 women"}
      noneCreatedMessage="No new activities were created. Rows with titles that already exist in this project are skipped."
      createLabel="Create activity records"
      viewHref={`/projects/${projectId}/activities`}
      viewLabel="View activities"
      runImport={(text, sourceName) =>
        importActivitiesTextAction({ projectId, text, sourceName, ...(fallbackPeriodId ? { reportingPeriodId: fallbackPeriodId } : {}) })
      }
      renderItem={(item) => (
        <>
          <span className="min-w-0 flex-1">{item.activityTitle}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">{item.activityDate.slice(0, 10)}</span>
        </>
      )}
    >
      <Field
        label="If a row's date is in no reporting period"
        htmlFor="reportingPeriod"
        description="Each activity is placed in the reporting period that contains its date, so one file can cover several months."
      >
        <Select id="reportingPeriod" value={fallbackPeriodId} onChange={(e) => setFallbackPeriodId(e.target.value)}>
          <option value="">Skip that row and tell me</option>
          {reportingPeriods.map((p) => (
            <option key={p.id} value={p.id}>Use {p.label}</option>
          ))}
        </Select>
      </Field>
    </TextImportPanel>
  );
}
