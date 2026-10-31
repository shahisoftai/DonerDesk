"use client";

import { useState } from "react";
import { updateSetupAssistSettingsAction } from "@/lib/actions/org";
import { useActionState } from "@/lib/client/action-state";

/** The administrator's switch for setting up a project from its document. Off until someone chooses to turn it on. */
export function SetupAssistSettingsCard({ initialEnabled, canEdit }: { initialEnabled: boolean; canEdit: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const act = useActionState();
  async function toggle(next: boolean) {
    if (await act.run(() => updateSetupAssistSettingsAction({ enabled: next }))) setEnabled(next);
  }
  return (
    <section className="card mt-6 max-w-2xl" aria-labelledby="setup-assist-title">
      <h2 id="setup-assist-title" className="text-sm font-semibold">Set up projects from a document</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        Lets people upload a project document and get a proposed setup (results, indicators, activities, places, funding) to review before anything is created. The document is sent to the AI service with personal details such as names, e-mail addresses and phone numbers removed first. Nothing is sent until someone uploads a document, and nothing is created until someone reviews and applies it.
      </p>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={enabled} disabled={!canEdit || act.busy} onChange={(e) => void toggle(e.target.checked)} />
        Allow project setup from documents in this organisation
      </label>
      {!canEdit && <p className="mt-2 text-xs text-slate-500">Only an administrator can change this.</p>}
      {act.error && <p role="alert" className="mt-2 text-sm text-danger-600">{act.error}</p>}
    </section>
  );
}
