"use client";

import { useState, useTransition } from "react";
import { setSetupDocumentKindAction } from "@/lib/actions/project-setup";
import { getDraftAction } from "@/lib/actions/project-setup-draft";
import type { SetupDraftView } from "@/lib/server/schemas-project-setup-draft";
import { usePcwCopy } from "./usePcwCopy";

/** What each document was read as, with the control to say otherwise (every part is then read again). */
export function DocumentsList({ id, view, onView }: { id: string; view: SetupDraftView; onView: (v: SetupDraftView) => void }) {
  const t = usePcwCopy().c.parity;
  const [note, setNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (view.sources.length === 0) return null;
  const choose = (documentId: string, kind: string) => {
    setNote(null);
    startTransition(async () => {
      const r = await setSetupDocumentKindAction(id, documentId, kind === "" ? null : kind);
      setNote(r.ok ? t.rereadingNote : r.error.message);
      const fresh = await getDraftAction(id);
      if (fresh.ok) onView(fresh.value);
    });
  };
  return (
    <details className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
      <summary className="cursor-pointer select-none text-sm font-semibold">{t.documentsTitle}</summary>
      <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{t.documentsLead}</p>
      <ul className="mt-3 space-y-3">
        {view.sources.map((s) => (
          <li key={s.documentId} className="text-sm">
            <p className="font-medium">{s.name}</p>
            <p className="text-xs text-slate-600 dark:text-slate-300">{t.readAs(s.override ? `${t.kinds[s.override] ?? s.override} (${t.kindChosen})` : [...new Set(s.sheets.map((sh) => t.kinds[sh.kind] ?? sh.kind))].join(", "))}</p>
            <label htmlFor={`kind-${s.documentId}`} className="sr-only">{t.readAsLabel}</label>
            <select id={`kind-${s.documentId}`} className="input mt-1 max-w-xs py-1 text-xs" value={s.override ?? ""} disabled={pending} onChange={(e) => choose(s.documentId, e.target.value)}>
              <option value="">{t.useReading}</option>
              {Object.entries(t.kinds).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </li>
        ))}
      </ul>
      {note ? <p role="status" className="mt-2 text-xs text-amber-800 dark:text-amber-200">{note}</p> : null}
    </details>
  );
}
