"use client";
import { use } from "react";
import { importIndicatorsTextAction } from "@/lib/actions/indicators";
import { TextImportPanel } from "@/features/imports/presentation/TextImportPanel";
import { INDICATOR_TYPE_LABEL } from "@/lib/labels";
import type { ImportIndicatorsResponse } from "@/lib/server/schemas";

export default function ImportIndicatorsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <TextImportPanel<ImportIndicatorsResponse>
      kind="indicators"
      title="Import indicators"
      intro="Upload a file, or paste or dictate your indicators. Rows with Code, Name, Type, Baseline and Target become indicators linked to the matching logframe item."
      noun={["indicator", "indicators"]}
      fileHelp="XLSX, CSV or TXT. The Indicators sheet of the logframe template works best."
      templateHref="/api/templates/logframe"
      pastePlaceholder={"Code,Name,Type,Baseline,Target\nOUT-1.1,Water points rehabilitated,NUMBER,0,40"}
      noneCreatedMessage="No new indicators were created. Existing codes are skipped; check that each indicator code matches a logframe item code in this project."
      createLabel="Create indicators"
      viewHref={`/projects/${id}/logframe`}
      viewLabel="View logframe"
      runImport={(text, sourceName) => importIndicatorsTextAction({ projectId: id, text, sourceName })}
      renderItem={(item) => (
        <>
          <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{item.code}</span>
          <span className="min-w-0 flex-1">{item.name}</span>
          <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300">
            {INDICATOR_TYPE_LABEL[item.type] ?? item.type}
          </span>
        </>
      )}
    />
  );
}
