"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addDisbursementAction, addExpenseAction, decideEntryAction } from "@/lib/actions/finance";
import { useActionState } from "@/lib/client/action-state";
import type { ProjectFinance } from "@/lib/server/schemas-finance";
import { Badge } from "@/components/data/Badge";
import { FINANCE_COPY as C } from "../domain/finance-copy";
import { ENTRY_STATUS_LABEL, formatMoney } from "../domain/finance-view";
import { EntryForm } from "./EntryForm";

const TONE = { DRAFT: "warning", APPROVED: "success", REJECTED: "danger" } as const;

/** Expenses and money received in date order with the running balance per currency; a draft waits for someone who may approve it. */
export function RegisterSection({ projectId, f, canEnterExpense, canEnterMoney, today }: { projectId: string; f: ProjectFinance; canEnterExpense: boolean; canEnterMoney: boolean; today: string }) {
  const router = useRouter();
  const decide = useActionState();
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const sources = f.sources.filter((s) => !s.archived).map((s) => ({ value: s.id, label: s.name }));
  const lineOptions = f.budgetLines.map((l) => ({ value: l.lineId, label: `${l.code}${l.description ? ` ${l.description}` : ""}` }));
  const [lineId, setLineId] = useState(lineOptions[0]?.value ?? "");

  async function go(kind: "EXPENSE" | "DISBURSEMENT", id: string, decision: "APPROVED" | "REJECTED") {
    const out = await decide.run(() => decideEntryAction(projectId, kind, id, { decision, ...(decision === "REJECTED" ? { note: reason } : {}) }));
    if (out) { setRejecting(null); setReason(""); router.refresh(); }
  }

  return (
    <section aria-labelledby="fin-register" className="space-y-3">
      <h2 id="fin-register" className="text-base font-semibold">{C.registerTitle}</h2>
      {f.totals.unclassifiedExpenses > 0 && <p className="text-xs text-slate-500">{C.unclassified(f.totals.unclassifiedExpenses)}</p>}
      {f.totals.withoutEvidence > 0 && <p className="text-xs text-slate-500">{C.withoutFile(f.totals.withoutEvidence)}</p>}
      {f.register.length === 0 ? <p className="text-sm text-slate-500">{C.registerEmpty}</p> : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-white/10">
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500"><th className="px-3 py-2">{C.date}</th><th className="px-3 py-2">{C.memo}</th><th className="px-3 py-2">{C.amount}</th><th className="px-3 py-2">{C.balance}</th><th className="px-3 py-2">{C.age}</th><th className="px-3 py-2" /></tr></thead>
            <tbody>
              {f.register.map((r) => (
                <tr key={r.id} className="border-t border-slate-200 align-top dark:border-white/10">
                  <td className="px-3 py-2 whitespace-nowrap">{r.date}</td>
                  <td className="px-3 py-2">
                    <span className="text-xs text-slate-500">{r.kind === "EXPENSE" ? C.kindExpense : C.kindDisbursement}</span> {r.memo || r.vendor}
                    {r.vendor && r.memo && r.vendor !== r.memo && <span className="block text-xs text-slate-500">{C.vendor}: {r.vendor}</span>}
                    {r.kind === "EXPENSE" && !r.hasEvidence && r.status === "APPROVED" && <span className="block text-xs text-slate-500">{C.noFile}</span>}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{r.kind === "DISBURSEMENT" ? "+" : "-"} {formatMoney(r.amount)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatMoney({ minor: r.balanceMinor, currency: r.amount.currency })}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs">{C.days(r.ageDays)}</td>
                  <td className="px-3 py-2">
                    <Badge tone={TONE[r.status as keyof typeof TONE] ?? "neutral"}>{ENTRY_STATUS_LABEL[r.status] ?? r.status}</Badge>
                    {r.canDecide && (
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <button type="button" className="text-xs font-medium text-brand-700 hover:underline disabled:opacity-50 dark:text-brand-300" disabled={decide.busy} onClick={() => void go(r.kind, r.id, "APPROVED")}>{C.approve}</button>
                        <button type="button" className="text-xs font-medium text-danger-700 hover:underline disabled:opacity-50 dark:text-danger-300" disabled={decide.busy} onClick={() => setRejecting(rejecting === r.id ? null : r.id)}>{C.reject}</button>
                      </div>
                    )}
                    {rejecting === r.id && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <input aria-label={C.rejectReason} placeholder={C.rejectReason} className="input max-w-56" value={reason} onChange={(e) => setReason(e.target.value)} />
                        <button type="button" className="text-xs font-medium underline disabled:opacity-50" disabled={decide.busy || reason.trim() === ""} onClick={() => void go(r.kind, r.id, "REJECTED")}>{C.reject}</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {decide.error && <p role="alert" className="text-sm text-danger-600">{decide.error}</p>}
      {canEnterExpense && lineOptions.length > 0 && (
        <div>
          <label className="mt-1 block text-xs font-medium">{C.budgetLine}
            <select className="input ms-2 w-auto" value={lineId} onChange={(e) => setLineId(e.target.value)}>{lineOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
          </label>
          <EntryForm title={C.addExpense} submit={C.addExpense}
            fields={[
              { name: "date", label: C.date, kind: "date", required: true, initial: today },
              { name: "vendor", label: C.vendor, kind: "text", required: true },
              { name: "amount", label: C.amount, kind: "amount", required: true },
              { name: "memo", label: C.memo, kind: "text" },
              { name: "fundingSourceId", label: C.fundingSourceOptional, kind: "select", options: sources },
            ]}
            onSubmit={(v) => addExpenseAction(projectId, lineId, v)} />
        </div>
      )}
      {canEnterMoney && (
        <EntryForm title={C.addDisbursement} submit={C.addDisbursement}
          fields={[
            { name: "fundingSourceId", label: C.fundingSource, kind: "select", required: true, options: sources },
            { name: "date", label: C.date, kind: "date", required: true, initial: today },
            { name: "amount", label: C.amount, kind: "amount", required: true },
            { name: "currency", label: C.currency, kind: "currency", required: true, initial: f.primaryCurrency, options: [{ value: f.primaryCurrency, label: f.primaryCurrency }] },
            { name: "memo", label: C.memo, kind: "text" },
          ]}
          onSubmit={(v) => addDisbursementAction(projectId, v)} />
      )}
    </section>
  );
}
