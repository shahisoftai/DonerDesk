"use client";

import { useState, useTransition } from "react";
import { editDraftAction } from "@/lib/actions/project-setup-draft";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { SetupDraftView } from "@/lib/server/schemas-project-setup-draft";
import { usePcwCopy } from "./usePcwCopy";
import { METHODS, METHOD_LABEL, REVIEW_LABEL, REVIEW_MODES, formCount, methodRows, participantActivities, windowPatch } from "../domain/entry-view";

type Work = () => Promise<{ ok: true; value: SetupDraftView } | { ok: false; error: { message: string } }>;

/**
 * Slide 7: how each indicator's numbers get in, who checks them, when entry is open and how confidential evidence is. A form
 * is only drafted for an indicator when the project starts; nothing is built here.
 */
export function DataEntrySlide({ id, view, onView }: { id: string; view: SetupDraftView; onView: (v: SetupDraftView) => void }) {
  const pcw = usePcwCopy();
  const PCW_COPY = pcw.c;
  const c = PCW_COPY.entry;
  const rows = methodRows(view);
  const col = view.extras.collection;
  const [opens, setOpens] = useState(col.windowRule ? String(col.windowRule.opensDaysBefore) : "");
  const [closes, setCloses] = useState(col.windowRule ? String(col.windowRule.closesDaysAfter) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (work: Work) => startTransition(async () => { const r = await work(); if (r.ok) { setError(null); onView(r.value); } else setError(r.error.message); });
  const setCollection = (patch: Record<string, unknown>) => run(() => editDraftAction(id, { kind: "SET_COLLECTION", patch }));
  const saveWindow = () => {
    const w = windowPatch(opens, closes);
    if (!w.ok) return setError(w.reason);
    if (col.windowRule?.opensDaysBefore === w.windowRule.opensDaysBefore && col.windowRule.closesDaysAfter === w.windowRule.closesDaysAfter) return;
    setCollection({ windowRule: w.windowRule });
  };

  return (
    <div className="space-y-8">
      <section aria-labelledby="pcw-methods" className="space-y-3">
        <h2 id="pcw-methods" className="text-lg font-semibold">{c.methodsTitle}</h2>
        {rows.length === 0 ? <p className="text-sm text-slate-600 dark:text-slate-300">{c.none}</p> : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.code} className="grid items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm sm:grid-cols-[1fr_16rem] dark:border-white/10">
                <span><span className="font-mono text-xs text-slate-500">{r.code}</span> {r.title}</span>
                <Select aria-label={`${c.method}: ${r.title}`} value={r.method} onChange={(e) => e.target.value && run(() => editDraftAction(id, { kind: "SET_INDICATOR_SETUP", code: r.code, patch: { method: e.target.value } }))}>
                  <option value="">{c.choose}</option>
                  {METHODS.map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
                </Select>
                {r.suggestion ? (
                  <p className="sm:col-span-2 text-slate-600 dark:text-slate-300">
                    {c.suggestion}: <strong>{METHOD_LABEL[r.suggestion.method]}</strong> ({r.suggestion.reason}){" "}
                    <button type="button" className="btn-secondary" disabled={pending} onClick={() => run(() => editDraftAction(id, { kind: "ACCEPT_METHOD_SUGGESTIONS", ids: [r.suggestion!.id] }))}>{c.useOne}</button>{" "}
                    <button type="button" className="btn-secondary" disabled={pending} onClick={() => run(() => editDraftAction(id, { kind: "REJECT_SUGGESTION", id: r.suggestion!.id }))}>{PCW_COPY.plan.reject}</button>
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {view.methodSuggestions.length > 1 ? (
          <button type="button" className="btn" disabled={pending} onClick={() => run(() => editDraftAction(id, { kind: "ACCEPT_METHOD_SUGGESTIONS", ids: view.methodSuggestions.map((s) => s.id) }))}>{c.useAll(view.methodSuggestions.length)}</button>
        ) : null}
        <p className="text-sm text-slate-600 dark:text-slate-300">{c.formsNote(formCount(view))}</p>
        <p className="text-sm text-slate-600 dark:text-slate-300">{c.participants(participantActivities(view))}</p>
      </section>

      <section aria-labelledby="pcw-review" className="grid gap-4 sm:grid-cols-2">
        <h2 id="pcw-review" className="text-lg font-semibold sm:col-span-2">{c.reviewTitle}</h2>
        <Field label={c.reviewMode}>
          <Select value={col.reviewMode ?? ""} onChange={(e) => e.target.value && setCollection({ reviewMode: e.target.value })}>
            <option value="">{c.choose}</option>
            {REVIEW_MODES.map((m) => <option key={m} value={m}>{REVIEW_LABEL[m]}</option>)}
          </Select>
        </Field>
        <p className="text-sm text-slate-600 dark:text-slate-300 sm:col-span-2">{c.rolesNote}</p>
      </section>

      <section aria-labelledby="pcw-window" className="grid gap-4 sm:grid-cols-2">
        <h2 id="pcw-window" className="text-lg font-semibold sm:col-span-2">{c.windowTitle}</h2>
        <Field label={c.opens} description={c.windowHelp}><Input inputMode="numeric" value={opens} onChange={(e) => setOpens(e.target.value)} onBlur={saveWindow} /></Field>
        <Field label={c.closes}><Input inputMode="numeric" value={closes} onChange={(e) => setCloses(e.target.value)} onBlur={saveWindow} /></Field>
      </section>

      {error ? <p role="alert" className="text-sm text-danger-600">{error}</p> : null}
    </div>
  );
}
