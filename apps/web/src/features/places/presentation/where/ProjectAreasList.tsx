"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setProjectAreaOpenAction } from "@/lib/actions/place-tree";
import { useActionState } from "@/lib/client/action-state";
import { useHydrated } from "@/lib/client/use-hydrated";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import type { ProjectPlacesDto } from "@/lib/server/schemas-place-tree";

/**
 * This project's areas as a list (Phase 56): how many of its records each holds, and Close / Reopen. An area with records cannot be unticked;
 * closing it stops new work there and keeps everything recorded (it still counts in results and maps).
 */
export function ProjectAreasList({ projectId, areas, canEdit, closeFor }: { projectId: string; areas: ProjectPlacesDto["areas"]; canEdit: boolean; closeFor?: string | null }) {
  const router = useRouter();
  const state = useActionState();
  const hydrated = useHydrated();
  const [closing, setClosing] = useState<string | null>(closeFor ?? null);
  const [reason, setReason] = useState("");

  async function setOpen(placeId: string, open: boolean) {
    const done = await state.run(() => setProjectAreaOpenAction(projectId, placeId, open ? { open: true } : { open: false, reason }));
    if (done) { setClosing(null); setReason(""); router.refresh(); }
  }

  if (areas.length === 0) return <p className="text-sm text-slate-600 dark:text-slate-300">No areas yet. Tick the areas where this project works on the map above.</p>;
  return (
    <section aria-labelledby="areas-list" className="space-y-2">
      <h2 id="areas-list" className="section-title">This project&apos;s areas</h2>
      <ul className="divide-y divide-slate-200 dark:divide-white/10">
        {areas.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <div>
              <a className="link font-medium" href={`/places/${a.id}`}>{a.path}</a>
              <span className="ms-2 text-xs text-slate-500">{a.records === 0 ? "no records yet" : `${a.records} ${a.records === 1 ? "record" : "records"}`}</span>
              {a.closed && <span className="ms-2 rounded bg-slate-100 px-1.5 text-xs dark:bg-white/10">Closed{a.closedReason ? `: ${a.closedReason}` : ""}</span>}
            </div>
            {canEdit && (a.closed
              ? <Button type="button" size="sm" variant="secondary" disabled={!hydrated || state.busy} onClick={() => void setOpen(a.id, true)}>Reopen</Button>
              : closing === a.id
                ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <Field label="Why did the project stop working here?"><Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} /></Field>
                    <Button type="button" size="sm" disabled={!hydrated || state.busy || reason.trim().length < 3} onClick={() => void setOpen(a.id, false)}>Close area</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setClosing(null)}>Cancel</Button>
                  </div>
                )
                : <Button type="button" size="sm" variant="ghost" onClick={() => setClosing(a.id)}>Close…</Button>)}
          </li>
        ))}
      </ul>
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
    </section>
  );
}
