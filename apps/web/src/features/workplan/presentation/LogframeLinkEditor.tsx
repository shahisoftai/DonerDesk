"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updatePlannedActivityAction } from "@/lib/actions/workplan";
import { useActionState } from "@/lib/client/action-state";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";

export interface LogframeActivityOption { id: string; label: string }

/**
 * The logframe activity this planned activity belongs to, and the means to change it. The server checks the new one is an activity
 * of this project and refuses the change once completed activities are recorded against this one; the message says so.
 */
export function LogframeLinkEditor({ itemId, current, options, canEdit }: { itemId: string; current: string | undefined; options: LogframeActivityOption[]; canEdit: boolean }) {
  const router = useRouter();
  const state = useActionState();
  const [value, setValue] = useState(current ?? "");

  async function save() {
    const done = await state.run(() => updatePlannedActivityAction(itemId, { logframeActivityId: value === "" ? null : value }));
    if (done === true) router.refresh();
  }

  const shown = options.find((o) => o.id === current)?.label;
  return (
    <section aria-labelledby="lf-link-title" className="space-y-2">
      <h2 id="lf-link-title" className="text-sm font-semibold">Logframe activity</h2>
      {!canEdit ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">{shown ?? "Not linked."}</p>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label htmlFor="lf-link" className="block text-sm">Belongs to</label>
            <Select id="lf-link" value={value} onChange={(e) => setValue(e.target.value)}>
              <option value="">Not linked</option>
              {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </Select>
          </div>
          <Button size="sm" onClick={save} pending={state.busy} disabled={value === (current ?? "")}>Save</Button>
        </div>
      )}
      {state.error && <p role="alert" className="text-sm text-danger-600">{state.error}</p>}
    </section>
  );
}
