"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setEntryDueDaysAction } from "@/lib/actions/entry-due-days";
import { useActionState } from "@/lib/client/action-state";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

/**
 * When indicator values are due: this many days after a period ends. Late values feed the project's delivery health and the daily
 * reminders. The server accepts a whole number from 0 to 60 and says so when it does not.
 */
export function EntryDueDaysCard({ projectId, days }: { projectId: string; days: number }) {
  const router = useRouter();
  const state = useActionState();
  const [value, setValue] = useState(String(days));
  const parsed = /^\d+$/.test(value.trim()) ? Number(value) : null;

  async function save() {
    if (parsed === null) return;
    const done = await state.run(() => setEntryDueDaysAction(projectId, parsed));
    if (done) router.refresh();
  }

  return (
    <section aria-labelledby="due-days-title" className="space-y-2">
      <h3 id="due-days-title" className="text-base font-semibold">When indicator values are due</h3>
      <p className="text-sm text-slate-600 dark:text-slate-300">A value is due this many days after its period ends. After that it counts as late.</p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label htmlFor="due-days" className="block text-sm">Days after the period ends</label>
          <Input id="due-days" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} className="w-28" />
        </div>
        <Button size="sm" onClick={save} pending={state.busy} disabled={parsed === null || parsed === days}>Save</Button>
      </div>
      {state.error && <p role="alert" className="text-sm text-danger-600">{state.error}</p>}
    </section>
  );
}
