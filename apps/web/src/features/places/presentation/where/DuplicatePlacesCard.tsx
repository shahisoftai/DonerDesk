"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { mergePlacesAction } from "@/lib/actions/place-tree";
import { useActionState } from "@/lib/client/action-state";
import { useHydrated } from "@/lib/client/use-hydrated";
import { Button } from "@/components/ui/Button";
import type { DuplicatePlacesDto } from "@/lib/server/schemas-place-tree";

const REASON: Record<DuplicatePlacesDto["pairs"][number]["reason"], string> = { SAME_NAME: "same name", SAME_CODE: "same code" };

/**
 * Likely duplicates (Phase 56), for administrators. Merging moves every link, area, confirmed word and by-place figure to the place kept; the
 * other row is retired and points at it, so nothing that named it breaks. Asked once per pair; it cannot be undone from here.
 */
export function DuplicatePlacesCard({ data }: { data: DuplicatePlacesDto }) {
  const router = useRouter();
  const state = useActionState();
  const hydrated = useHydrated();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function merge(keepId: string, mergeId: string, name: string) {
    const r = await state.run(() => mergePlacesAction({ keepId, mergeId }));
    if (r) { setNote(`Merged into ${name}: ${r.moved} ${r.moved === 1 ? "link" : "links"} moved.`); setConfirming(null); router.refresh(); }
  }

  return (
    <section aria-labelledby="dupes" className="card space-y-2">
      <h2 id="dupes" className="section-title">Possible duplicates</h2>
      {data.pairs.length === 0 ? <p className="text-sm text-slate-600 dark:text-slate-300">No likely duplicates found.</p> : (
        <ul className="space-y-2 text-sm">
          {data.pairs.map((p) => {
            const key = `${p.keep.id}|${p.merge.id}`;
            return (
              <li key={key} className="flex flex-wrap items-center gap-2">
                <span><b>{p.merge.path}</b> and <b>{p.keep.path}</b> <span className="text-xs text-slate-500">({REASON[p.reason]})</span></span>
                {confirming === key ? (
                  <>
                    <Button type="button" size="sm" variant="danger" disabled={!hydrated || state.busy} onClick={() => void merge(p.keep.id, p.merge.id, p.keep.name)}>Merge into {p.keep.name}</Button>
                    <Button type="button" size="sm" variant="secondary" disabled={!hydrated || state.busy} onClick={() => void merge(p.merge.id, p.keep.id, p.merge.name)}>Merge into {p.merge.name}</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(null)}>Cancel</Button>
                  </>
                ) : <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(key)}>Merge…</Button>}
              </li>
            );
          })}
        </ul>
      )}
      {note && <p role="status" className="text-sm">{note}</p>}
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
    </section>
  );
}
