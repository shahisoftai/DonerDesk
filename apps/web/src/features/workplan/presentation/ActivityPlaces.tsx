"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { setPlanPlacesAction } from "@/lib/actions/workplan";
import { useActionState } from "@/lib/client/action-state";
import { useHydrated } from "@/lib/client/use-hydrated";
import type { PlanPlaces } from "@/lib/server/schemas-places";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export interface PlaceChoice {
  id: string;
  name: string;
  path: string;
}

const MAX_PLACES = 25;

/**
 * The places from the organisation's list this activity takes place in. Several are allowed; each is saved as soon as it is chosen or removed.
 * The typed location above is a separate note and is never changed here.
 */
export function ActivityPlaces({ itemId, linked, choices, canEdit }: { itemId: string; linked: PlanPlaces["places"]; choices: PlaceChoice[]; canEdit: boolean }) {
  const router = useRouter();
  const state = useActionState();
  const hydrated = useHydrated();
  const [query, setQuery] = useState("");

  const linkedIds = useMemo(() => linked.map((p) => p.id), [linked]);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return choices.filter((c) => !linkedIds.includes(c.id) && c.path.toLowerCase().includes(q)).slice(0, 8);
  }, [query, choices, linkedIds]);

  async function save(next: string[]) {
    const done = await state.run(() => setPlanPlacesAction(itemId, next));
    if (done) router.refresh();
  }

  if (linked.length === 0 && !canEdit) return null;
  return (
    <section aria-labelledby="places-title" className="space-y-2">
      <h2 id="places-title" className="text-sm font-semibold">Places</h2>
      <p className="text-xs text-slate-500">Where this activity takes place, from your places list. Several are allowed.</p>
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
        <div className="space-y-1">
          <label htmlFor="place-search" className="text-xs text-slate-500">Add a place</label>
          <div className="flex flex-wrap items-center gap-2">
            <Input id="place-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your places" className="max-w-64" disabled={linkedIds.length >= MAX_PLACES} />
            <a className="text-xs underline" href="/settings/places">Add a new place</a>
          </div>
          {matches.length > 0 && (
            <ul className="flex flex-col items-start gap-1">
              {matches.map((c) => (
                <li key={c.id}>
                  <Button type="button" variant="secondary" disabled={!hydrated || state.busy} onClick={() => { setQuery(""); void save([...linkedIds, c.id]); }}>{c.path}</Button>
                </li>
              ))}
            </ul>
          )}
          {query.trim() && matches.length === 0 && <p className="text-xs text-slate-500">No place in your list matches. Add it under Settings → Places.</p>}
          {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
        </div>
      )}
    </section>
  );
}
