"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { bulkPlanAction } from "@/lib/actions/workplan";
import type { BulkPlanResult } from "@/lib/server/schemas";
import { useActionState } from "@/lib/client/action-state";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

/**
 * Change several selected activities at once (phase 28.1-L): move them by N days, or give them the same lead. Every change is
 * previewed first; nothing is saved until "Apply". A refusal names the reason and changes nothing.
 */
export function BulkPlanBar({ projectId, selected, leads, onClear }: {
  projectId: string;
  selected: string[];
  leads: Array<{ id: string; label: string }>;
  onClear: () => void;
}) {
  const router = useRouter();
  const state = useActionState();
  const [days, setDays] = useState("");
  const [lead, setLead] = useState("");
  const [status, setStatus] = useState<"" | "START" | "CANCEL">("");
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<BulkPlanResult | null>(null);
  const [pendingInput, setPendingInput] = useState<Record<string, unknown> | null>(null);

  async function run(input: Record<string, unknown>, apply: boolean) {
    const done = await state.run(() => bulkPlanAction(projectId, { ids: selected, ...input, ...(reason.trim() ? { reason } : {}), apply }));
    if (!done) return;
    if (apply) { setPreview(null); setPendingInput(null); onClear(); router.refresh(); } else { setPreview(done); setPendingInput(input); }
  }

  return (
    <section aria-label="Change selected activities" className="space-y-3 rounded-xl border border-brand-300 bg-brand-50 p-3 dark:border-brand-500/40 dark:bg-brand-500/10">
      <p className="text-sm font-medium">{selected.length} selected</p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label htmlFor="bulk-days" className="block text-xs">Move by (days, minus to go back)</label>
          <Input id="bulk-days" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} className="w-32" />
        </div>
        <Button size="sm" variant="secondary" disabled={state.busy || !/^-?\d+$/.test(days.trim())} onClick={() => run({ action: { kind: "SHIFT", days: Number(days) } }, false)}>Preview move</Button>
        <div className="space-y-1">
          <label htmlFor="bulk-lead" className="block text-xs">Same lead for all</label>
          <Select id="bulk-lead" value={lead} onChange={(e) => setLead(e.target.value)}>
            <option value="">Choose a lead</option>
            <option value="__none__">No lead</option>
            {leads.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </Select>
        </div>
        <Button size="sm" variant="secondary" disabled={state.busy || !lead} onClick={() => run({ action: { kind: "SET_LEAD", leadUserId: lead === "__none__" ? null : lead } }, false)}>Preview lead</Button>
        <div className="space-y-1">
          <label htmlFor="bulk-status" className="block text-xs">Change status</label>
          <Select id="bulk-status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="">Choose</option>
            <option value="START">Start (under way)</option>
            <option value="CANCEL">Cancel (needs a reason)</option>
          </Select>
        </div>
        <Button size="sm" variant="secondary" disabled={state.busy || !status} onClick={() => run({ action: { kind: "SET_STATUS", status } }, false)}>Preview status</Button>
        <div className="space-y-1">
          <label htmlFor="bulk-reason" className="block text-xs">Why (if a report uses these dates, or to cancel)</label>
          <Input id="bulk-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <Button size="sm" variant="secondary" onClick={onClear}>Clear selection</Button>
      </div>

      {state.error && <p role="alert" className="text-sm text-danger-600">{state.error}</p>}
      {preview && (
        <div className="space-y-2 rounded-lg bg-white p-3 text-sm dark:bg-slate-900/40" role="region" aria-label="Preview of the change">
          <ul className="space-y-1">
            {preview.preview.map((r) => <li key={r.id}>{r.title}: <span className="text-slate-500">{r.before}</span> → <b>{r.after}</b></li>)}
          </ul>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => pendingInput && run(pendingInput, true)} pending={state.busy}>Apply to {preview.preview.length}</Button>
            <Button size="sm" variant="secondary" onClick={() => setPreview(null)}>Cancel</Button>
          </div>
        </div>
      )}
    </section>
  );
}
