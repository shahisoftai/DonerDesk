"use client";

import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/data/Badge";
import { reportDraftStatusTone } from "@/lib/shared/tone";
import { REPORT_DRAFT_STATUS_LABEL } from "@/lib/labels";

export type DraftVersion = {
  id: string;
  title: string;
  status: string;
  version: number;
  generatedByAi?: boolean;
  approvedById?: string;
  approvedAt?: string | null;
  supersededAt?: string | null;
  createdAt: string;
};

/**
 * Draft history for a reporting period. Exactly one draft is current; every
 * older generation appears here so a working draft can be recovered or
 * compared without cluttering the main workspace.
 */
export function DraftVersionsPanel({
  versions,
  currentDraftId,
  canEdit,
  onActivate,
  busy,
}: {
  versions: DraftVersion[];
  currentDraftId: string | null;
  canEdit: boolean;
  onActivate: (draftId: string) => void;
  busy: boolean;
}) {
  if (versions.length === 0) {
    return (
      <div className="card">
        <p className="text-sm text-slate-600 dark:text-slate-300">No draft versions yet.</p>
      </div>
    );
  }

  const canRestore = (v: DraftVersion) => v.id !== currentDraftId && (v.status === "DRAFT" || v.status === "UNDER_REVIEW");

  return (
    <section className="card">
      <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200">Draft versions</h3>
      <ul className="mt-3 space-y-2">
        {versions.map((v) => (
          <li key={v.id} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white p-2 text-sm dark:border-white/10 dark:bg-white/5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium text-slate-700 dark:text-slate-200">{v.title}</span>
                <Badge tone={reportDraftStatusTone(v.status)}>
                  {REPORT_DRAFT_STATUS_LABEL[v.status] ?? v.status.replace(/_/g, " ")}
                </Badge>
                {v.id === currentDraftId && <Badge tone="success">Current</Badge>}
              </div>
              <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                Created {new Date(v.createdAt).toLocaleDateString()}
                {v.supersededAt ? ` · superseded ${new Date(v.supersededAt).toLocaleDateString()}` : ""}
              </p>
            </div>
            {canRestore(v) && (
              <Button size="sm" variant="ghost" disabled={busy} pending={busy} onClick={() => onActivate(v.id)}>
                Make current
              </Button>
            )}
          </li>
        ))}
      </ul>
      {!canEdit && versions.length > 1 && (
        <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">You need edit permission to reactivate a previous draft.</p>
      )}
    </section>
  );
}
