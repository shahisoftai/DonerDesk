"use client";

import { useState } from "react";
import { SUMMARY_MODES, SUMMARY_MODE_LABEL, type SummaryMode } from "@donordesk/domain/contexts/tasks/index.js";
import { setEmailSummaryModeAction } from "@/lib/actions/tasks";
import { useActionState } from "@/lib/client/action-state";
import { useHydrated } from "@/lib/client/use-hydrated";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";

/**
 * The only reminder setting: how I want to be emailed. It saves as soon as it is changed and says so. The default needs no setup:
 * one short summary in the morning, only on days something is due or late. In-app notifications are not affected.
 */
export function EmailPreference({ initial }: { initial: SummaryMode }) {
  const state = useActionState();
  const hydrated = useHydrated();
  const [mode, setMode] = useState<SummaryMode>(initial);
  const [saved, setSaved] = useState(false);

  async function change(next: SummaryMode) {
    const before = mode;
    setMode(next);
    setSaved(false);
    const done = await state.run(() => setEmailSummaryModeAction(next));
    if (done === true) setSaved(true); else setMode(before);
  }

  return (
    <section className="card max-w-md" aria-labelledby="email-pref-title">
      <h2 id="email-pref-title" className="text-sm font-semibold">Email me</h2>
      <p className="mt-1 text-xs text-slate-500">A short summary in the morning, only on days something is due or late. You still see everything here.</p>
      <div className="mt-3">
        <Field label="Email me">
          <Select value={mode} disabled={!hydrated || state.busy} onChange={(e) => void change(e.target.value as SummaryMode)}>
            {SUMMARY_MODES.map((m) => <option key={m} value={m}>{SUMMARY_MODE_LABEL[m]}</option>)}
          </Select>
        </Field>
      </div>
      {saved && <p role="status" className="mt-2 text-xs text-slate-500">Saved.</p>}
      {state.error && <p role="alert" className="mt-2 text-xs text-danger-600">{state.error}</p>}
    </section>
  );
}
