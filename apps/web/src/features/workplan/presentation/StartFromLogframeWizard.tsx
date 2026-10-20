"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { countOf } from "@donordesk/domain/core/plural.js";
import { startPlanFromLogframeAction } from "@/lib/actions/workplan";
import { useActionState } from "@/lib/client/action-state";
import { useHydrated } from "@/lib/client/use-hydrated";
import type { PlanPreviewResponse } from "@/lib/server/schemas";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { PlanFormOption } from "./PlanActivityForm";

export interface WizardActivity { id: string; title: string; outputTitle: string }
interface Row { ticked: boolean; monthly: boolean; start: string; end: string; lead: string }

/**
 * Start from my logframe, in three steps with nothing saved until Create: (1) which activities, (2) when, (3) who leads.
 * The dates are suggested by the server's `proposePlanDates` (one rule), then edited here; Review shows the count, Create saves.
 */
export function StartFromLogframeWizard({ projectId, activities, leads }: { projectId: string; activities: WizardActivity[]; leads: PlanFormOption[] }) {
  const router = useRouter();
  const state = useActionState();
  const hydrated = useHydrated();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [rows, setRows] = useState<Record<string, Row>>(() => Object.fromEntries(activities.map((a) => [a.id, { ticked: true, monthly: false, start: "", end: "", lead: "" }])));
  const [preview, setPreview] = useState<PlanPreviewResponse["preview"] | null>(null);
  const ticked = useMemo(() => activities.filter((a) => rows[a.id]?.ticked), [activities, rows]);
  const grouped = useMemo(() => {
    const m = new Map<string, WizardActivity[]>();
    for (const a of activities) m.set(a.outputTitle, [...(m.get(a.outputTitle) ?? []), a]);
    return [...m.entries()];
  }, [activities]);

  const set = (id: string, patch: Partial<Row>) => setRows((r) => ({ ...r, [id]: { ...r[id]!, ...patch } }));
  const payload = (apply: boolean) => ({
    apply,
    rows: ticked.map((a) => {
      const r = rows[a.id]!;
      return { logframeActivityId: a.id, monthly: r.monthly, ...(r.start ? { plannedStart: r.start } : {}), ...(r.end ? { plannedEnd: r.end } : {}), ...(r.lead ? { ownerUserId: r.lead } : {}) };
    }),
  });

  async function showDates() {
    // Suggested dates come from the server rule; the preview fills the date fields once.
    const out = await state.run(() => startPlanFromLogframeAction(projectId, payload(false)));
    if (!out) return;
    setRows((r) => {
      const next = { ...r };
      for (const p of out.preview.rows) next[p.logframeActivityId] = { ...next[p.logframeActivityId]!, start: next[p.logframeActivityId]!.start || p.plannedStart, end: next[p.logframeActivityId]!.end || p.plannedEnd };
      return next;
    });
    setStep(2);
  }
  async function finish() {
    const out = await state.run(() => startPlanFromLogframeAction(projectId, payload(false)));
    if (!out) return;
    setPreview(out.preview);
    setStep(4);
  }
  async function create() {
    const out = await state.runCreate((idempotencyKey) => startPlanFromLogframeAction(projectId, payload(true), { idempotencyKey }));
    if (out) router.push(`/projects/${projectId}/activities?view=planned`);
  }

  return (
    <div className="max-w-2xl space-y-5" aria-busy={state.busy}>
      <ol className="flex gap-2" aria-label="Steps">
        {["Which activities", "When", "Who leads"].map((label, i) => (
          <li key={label} aria-current={step === i + 1 ? "step" : undefined} className={`rounded-full px-3 py-1 text-xs ${step === i + 1 ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300"}`}>{i + 1}. {label}</li>
        ))}
      </ol>

      {step === 1 && (
        <div className="space-y-4">
          {grouped.map(([output, items]) => (
            <fieldset key={output} className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
              <legend className="px-1 text-sm font-medium">{output}</legend>
              {items.map((a) => (
                <label key={a.id} className="flex items-center gap-2 py-1 text-sm">
                  <input type="checkbox" className="h-4 w-4" checked={rows[a.id]!.ticked} onChange={(e) => set(a.id, { ticked: e.target.checked })} />
                  {a.title}
                </label>
              ))}
            </fieldset>
          ))}
          <Button onClick={showDates} disabled={!hydrated || ticked.length === 0} pending={state.busy}>Next</Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          {ticked.map((a) => {
            const r = rows[a.id]!;
            return (
              <div key={a.id} className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end dark:border-white/10">
                <span className="text-sm font-medium">{a.title}</span>
                {r.monthly ? (
                  <span className="text-xs text-slate-500 sm:col-span-2">Repeats every month from the start of the project</span>
                ) : (
                  <>
                    <label className="text-xs">Starts<Input type="date" value={r.start} onChange={(e) => set(a.id, { start: e.target.value })} /></label>
                    <label className="text-xs">Ends<Input type="date" value={r.end} min={r.start} onChange={(e) => set(a.id, { end: e.target.value })} /></label>
                  </>
                )}
                {/* A monthly row takes the server's monthly dates, so its own are cleared (one rule: proposePlanDates). */}
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" className="h-4 w-4" checked={r.monthly} onChange={(e) => set(a.id, { monthly: e.target.checked, start: "", end: "" })} />Monthly</label>
              </div>
            );
          })}
          <div className="flex gap-2"><Button variant="secondary" onClick={() => setStep(1)}>Back</Button><Button onClick={() => setStep(3)}>Next</Button></div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          {ticked.map((a) => (
            <label key={a.id} className="block text-sm">
              <span className="font-medium">{a.title}</span>
              <Select value={rows[a.id]!.lead} onChange={(e) => set(a.id, { lead: e.target.value })}>
                <option value="">Skip for now</option>
                {leads.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
              </Select>
            </label>
          ))}
          <div className="flex gap-2"><Button variant="secondary" onClick={() => setStep(2)}>Back</Button><Button onClick={finish} pending={state.busy}>Review</Button></div>
        </div>
      )}

      {step === 4 && preview && (
        <div className="space-y-3">
          <p className="text-sm">
            {countOf(preview.total, "activity", "activities")}
            {preview.repeating > 0 && <>, {preview.repeating} repeating monthly</>}.
          </p>
          <div className="flex gap-2"><Button variant="secondary" onClick={() => setStep(3)}>Back</Button><Button onClick={create} pending={state.busy}>Create</Button></div>
        </div>
      )}
      {state.error && <p role="alert" className="text-sm text-danger-600">{state.error}</p>}
    </div>
  );
}
