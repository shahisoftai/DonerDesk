"use client";
import { use } from "react";
import { importLogframeTextAction } from "@/lib/actions/logframe";
import { TextImportPanel } from "@/features/imports/presentation/TextImportPanel";
import { LOGFRAME_LEVEL_LABEL } from "@/lib/labels";
import type { ImportLogframeResponse } from "@/lib/server/schemas";

export default function ImportLogframePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <TextImportPanel<ImportLogframeResponse>
      kind="logframe"
      title="Add your logframe in one go"
      intro="Upload a file, or paste or dictate your results list. A plain outline works: one line per result, with the level (Goal, Outcome, Output, Activity) or a code such as 1.1.2, and indent to show what sits under what."
      noun={["logframe item", "logframe items"]}
      fileHelp="XLSX, CSV or TXT. The Logframe sheet of the template works best."
      templateHref="/api/templates/logframe"
      pastePlaceholder={"Goal: Improved child health in Kisumu County\n  Outcome 1: Fewer children under five with diarrhoea\n    Output 1.1: 40 water points rehabilitated\n      Activity 1.1.1: Train water committees"}
      noneCreatedMessage="No new items were created. Existing codes are skipped; check that each line has a level or a code."
      createLabel="Create logframe items"
      viewHref={`/projects/${id}/logframe`}
      viewLabel="View logframe"
      runImport={(text, sourceName) => importLogframeTextAction({ projectId: id, text, sourceName })}
      renderItem={(item) => (
        <>
          <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300">
            {LOGFRAME_LEVEL_LABEL[item.level as keyof typeof LOGFRAME_LEVEL_LABEL] ?? item.level}
          </span>
          {item.code && <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{item.code}</span>}
          <span className="min-w-0 flex-1">{item.title}</span>
        </>
      )}
    />
  );
}
