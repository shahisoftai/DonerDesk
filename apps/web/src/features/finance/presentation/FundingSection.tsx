"use client";

import { useRouter } from "next/navigation";
import { addProjectFundingAction, removeProjectFundingAction } from "@/lib/actions/finance";
import { useActionState } from "@/lib/client/action-state";
import type { ProjectFinance } from "@/lib/server/schemas-finance";
import { FINANCE_COPY as C } from "../domain/finance-copy";
import { formatMoney } from "../domain/finance-view";
import { EntryForm } from "./EntryForm";

export function FundingSection({ projectId, f, canEdit, today }: { projectId: string; f: ProjectFinance; canEdit: boolean; today: string }) {
  const router = useRouter();
  const remove = useActionState();
  const sources = f.sources.filter((s) => !s.archived);
  return (
    <section aria-labelledby="fin-funding" className="space-y-3">
      <h2 id="fin-funding" className="text-base font-semibold">{C.fundingTitle}</h2>
      {f.funding.length === 0 ? <p className="text-sm text-slate-500">{C.fundingEmpty}</p> : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-white/10">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500"><th className="px-3 py-2">{C.date}</th><th className="px-3 py-2">{C.fundingSource}</th><th className="px-3 py-2">{C.amount}</th><th className="px-3 py-2">{C.fundingOwn}</th><th /></tr></thead>
            <tbody>
              {f.funding.map((r) => (
                <tr key={r.id} className="border-t border-slate-200 dark:border-white/10">
                  <td className="px-3 py-2">{r.date}</td>
                  <td className="px-3 py-2">{r.sourceName}{r.note && <span className="block text-xs text-slate-500">{r.note}</span>}</td>
                  <td className="px-3 py-2 tabular-nums">{formatMoney(r.amount)}</td>
                  <td className="px-3 py-2 text-xs">{r.ownFunding ? C.fundingOwn : C.fundingNotOwn}</td>
                  <td className="px-3 py-2 text-end">{canEdit && <button type="button" className="text-xs font-medium text-brand-700 hover:underline disabled:opacity-50 dark:text-brand-300" disabled={remove.busy} onClick={async () => { if (await remove.run(() => removeProjectFundingAction(projectId, r.id))) router.refresh(); }}>{C.remove}</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {remove.error && <p role="alert" className="text-sm text-danger-600">{remove.error}</p>}
      {canEdit && (
        <EntryForm title={C.addFunding} submit={C.addFunding}
          fields={[
            { name: "fundingSourceId", label: C.fundingSource, kind: "select", required: true, options: sources.map((s) => ({ value: s.id, label: s.name })) },
            { name: "date", label: C.date, kind: "date", required: true, initial: today },
            { name: "amount", label: C.amount, kind: "amount", required: true },
            { name: "currency", label: C.currency, kind: "currency", required: true, initial: f.primaryCurrency, options: [{ value: f.primaryCurrency, label: f.primaryCurrency }] },
            { name: "note", label: C.note, kind: "text" },
          ]}
          onSubmit={(v) => addProjectFundingAction(projectId, v)} />
      )}
    </section>
  );
}
