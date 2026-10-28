"use client";

import { useState } from "react";
import { updateAskSettingsAction } from "@/lib/actions/org";
import { useActionState } from "@/lib/client/action-state";

/** The administrator's switch for Ask DonorDesk. Off until someone chooses to turn it on. */
export function AskSettingsCard({ initialEnabled, canEdit }: { initialEnabled: boolean; canEdit: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const act = useActionState();
  async function toggle(next: boolean) {
    if (await act.run(() => updateAskSettingsAction({ enabled: next }))) setEnabled(next);
  }
  return (
    <section className="card mt-6 max-w-2xl" aria-labelledby="ask-title">
      <h2 id="ask-title" className="text-sm font-semibold">Ask DonorDesk</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        Lets people put a question to a project&apos;s own records and get an answer that shows where each sentence comes from. When someone asks, the question and the few records it needs (indicator values, accepted activities, the text of evidence they are allowed to open) are sent to the AI service, with personal details such as names, e-mail addresses and phone numbers removed first. Nothing is sent until someone asks. Finance figures are not used.
      </p>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={enabled} disabled={!canEdit || act.busy} onChange={(e) => void toggle(e.target.checked)} />
        Allow Ask DonorDesk in this organisation
      </label>
      {!canEdit && <p className="mt-2 text-xs text-slate-500">Only an administrator can change this.</p>}
      {act.error && <p role="alert" className="mt-2 text-sm text-danger-600">{act.error}</p>}
    </section>
  );
}
