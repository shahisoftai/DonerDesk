"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { setPlanPlacesAction } from "@/lib/actions/workplan";
import { useActionState } from "@/lib/client/action-state";
import { useHydrated } from "@/lib/client/use-hydrated";
import type { PlanPlaces } from "@/lib/server/schemas-places";
import { PlacePicker, type PickerPlace } from "@/features/places/presentation/picker/PlacePicker";

export type PlaceChoice = PickerPlace;

const MAX_PLACES = 25;

/**
 * The places this planned activity takes place in (Phase 42.1, picker from Phase 56): this project's places first, a new place added inline.
 * Several are allowed; each is saved as soon as it is chosen or removed. The typed location above is a separate note and is never changed here.
 */
export function ActivityPlaces({ itemId, projectId, linked, choices, projectIds, canEdit }: { itemId: string; projectId: string; linked: PlanPlaces["places"]; choices: PlaceChoice[]; projectIds: readonly string[]; canEdit: boolean }) {
  const router = useRouter();
  const state = useActionState();
  const hydrated = useHydrated();
  const mine = useMemo(() => new Set(projectIds), [projectIds]);

  const linkedIds = useMemo(() => linked.map((p) => p.id), [linked]);
  async function save(next: string[]) {
    const done = await state.run(() => setPlanPlacesAction(itemId, next));
    if (done) router.refresh();
  }

  if (linked.length === 0 && !canEdit) return null;
  return (
    <section aria-labelledby="places-title" className="space-y-2">
      <h2 id="places-title" className="text-sm font-semibold">Places</h2>
      <p className="text-xs text-slate-500">Where this activity takes place. Several are allowed; this project&apos;s places are offered first.</p>
      {linked.length === 0 ? (
        <p className="text-sm">No places chosen yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-2 text-sm">
          {linked.map((p) => (
            <li key={p.id} className="flex items-center gap-1 rounded-full border border-slate-300 px-2 py-0.5 dark:border-white/15">
              <span title={p.path}>{p.name}{p.archived && " (retired)"}</span>
              {canEdit && (
                <button type="button" className="text-xs text-slate-500 hover:text-slate-900 disabled:opacity-50 dark:hover:text-white" aria-label={`Remove ${p.name}`} disabled={!hydrated || state.busy} onClick={() => save(linkedIds.filter((id) => id !== p.id))}>×</button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <>
          <PlacePicker projectId={projectId} choices={choices} projectIds={mine} chosen={linkedIds} max={MAX_PLACES} disabled={!hydrated || state.busy} onChoose={(c) => void save([...linkedIds, c.id])} />
          {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
        </>
      )}
    </section>
  );
}
