"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { setRecordPlacesAction, tickProjectAreaAction } from "@/lib/actions/place-tree";
import { useActionState } from "@/lib/client/action-state";
import { useHydrated } from "@/lib/client/use-hydrated";
import type { RecordPlacesDto } from "@/lib/server/schemas-place-tree";
import { PlacePicker, type PickerPlace } from "./PlacePicker";

const SOURCE_WORD: Record<RecordPlacesDto["places"][number]["source"], string> = {
  INHERITED: "from its plan",
  CHOSEN: "",
  CONFIRMED: "from the words typed",
  GPS: "from the phone's location",
};
const NOUN = { ACTIVITY: "activity", EVIDENCE: "file", BENEFICIARY: "person" } as const;

/**
 * Where a completed activity, a file or a person was (Phase 56). Shows the stored places, or the parent's when this record has none (marked as
 * coming from its plan); a place outside the project's areas is named with a one-click "add the area". Saving replaces the record's places.
 */
export function RecordPlacesEditor({ projectId, kind, recordId, data, choices, projectIds }: {
  projectId: string;
  kind: "ACTIVITY" | "EVIDENCE" | "BENEFICIARY";
  recordId: string;
  data: RecordPlacesDto;
  choices: PickerPlace[];
  projectIds: readonly string[];
}) {
  const router = useRouter();
  const state = useActionState();
  const hydrated = useHydrated();
  const [note, setNote] = useState<string | null>(null);
  const mine = useMemo(() => new Set(projectIds), [projectIds]);
  const ids = data.places.map((p) => p.id);

  async function save(next: string[]) {
    setNote(null);
    const r = await state.run(() => setRecordPlacesAction(projectId, kind, recordId, { placeIds: next }));
    if (r) { if (r.outside.length) setNote("Some of these places are outside this project's areas. That is allowed; add the area below if the project now works there."); router.refresh(); }
  }
  async function extend(placeId: string) {
    const r = await state.run(() => tickProjectAreaAction(projectId, { placeId }));
    if (r) router.refresh();
  }

  if (data.places.length === 0 && !data.canEdit) return null;
  return (
    <section aria-labelledby={`places-${recordId}`} className="space-y-2">
      <h2 id={`places-${recordId}`} className="text-sm font-semibold">Places</h2>
      {data.typed && <p className="text-xs text-slate-500">Typed as: {data.typed}</p>}
      {data.places.length === 0 ? <p className="text-sm">No place chosen yet.</p> : (
        <ul className="space-y-1 text-sm">
          {data.places.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2">
              <a className="link" href={`/places/${p.id}`} title={p.path}>{p.path}</a>
              {SOURCE_WORD[p.source] && <span className="rounded bg-slate-100 px-1.5 text-xs dark:bg-white/10">{SOURCE_WORD[p.source]}</span>}
              {p.footprint === "OUTSIDE" && <span className="text-xs text-amber-700 dark:text-amber-300">Outside this project&apos;s areas</span>}
              {p.footprint === "OUTSIDE" && p.extension && data.canEdit && <button type="button" className="text-xs underline" disabled={!hydrated || state.busy} onClick={() => void extend(p.extension!.placeId)}>Add {p.extension.name} to this project</button>}
              {data.canEdit && <button type="button" className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white" aria-label={`Remove ${p.name}`} disabled={!hydrated || state.busy} onClick={() => void save(ids.filter((x) => x !== p.id))}>×</button>}
            </li>
          ))}
        </ul>
      )}
      {data.inherited && data.canEdit && <p className="text-xs text-slate-500">These come from the planned activity. Change them if this {NOUN[kind]} happened somewhere else.</p>}
      {data.canEdit && <PlacePicker projectId={projectId} choices={choices} projectIds={mine} chosen={ids} max={data.max} disabled={!hydrated || state.busy} onChoose={(c) => void save(data.many ? [...ids, c.id] : [c.id])} />}
      {note && <p role="status" className="text-sm text-amber-700 dark:text-amber-300">{note}</p>}
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
    </section>
  );
}
