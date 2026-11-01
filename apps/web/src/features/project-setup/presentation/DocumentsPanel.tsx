"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setSetupDocumentKindAction } from "@/lib/actions/project-setup";
import type { SetupProposalView } from "@/lib/server/schemas-project-setup";
import type { DocumentKindKey } from "../copy";
import { useSetupCopy } from "./useSetupCopy";

const KINDS: readonly DocumentKindKey[] = ["PROPOSAL", "LOGFRAME_MATRIX", "WORK_PLAN_GANTT", "BUDGET", "INDICATOR_TABLE", "OTHER"];

/** What each document was read as, and the control to say otherwise (every part is then read again). */
export function DocumentsPanel({ view, readOnly }: { view: SetupProposalView; readOnly: boolean }) {
  const { c } = useSetupCopy();
  const rv = c.review;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const sources = view.proposal.proposal.sources ?? [];
  if (sources.length === 0) return null;
  const choose = (documentId: string, kind: string) => {
    setNote(null);
    startTransition(async () => {
      const r = await setSetupDocumentKindAction(view.proposal.id, documentId, kind === "" ? null : kind);
      setNote(r.ok ? rv.rereadingNote : r.error.message || c.common.unknownError);
      router.refresh();
    });
  };
  return (
    <details className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
      <summary className="cursor-pointer select-none text-sm font-semibold text-slate-900 dark:text-slate-100">{rv.documentsTitle}</summary>
      <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{rv.documentsLead}</p>
      <ul className="mt-3 space-y-3">
        {sources.map((s) => (
          <li key={s.documentId} className="text-sm">
            <p className="font-medium text-slate-900 dark:text-slate-100">{s.name}</p>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {rv.readAs}: {s.override ? `${rv.documentKinds[s.override]} (${rv.kindChosen})` : [...new Set(s.sheets.map((sh) => rv.documentKinds[sh.kind]))].join(", ")}
            </p>
            {s.feeds && s.feeds.length > 0 && <p className="text-xs text-slate-600 dark:text-slate-300">{rv.feedsLabel}: {s.feeds.map((a) => c.areas[a].short).join(", ")}</p>}
            {!readOnly && (
              <>
                <label htmlFor={`kind-${s.documentId}`} className="sr-only">{rv.readAs}</label>
                <select id={`kind-${s.documentId}`} className="input mt-1 max-w-xs py-1 text-xs" disabled={pending} value={s.override ?? ""} onChange={(e) => choose(s.documentId, e.target.value)}>
                  <option value="">{rv.useReading}</option>
                  {KINDS.map((k) => <option key={k} value={k}>{rv.documentKinds[k]}</option>)}
                </select>
              </>
            )}
          </li>
        ))}
      </ul>
      {note && <p role="status" className="mt-2 text-xs text-amber-800 dark:text-amber-200">{note}</p>}
    </details>
  );
}
