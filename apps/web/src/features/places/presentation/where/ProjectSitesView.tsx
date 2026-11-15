"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { tickProjectAreaAction } from "@/lib/actions/place-tree";
import { useActionState } from "@/lib/client/action-state";
import { useHydrated } from "@/lib/client/use-hydrated";
import { Button } from "@/components/ui/Button";
import type { ProjectPlacesDto } from "@/lib/server/schemas-place-tree";
import { InlineAddPlace } from "../picker/InlineAddPlace";

const KIND_WORDS: ReadonlyArray<[keyof ProjectPlacesDto["sites"][number]["counts"], string, string]> = [
  ["PLANNED_ACTIVITY", "planned", "planned"],
  ["ACTIVITY", "done", "done"],
  ["EVIDENCE", "file", "files"],
  ["BENEFICIARY", "person", "people"],
];

/**
 * The places this project's records point at (Phase 56), each with what was recorded there. Places outside the project's areas are listed
 * first with a one-click "add the area"; a new site is added inside one of the project's areas.
 */
export function ProjectSitesView({ projectId, data }: { projectId: string; data: ProjectPlacesDto }) {
  const router = useRouter();
  const state = useActionState();
  const hydrated = useHydrated();
  const [adding, setAdding] = useState(false);
  const outside = data.sites.filter((s) => s.footprint === "OUTSIDE");
  const parents = data.areas.filter((a) => !a.closed).map((a) => ({ id: a.id, name: a.name, path: a.path }));

  async function extend(placeId: string) {
    const done = await state.run(() => tickProjectAreaAction(projectId, { placeId }));
    if (done) router.refresh();
  }

  return (
    <div className="space-y-4">
      {outside.length > 0 && (
        <div role="status" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-500/40 dark:bg-amber-500/10">
          <p className="font-medium">{outside.length === 1 ? "One place" : `${outside.length} places`} with this project&apos;s records {outside.length === 1 ? "is" : "are"} outside its areas.</p>
          <ul className="mt-1 space-y-1">
            {outside.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2">
                <span>{s.path}</span>
                {s.extension && data.canEdit && <Button type="button" size="sm" variant="secondary" disabled={!hydrated || state.busy} onClick={() => void extend(s.extension!.placeId)}>Add {s.extension.name} to this project</Button>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.sites.length === 0 ? <p className="text-sm text-slate-600 dark:text-slate-300">No records point at a place yet. Choose places on planned activities, completed activities and files.</p> : (
        <table className="w-full text-sm">
          <thead><tr className="text-start text-xs text-slate-500"><th className="py-1 text-start">Place</th><th className="py-1 text-start">Recorded here</th></tr></thead>
          <tbody>
            {data.sites.map((s) => (
              <tr key={s.id} className="border-t border-slate-200 dark:border-white/10">
                <td className="py-1.5"><a className="link" href={`/places/${s.id}`}>{s.path}</a>{s.facility && <span className="ms-2 text-xs text-slate-500">facility</span>}</td>
                <td className="py-1.5 text-slate-600 dark:text-slate-300">{KIND_WORDS.filter(([k]) => s.counts[k] > 0).map(([k, one, many]) => `${s.counts[k]} ${s.counts[k] === 1 ? one : many}`).join(" · ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {data.canEdit && (adding
        ? <InlineAddPlace projectId={projectId} initialName="" parents={parents} onCancel={() => setAdding(false)} onAdded={() => { setAdding(false); router.refresh(); }} />
        : <Button type="button" variant="secondary" onClick={() => setAdding(true)}>Add a site</Button>)}
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
    </div>
  );
}
