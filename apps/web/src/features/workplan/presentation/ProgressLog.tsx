"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatShortDate } from "@donordesk/domain/contexts/workplan/index.js";
import type { ProgressResponse } from "@/lib/server/schemas";
import { removeProgressAction, saveProgressAction, setPlanIndicatorsAction } from "@/lib/actions/workplan";
import { useActionState } from "@/lib/client/action-state";
import { useHydrated } from "@/lib/client/use-hydrated";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { KINDS, PROGRESS_KIND_LABEL, defaultKey, draftFor, keyOf, reachedSoFar, type ProgressDraft } from "../domain/progress-view";
import type { ProgressKind } from "@donordesk/domain/contexts/workplan/index.js";

/**
 * The progress log of one planned activity: people reached so far, the entries (day, week, month, activity end), and a form to log
 * more. A monthly or activity-end form is filled from the entries it covers; a figure nobody recorded stays blank, never zero.
 * The breakdown fields come from the indicators the activity reports on.
 */
export function ProgressLog({ itemId, today, activity, data, indicators, canEdit }: {
  itemId: string;
  today: string;
  activity: { start: string; end: string };
  data: ProgressResponse;
  indicators: Array<{ id: string; code: string; name: string }>;
  canEdit: boolean;
}) {
  const router = useRouter();
  const state = useActionState();
  const hydrated = useHydrated();
  const dialog = useRef<HTMLDialogElement>(null);
  const [kind, setKind] = useState<ProgressKind>("DAILY");
  const [draft, setDraft] = useState<ProgressDraft>(() => draftFor("DAILY", defaultKey("DAILY", today, activity), activity, data.entries, data.fields));
  const reached = reachedSoFar(data.entries);

  function open(k: ProgressKind, key: string) {
    setKind(k);
    setDraft(draftFor(k, key, activity, data.entries, data.fields));
    dialog.current?.showModal();
  }

  function change(k: ProgressKind, key: string) {
    setKind(k);
    setDraft(draftFor(k, key, activity, data.entries, data.fields));
  }

  async function save() {
    const done = await state.run(() => saveProgressAction(itemId, {
      kind, key: draft.key,
      values: { total: draft.total, breakdowns: draft.breakdowns, sessions: draft.sessions, unique: draft.unique },
      narrative: draft.narrative,
    }));
    if (done) { dialog.current?.close(); router.refresh(); }
  }

  async function remove() {
    if (!draft.editingId) return;
    const done = await state.run(() => removeProgressAction(itemId, draft.editingId!));
    if (done === true) { dialog.current?.close(); router.refresh(); }
  }

  async function toggleIndicator(id: string, on: boolean) {
    const next = on ? [...new Set([...data.indicatorIds, id])] : data.indicatorIds.filter((x) => x !== id);
    const done = await state.run(() => setPlanIndicatorsAction(itemId, next));
    if (done === true) router.refresh();
  }

  const set = (patch: Partial<ProgressDraft>) => setDraft({ ...draft, ...patch });
  const keyInput = kind === "MONTHLY" ? "month" : "date";
  const figure = (id: string, label: string, value: string, onChange: (v: string) => void, hint?: string) => (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      <Input id={id} inputMode="numeric" value={value} placeholder="Leave blank if not recorded" onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );

  return (
    <section aria-labelledby="progress-title" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="progress-title" className="text-sm font-semibold">Progress</h2>
        <p className="text-sm">{reached === null ? "Nothing recorded yet" : <><b className="font-mono">{reached}</b> people reached so far</>}</p>
      </div>

      {indicators.length > 0 && (
        <fieldset className="space-y-1">
          <legend className="text-sm font-medium">Indicators this activity reports on</legend>
          {indicators.map((i) => (
            <label key={i.id} className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1 h-4 w-4" disabled={!canEdit || state.busy} checked={data.indicatorIds.includes(i.id)} onChange={(e) => toggleIndicator(i.id, e.target.checked)} />
              <span><span className="font-mono text-slate-500">{i.code}</span> {i.name}</span>
            </label>
          ))}
          {data.fields.length > 0 && <p className="text-xs text-slate-500">The log asks for: {data.fields.map((f) => f.label).join(", ")}.</p>}
        </fieldset>
      )}

      {data.entries.length > 0 && (
        <ul className="space-y-1 text-sm">
          {data.entries.filter((e) => e.absorbedById === null).map((e) => (
            <li key={e.id}>
              <button type="button" className="text-left underline underline-offset-2 disabled:no-underline" disabled={!canEdit} onClick={() => open(e.kind, keyOf(e))}>
                <span className="font-mono text-slate-500">{e.from === e.to ? formatShortDate(e.from, today) : `${formatShortDate(e.from, today)} to ${formatShortDate(e.to, today)}`}</span>{" "}
                {PROGRESS_KIND_LABEL[e.kind]} · {e.values.total === null ? "not recorded" : `${e.values.total} people`}
              </button>
            </li>
          ))}
        </ul>
      )}
      {canEdit && <Button size="sm" onClick={() => open("DAILY", defaultKey("DAILY", today, activity))}>Log progress</Button>}

      <dialog ref={dialog} aria-labelledby="progress-dialog-title" className="w-[min(560px,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/40 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100">
        <div className="space-y-4 p-5">
          <h3 id="progress-dialog-title" className="text-lg font-semibold">Log progress</h3>
          <div role="group" aria-label="What you are logging" className="flex flex-wrap gap-1">
            {KINDS.map((k) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => change(k, defaultKey(k, today, activity))}
                className={`min-h-[36px] rounded-lg border px-3 text-sm font-medium ${kind === k ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 dark:border-white/15"}`}>{PROGRESS_KIND_LABEL[k]}</button>
            ))}
          </div>

          {kind !== "END" ? (
            <div className="space-y-1">
              <label htmlFor="pl-key" className="block text-sm font-medium">{kind === "DAILY" ? "Date" : kind === "WEEKLY" ? "Week starting (Monday)" : "Month"}</label>
              <Input id="pl-key" type={keyInput} value={draft.key} onChange={(e) => change(kind, e.target.value)} />
            </div>
          ) : <p className="text-sm text-slate-600 dark:text-slate-300">Covers the whole activity.</p>}

          {draft.error && <p role="alert" className="text-sm text-danger-600">{draft.error}</p>}
          {draft.note && !draft.error && <p className="rounded-lg bg-slate-100 p-2 text-sm text-slate-600 dark:bg-white/5 dark:text-slate-300">{draft.note}</p>}

          {!draft.error && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {figure("pl-total", kind === "END" ? "Total people reached (whole activity)" : "Total people reached", draft.total, (v) => set({ total: v }))}
                {data.fields.map((f, i) => figure(`pl-b-${i}`, f.label, draft.breakdowns[f.key] ?? "", (v) => set({ breakdowns: { ...draft.breakdowns, [f.key]: v } }), `Counts for ${f.usedBy.join(", ")}`))}
                {kind === "MONTHLY" && figure("pl-sessions", "Sessions held", draft.sessions, (v) => set({ sessions: v }))}
                {kind === "END" && figure("pl-unique", "Unique people (if counted)", draft.unique, (v) => set({ unique: v }))}
              </div>
              {(kind === "DAILY" || kind === "WEEKLY") ? (
                <div className="space-y-1"><label htmlFor="pl-notes" className="block text-sm font-medium">Notes (optional)</label>
                  <Textarea id="pl-notes" rows={2} value={draft.narrative.notes} onChange={(e) => set({ narrative: { ...draft.narrative, notes: e.target.value } })} /></div>
              ) : (
                <details className="rounded-lg border border-slate-200 p-3 dark:border-white/10" open={kind === "END"}>
                  <summary className="cursor-pointer text-sm font-medium">Narrative (optional)</summary>
                  <div className="mt-2 space-y-2">
                    {([["summary", "Summary"], ["achievements", "Achievements"], ["challenges", "Challenges"], [kind === "END" ? "lessons" : "nextSteps", kind === "END" ? "Lessons learned" : "Next steps"]] as const).map(([k, label]) => (
                      <div key={k} className="space-y-1"><label htmlFor={`pl-n-${k}`} className="block text-sm">{label}</label>
                        <Textarea id={`pl-n-${k}`} rows={2} value={draft.narrative[k]} onChange={(e) => set({ narrative: { ...draft.narrative, [k]: e.target.value } })} /></div>
                    ))}
                  </div>
                </details>
              )}
            </>
          )}

          {state.error && <p role="alert" className="text-sm text-danger-600">{state.error}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            {draft.editingId && <Button variant="secondary" onClick={remove} disabled={state.busy} className="mr-auto">Remove entry</Button>}
            <Button variant="secondary" onClick={() => dialog.current?.close()}>Cancel</Button>
            <Button onClick={save} pending={state.busy} disabled={!hydrated || Boolean(draft.error)}>{draft.editingId ? "Save changes" : "Save"}</Button>
          </div>
        </div>
      </dialog>
    </section>
  );
}
