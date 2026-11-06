"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { suggestRequiredFiles } from "@donordesk/domain/contexts/workplan/index.js";
import { updatePlannedActivityAction } from "@/lib/actions/workplan";
import { useActionState } from "@/lib/client/action-state";
import { useHydrated } from "@/lib/client/use-hydrated";
import { Button } from "@/components/ui/Button";
import { fileWords, requirableTypes, stillNeededLine } from "../domain/file-needs-view";

/**
 * "Files we will need" on a planned activity: what should prove it, and what no completed activity has shown yet. People who
 * can edit the activity can change the list; everyone else reads it. Nothing here blocks accepting or submitting anything.
 */
export function RequiredFilesEditor({ itemId, title, required, stillNeeded, canEdit }: { itemId: string; title: string; required: string[]; stillNeeded: string[]; canEdit: boolean }) {
  const router = useRouter();
  const state = useActionState();
  const hydrated = useHydrated();
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<string[]>(required);

  async function save() {
    const done = await state.run(() => updatePlannedActivityAction(itemId, { requiredFiles: files }));
    if (done === true) { setOpen(false); router.refresh(); }
  }

  if (required.length === 0 && !canEdit) return null;
  return (
    <section aria-labelledby="files-title" className="space-y-2">
      <h2 id="files-title" className="text-sm font-semibold">Files we will need</h2>
      {!open && (
        <>
          <p className="text-sm text-slate-600 dark:text-slate-300">{required.length === 0 ? "None asked for." : fileWords(required)}</p>
          {stillNeeded.length > 0 && <p role="status" className="text-sm font-medium text-amber-700 dark:text-amber-400">{stillNeededLine(stillNeeded)}</p>}
          {canEdit && (
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => { setFiles(required); setOpen(true); }}>Change</Button>
              {required.length === 0 && suggestRequiredFiles(title).length > 0 && (
                <Button size="sm" variant="secondary" disabled={!hydrated || state.busy} onClick={() => { setFiles(suggestRequiredFiles(title)); setOpen(true); }}>Suggest from the title</Button>
              )}
            </div>
          )}
        </>
      )}
      {open && (
        <div className="max-w-md space-y-2 rounded-xl border border-slate-200 p-3 dark:border-white/10">
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {requirableTypes().map((t) => (
              <label key={t.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4" checked={files.includes(t.id)} onChange={(e) => setFiles(e.target.checked ? [...new Set([...files, t.id])] : files.filter((f) => f !== t.id))} />{t.label}
              </label>
            ))}
          </div>
          {state.error && <p role="alert" className="text-sm text-danger-600">{state.error}</p>}
          <div className="flex gap-2"><Button size="sm" onClick={save} pending={state.busy} disabled={!hydrated}>Save</Button><Button size="sm" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button></div>
        </div>
      )}
    </section>
  );
}
