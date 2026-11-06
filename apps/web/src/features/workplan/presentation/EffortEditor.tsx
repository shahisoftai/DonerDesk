"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updatePlannedActivityAction } from "@/lib/actions/workplan";
import { useActionState } from "@/lib/client/action-state";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";

const LEVELS: Array<{ value: number; label: string }> = [
  { value: 1, label: "1 · Light, a normal activity" },
  { value: 2, label: "2 · Some effort" },
  { value: 3, label: "3 · Takes a good part of the week" },
  { value: 4, label: "4 · Heavy" },
  { value: 5, label: "5 · Takes most of the week" },
];

/** How heavy this activity is for the person who leads it. The workload view adds these up per week. */
export function EffortEditor({ itemId, current, canEdit }: { itemId: string; current: number; canEdit: boolean }) {
  const router = useRouter();
  const state = useActionState();
  const [value, setValue] = useState(current);

  async function save() {
    const done = await state.run(() => updatePlannedActivityAction(itemId, { effort: value }));
    if (done === true) router.refresh();
  }

  return (
    <section aria-labelledby="effort-title" className="space-y-2">
      <h2 id="effort-title" className="text-sm font-semibold">Effort</h2>
      {!canEdit ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">{LEVELS.find((l) => l.value === current)?.label ?? String(current)}</p>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label htmlFor="effort" className="block text-sm">How heavy is it for the lead?</label>
            <Select id="effort" value={String(value)} onChange={(e) => setValue(Number(e.target.value))}>
              {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </Select>
          </div>
          <Button size="sm" onClick={save} pending={state.busy} disabled={value === current}>Save</Button>
        </div>
      )}
      {state.error && <p role="alert" className="text-sm text-danger-600">{state.error}</p>}
    </section>
  );
}
