"use client";
import { use } from "react";
import { importEvidenceTextAction } from "@/lib/actions/evidence";
import { TextImportPanel } from "@/features/imports/presentation/TextImportPanel";
import { EVIDENCE_TYPE_LABEL } from "@/lib/labels";
import type { ImportEvidenceResponse } from "@/lib/server/schemas";

export default function ImportEvidencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <TextImportPanel<ImportEvidenceResponse>
      kind="evidence"
      title="Import evidence links"
      intro="Upload a file, or paste your evidence list. Rows with Title, File Name, Evidence Type and a Google Drive Web Link become link-first evidence records."
      noun={["evidence record", "evidence records"]}
      fileHelp="XLSX, CSV or TXT. Each row needs a Drive Web Link."
      templateHref="/api/templates/evidence"
      pastePlaceholder={"Title,File Name,Evidence Type,Google Drive Web Link\nAttendance 12 March,attendance.pdf,ATTENDANCE_SHEET,https://drive.google.com/file/d/…"}
      noneCreatedMessage="No evidence records were created. Every row needs a valid Google Drive Web Link."
      createLabel="Create evidence records"
      viewHref={`/projects/${id}/evidence`}
      viewLabel="View evidence"
      runImport={(text, sourceName) => importEvidenceTextAction({ projectId: id, text, sourceName })}
      renderItem={(item) => (
        <>
          <span className="min-w-0 flex-1">{item.title}</span>
          <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300">
            {EVIDENCE_TYPE_LABEL[item.evidenceType] ?? item.evidenceType}
          </span>
        </>
      )}
    />
  );
}
