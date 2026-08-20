"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { formatDateTime } from "@/lib/shared/dates";
import { protectedFileDownloadHref } from "@/lib/shared/downloads";
import { EXPORT_TYPE_LABEL } from "@/lib/labels";
import { ExportWizard } from "./ExportWizard";

export type ExportHistoryItem = {
  id: string;
  exportType: string;
  fileUrl: string;
  version?: number;
  exportedById?: string;
  includedFiles?: string[];
  createdAt: string;
};

export function ExportsPanel({
  projectId,
  periodId,
  initialExports,
  canExport,
}: {
  projectId: string;
  periodId: string;
  initialExports: ExportHistoryItem[];
  canExport: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [exports, setExports] = useState<ExportHistoryItem[]>(initialExports);

  function onExported() {
    setOpen(false);
  }

  return (
    <section aria-labelledby="exports-title" className="card">
      <div className="flex items-center justify-between gap-2">
        <h2 id="exports-title" className="text-sm font-medium text-slate-800 dark:text-slate-100">
          Exports
        </h2>
        {canExport && (
          <Button size="sm" variant="secondary" onClick={() => setOpen((v) => !v)}>
            {open ? "Close" : "Export report"}
          </Button>
        )}
      </div>

      {open && (
        <div className="mt-3">
          <ExportWizard
            projectId={projectId}
            periodId={periodId}
            onClose={() => setOpen(false)}
            onExported={onExported}
          />
        </div>
      )}

      {exports.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No exports yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {exports.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <div className="min-w-0">
                <div className="font-medium">{EXPORT_TYPE_LABEL[e.exportType] ?? e.exportType.replace(/_/g, " ")}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Version {e.version ?? "—"} · {e.includedFiles?.length ?? 0} file(s) · {formatDateTime(e.createdAt)}
                </div>
              </div>
              <a className="btn-secondary py-1 text-xs" href={protectedFileDownloadHref(e.fileUrl)}>Download</a>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
        Each export is an immutable snapshot of the selected report version and files.
      </p>
    </section>
  );
}
