"use client";

import { useState } from "react";
import { accountForAdvanceAction, addAdvanceAction } from "@/lib/actions/finance";
import type { ProjectFinance } from "@/lib/server/schemas-finance";
import { Badge } from "@/components/data/Badge";
import { FINANCE_COPY as C } from "../domain/finance-copy";
import { advanceStatus, formatMoney } from "../domain/finance-view";
import { EntryForm } from "./EntryForm";

const TONE = { ok: "success", warn: "warning", danger: "danger" } as const;

export function AdvancesSection({ projectId, f, canEdit, today }: { projectId: string; f: ProjectFinance; canEdit: boolean; today: string }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section aria-labelledby="fin-advances" className="space-y-3">
      <h2 id="fin-advances" className="text-base font-semibold">{C.advancesTitle}</h2>
      {f.advances.length === 0 ? <p className="text-sm text-slate-500">{C.advancesEmpty}</p> : (
        <ul className="space-y-2">
          {f.advances.map((a) => {
            const s = advanceStatus(a.position);
            return (
              <li key={a.id} className="card text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><span className="font-medium">{a.heldBy}</span> <span className="text-xs text-slate-500">{C.given} {a.givenOn}</span></div>
                  <Badge tone={TONE[s.tone]}>{s.label}</Badge>
                </div>
                <p className="mt-1 tabular-nums">{formatMoney(a.amount)} · {C.accounted}: {formatMoney({ minor: a.position.accountedMinor, currency: a.amount.currency })} · {C.outstandingLine}: {formatMoney({ minor: a.position.outstandingMinor, currency: a.amount.currency })}</p>
                {a.note && <p className="text-xs text-slate-500">{a.note}</p>}
                {canEdit && a.position.outstandingMinor > 0 && (
                  <>
                    <button type="button" className="mt-1 text-xs font-medium text-brand-700 hover:underline dark:text-brand-300" onClick={() => setOpen(open === a.id ? null : a.id)}>{C.accountFor}</button>
                    {open === a.id && (
                      <EntryForm title={C.accountFor} submit={C.accountFor}
                        fields={[{ name: "date", label: C.date, kind: "date", required: true, initial: today }, { name: "amount", label: C.amount, kind: "amount", required: true }, { name: "currency", label: C.currency, kind: "currency", required: true, initial: a.amount.currency, options: [{ value: a.amount.currency, label: a.amount.currency }] }, { name: "note", label: C.note, kind: "text" }]}
                        onSubmit={(v) => accountForAdvanceAction(projectId, a.id, v)} />
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {canEdit && (
        <EntryForm title={C.addAdvance} submit={C.addAdvance}
          fields={[
            { name: "heldBy", label: C.heldBy, kind: "text", required: true },
            { name: "givenOn", label: C.given, kind: "date", required: true, initial: today },
            { name: "amount", label: C.amount, kind: "amount", required: true },
            { name: "currency", label: C.currency, kind: "currency", required: true, initial: f.primaryCurrency, options: [{ value: f.primaryCurrency, label: f.primaryCurrency }] },
            { name: "note", label: C.note, kind: "text" },
          ]}
          onSubmit={(v) => addAdvanceAction(projectId, v)} />
      )}
    </section>
  );
}
