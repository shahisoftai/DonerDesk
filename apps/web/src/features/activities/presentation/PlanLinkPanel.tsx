"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateActivityAction } from "@/lib/actions/activities";
import { useActionState } from "@/lib/client/action-state";
import { useToast } from "@/components/feedback/Toast";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";

/**
 * Which planned activity a completed one delivers. It is shown on every record; it can be changed only while the record can still be
 * edited (an accepted record is sent back for revision first), and the choice is never made for the person.
 */
export function PlanLinkPanel({
  activityId,
  current,
  options,
  canEdit,
  lockedReason,
}: {
  activityId: string;
  /** The planned activity it delivers now, in words. Undefined when it is not linked. */
  current?: string | undefined;
  options: Array<{ id: string; label: string; selected: boolean }>;
  canEdit: boolean;
  /** Why it cannot be changed, when it cannot. */
  lockedReason?: string | undefined;
}) {
  const router = useRouter();
  const toast = useToast();
  const state = useActionState();
  const [value, setValue] = useState(options.find((o) => o.selected)?.id ?? "");

  async function save() {
    if (!value) return;
    const done = await state.run(() => updateActivityAction({ activityId, patch: { plannedActivityId: value } }));
    if (done) {
      toast.push({ title: "Planned activity linked", tone: "success" });
      router.refresh();
    }
  }

  return (
    <section className="card" aria-label="Planned activity this delivers">
      <h2 className="text-sm font-medium text-slate-700 dark:text-slate-200">Planned activity it delivers</h2>
      <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{current ?? "Not linked to a planned activity."}</p>
      {canEdit ? (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1">
            <label htmlFor="plan-link" className="block text-xs text-slate-500 dark:text-slate-400">{current ? "Change to" : "Link to"}</label>
            <Select id="plan-link" value={value} onChange={(e) => setValue(e.target.value)}>
              <option value="">Choose a planned activity…</option>
              {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </Select>
          </div>
          <Button size="sm" variant="secondary" onClick={save} pending={state.busy} disabled={!value || options.find((o) => o.selected)?.id === value}>Save link</Button>
        </div>
      ) : lockedReason ? (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{lockedReason}</p>
      ) : null}
      {state.error && <p role="alert" className="mt-2 text-sm text-danger-600">{state.error}</p>}
    </section>
  );
}
