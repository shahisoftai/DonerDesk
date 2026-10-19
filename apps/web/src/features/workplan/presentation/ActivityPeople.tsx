"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BENEFICIARY_AGE_LABEL, BENEFICIARY_SEX_LABEL } from "@donordesk/domain/contexts/workplan/index.js";
import type { ActivityPeople as ActivityPeopleView } from "@/lib/server/schemas";
import { changeActivityPeopleAction } from "@/lib/actions/workplan";
import { useActionState } from "@/lib/client/action-state";
import { useHydrated } from "@/lib/client/use-hydrated";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";

/**
 * The people an activity reached, by case code. Each person counts once however many times they are added. Paste case codes to
 * add people; a code that is not in this project is listed back, never guessed. This count is the starting point for "unique people"
 * in the activity-end report.
 */
export function ActivityPeople({ itemId, data, canEdit }: { itemId: string; data: ActivityPeopleView; canEdit: boolean }) {
  const router = useRouter();
  const state = useActionState();
  const hydrated = useHydrated();
  const [codes, setCodes] = useState("");
  const [note, setNote] = useState<string | null>(null);

  async function add() {
    setNote(null);
    const done = await state.run(() => changeActivityPeopleAction(itemId, { addCaseCodes: codes }));
    if (!done) return;
    setCodes("");
    setNote(`${done.added} added${done.unknown.length ? `. Not in this project: ${done.unknown.join(", ")}` : ""}.`);
    router.refresh();
  }

  async function remove(id: string) {
    const done = await state.run(() => changeActivityPeopleAction(itemId, { removeIds: [id] }));
    if (done) router.refresh();
  }

  if (data.counts.total === 0 && !canEdit) return null;
  const bySex = Object.entries(data.counts.bySex).map(([k, n]) => `${BENEFICIARY_SEX_LABEL[k as keyof typeof BENEFICIARY_SEX_LABEL] ?? k} ${n}`).join(" · ");
  const byAge = Object.entries(data.counts.byAgeGroup).map(([k, n]) => `${BENEFICIARY_AGE_LABEL[k as keyof typeof BENEFICIARY_AGE_LABEL] ?? k} ${n}`).join(" · ");
  return (
    <section aria-labelledby="people-title" className="space-y-2">
      <h2 id="people-title" className="text-sm font-semibold">People reached (by case code)</h2>
      <p className="text-sm">{data.counts.total === 0 ? "No one linked yet." : <><b className="font-mono">{data.counts.total}</b> people, each counted once.</>}</p>
      {data.counts.total > 0 && <p className="text-xs text-slate-500">{bySex}{byAge ? ` — ${byAge}` : ""}</p>}
      {data.people.length > 0 && (
        <ul className="flex flex-wrap gap-2 text-sm">
          {data.people.map((p) => (
            <li key={p.id} className="rounded-full border border-slate-300 px-2 py-0.5 dark:border-white/15">
              <span className="font-mono">{p.caseCode}</span>
              {canEdit && <button type="button" className="ml-1 text-slate-500 underline" onClick={() => remove(p.id)} disabled={state.busy} aria-label={`Remove ${p.caseCode}`}>×</button>}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <div className="max-w-md space-y-2">
          <label htmlFor="people-codes" className="block text-sm font-medium">Add by case code</label>
          <Textarea id="people-codes" rows={2} value={codes} placeholder="NG-0001, NG-0002 (commas, spaces or new lines)" onChange={(e) => setCodes(e.target.value)} />
          {state.error && <p role="alert" className="text-sm text-danger-600">{state.error}</p>}
          {note && <p role="status" className="text-sm">{note}</p>}
          <Button size="sm" onClick={add} pending={state.busy} disabled={!hydrated || !codes.trim()}>Add people</Button>
        </div>
      )}
    </section>
  );
}
