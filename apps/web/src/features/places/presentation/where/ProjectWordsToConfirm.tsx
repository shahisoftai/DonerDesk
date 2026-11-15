"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { confirmPlaceWordAction } from "@/lib/actions/place-tree";
import { useActionState } from "@/lib/client/action-state";
import { useHydrated } from "@/lib/client/use-hydrated";
import { Button } from "@/components/ui/Button";
import type { ProjectPlacesDto } from "@/lib/server/schemas-place-tree";
import { PlacePicker, type PickerPlace } from "../picker/PlacePicker";

/**
 * This project's typed location words that no place answers to, or that several do (Phase 56). Confirming a word links every record of the
 * project that carries it, once; the word then leaves this list. Nothing typed is rewritten.
 */
export function ProjectWordsToConfirm({ projectId, data, choices }: { projectId: string; data: ProjectPlacesDto; choices: PickerPlace[] }) {
  const router = useRouter();
  const state = useActionState();
  const hydrated = useHydrated();
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const mine = useMemo(() => new Set([...data.forNewWork, ...data.sites.map((s) => s.id)]), [data]);

  async function confirm(word: string, placeId: string) {
    const r = await state.run(() => confirmPlaceWordAction(projectId, { word, placeId }));
    if (r) { setNote(`"${word}" confirmed: ${r.linked} ${r.linked === 1 ? "record" : "records"} now point at that place.`); setOpen(null); router.refresh(); }
  }

  if (data.unconfirmed.length === 0) return <p className="text-sm text-slate-600 dark:text-slate-300">Every place typed on this project is matched to a place.</p>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600 dark:text-slate-300">Words typed on this project that no place answers to yet, most used first. Say which place each one means.</p>
      <ul className="space-y-3">
        {data.unconfirmed.map((w) => (
          <li key={w.text} className="rounded-md border border-slate-200 p-3 text-sm dark:border-white/10">
            <p><b>{w.text}</b> <span className="text-xs text-slate-500">typed {w.count} {w.count === 1 ? "time" : "times"}{w.status === "AMBIGUOUS" ? " · more than one place has this name" : ""}</span></p>
            {data.canEdit && (
              <div className="mt-2 flex flex-wrap gap-2">
                {w.candidates.map((c) => <Button key={c.id} type="button" size="sm" variant="secondary" disabled={!hydrated || state.busy} onClick={() => void confirm(w.text, c.id)}>{c.path}</Button>)}
                {open !== w.text && <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(w.text)}>{w.candidates.length ? "Another place…" : "Choose the place…"}</Button>}
              </div>
            )}
            {open === w.text && <div className="mt-2"><PlacePicker projectId={projectId} choices={choices} projectIds={mine} chosen={[]} disabled={!hydrated || state.busy} onChoose={(c) => void confirm(w.text, c.id)} /></div>}
          </li>
        ))}
      </ul>
      {note && <p role="status" className="text-sm">{note}</p>}
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
    </div>
  );
}
