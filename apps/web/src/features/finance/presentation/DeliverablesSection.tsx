"use client";

import { useRouter } from "next/navigation";
import { addDeliverableAction, approveDeliverableAction, payDeliverableAction } from "@/lib/actions/finance";
import { useActionState } from "@/lib/client/action-state";
import type { ProjectFinance } from "@/lib/server/schemas-finance";
import { Badge } from "@/components/data/Badge";
import { FINANCE_COPY as C } from "../domain/finance-copy";
import { DELIVERABLE_STATE_LABEL, formatMoney } from "../domain/finance-view";
import { EntryForm } from "./EntryForm";

const TONE = { WAITING: "neutral", OVERDUE: "danger", APPROVED: "info", PAID: "success" } as const;

export function DeliverablesSection({ projectId, f, canEdit, canApprove, today }: { projectId: string; f: ProjectFinance; canEdit: boolean; canApprove: boolean; today: string }) {
  const router = useRouter();
  const act = useActionState();
  const run = async (fn: () => Promise<Parameters<typeof act.run>[0] extends () => Promise<infer R> ? R : never>) => { if (await act.run(fn as never)) router.refresh(); };
  return (
    <section aria-labelledby="fin-deliverables" className="space-y-3">
      <h2 id="fin-deliverables" className="text-base font-semibold">{C.deliverablesTitle}</h2>
      {f.deliverables.length === 0 ? <p className="text-sm text-slate-500">{C.deliverablesEmpty}</p> : (
        <ul className="space-y-2">
          {f.deliverables.map((d) => (
            <li key={d.id} className="card flex flex-wrap items-center justify-between gap-2 text-sm">
              <div>
                <span className="font-medium">{d.name}</span>
                <span className="ms-2 tabular-nums">{formatMoney(d.amount)}</span>
                <span className="block text-xs text-slate-500">{C.due} {d.dueOn}{d.paidOn ? ` · ${C.paidOn} ${d.paidOn}` : ""}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={TONE[d.state as keyof typeof TONE] ?? "neutral"}>{DELIVERABLE_STATE_LABEL[d.state] ?? d.state}</Badge>
                {canApprove && (d.state === "WAITING" || d.state === "OVERDUE") && <button type="button" className="text-xs font-medium text-brand-700 hover:underline disabled:opacity-50 dark:text-brand-300" disabled={act.busy} onClick={() => void run(() => approveDeliverableAction(projectId, d.id) as never)}>{C.approve}</button>}
                {canEdit && d.state === "APPROVED" && <button type="button" className="text-xs font-medium text-brand-700 hover:underline disabled:opacity-50 dark:text-brand-300" disabled={act.busy} onClick={() => void run(() => payDeliverableAction(projectId, d.id, { on: today }) as never)}>{C.markPaid}</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {act.error && <p role="alert" className="text-sm text-danger-600">{act.error}</p>}
      {canEdit && (
        <EntryForm title={C.addDeliverable} submit={C.addDeliverable}
          fields={[
            { name: "name", label: C.deliverable, kind: "text", required: true },
            { name: "amount", label: C.amount, kind: "amount", required: true },
            { name: "currency", label: C.currency, kind: "currency", required: true, initial: f.primaryCurrency, options: [{ value: f.primaryCurrency, label: f.primaryCurrency }] },
            { name: "dueOn", label: C.due, kind: "date", required: true, initial: today },
          ]}
          onSubmit={(v) => addDeliverableAction(projectId, v)} />
      )}
    </section>
  );
}
