"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { completePlannedActivityAction } from "@/lib/actions/workplan";
import { useActionState } from "@/lib/client/action-state";
import { useHydrated } from "@/lib/client/use-hydrated";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";

/**
 * Done in one step. The short form asks the day it finished, how many people were reached (blank is fine) and an optional note.
 * Saving records the completed activity the reports use and marks the plan item done together; a refusal changes nothing and
 * says why (for example, no reporting period covers that day).
 */
export function MarkDoneButton({ itemId, title, today, size = "sm" }: { itemId: string; title: string; today: string; size?: "sm" | "md" }) {
  const router = useRouter();
  const state = useActionState();
  const hydrated = useHydrated();
  const dialog = useRef<HTMLDialogElement>(null);
  const [finishedOn, setFinishedOn] = useState(today);
  const [people, setPeople] = useState("");
  const [note, setNote] = useState("");
  const id = `done-${itemId}`;

  async function save() {
    const done = await state.run(() => completePlannedActivityAction(itemId, { finishedOn, ...(people.trim() ? { people } : {}), ...(note.trim() ? { note } : {}) }));
    if (done) { dialog.current?.close(); router.refresh(); }
  }

  return (
    <>
      <Button size={size} onClick={() => { setFinishedOn(today); dialog.current?.showModal(); }}>Done</Button>
      <dialog ref={dialog} aria-labelledby={`${id}-title`} className="w-[min(480px,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/40 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100">
        <div className="space-y-4 p-5">
          <h3 id={`${id}-title`} className="text-lg font-semibold">Mark &ldquo;{title}&rdquo; as done</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1"><label htmlFor={`${id}-date`} className="block text-sm font-medium">Finished on</label>
              <Input id={`${id}-date`} type="date" max={today} value={finishedOn} onChange={(e) => setFinishedOn(e.target.value)} /></div>
            <div className="space-y-1"><label htmlFor={`${id}-people`} className="block text-sm font-medium">People reached</label>
              <Input id={`${id}-people`} inputMode="numeric" value={people} placeholder="Leave blank if not counted" onChange={(e) => setPeople(e.target.value)} /></div>
          </div>
          <div className="space-y-1"><label htmlFor={`${id}-note`} className="block text-sm font-medium">What happened (optional)</label>
            <Textarea id={`${id}-note`} rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <p className="text-xs text-slate-500">This records the completed activity for your reports and marks the plan item done.</p>
          {state.error && <p role="alert" className="text-sm text-danger-600">{state.error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => dialog.current?.close()}>Cancel</Button>
            <Button onClick={save} pending={state.busy} disabled={!hydrated || !finishedOn}>Mark done</Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
