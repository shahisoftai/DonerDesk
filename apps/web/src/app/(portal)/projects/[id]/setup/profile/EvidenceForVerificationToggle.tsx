"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/Checkbox";
import { setRequireEvidenceForVerificationAction } from "@/lib/actions/setup";
import { useHydrated } from "@/lib/client/use-hydrated";

/** "Evidence before verified": an indicator value needs an attached file before it can be verified. */
export function EvidenceForVerificationToggle({ projectId, initial }: { projectId: string; initial: boolean }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [saved, setSaved] = useState<string | null>(null);
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(next: boolean) {
    setBusy(true);
    setError(null);
    setSaved(null);
    const result = await setRequireEvidenceForVerificationAction(projectId, next);
    setBusy(false);
    if (!result.ok) return setError(result.error.message);
    setValue(next);
    setSaved(next ? "Saved: a value needs an attached file before it can be verified." : "Saved: values can be verified without an attached file.");
    router.refresh();
  }

  return (
    <section className="card" aria-labelledby="evidence-verification-heading">
      <h3 id="evidence-verification-heading" className="text-sm font-medium">Verification</h3>
      <label className="mt-2 flex items-start gap-2 text-sm">
        <Checkbox checked={value} disabled={busy || !hydrated} onChange={(e) => void change(e.target.checked)} aria-describedby="evidence-verification-hint" />
        <span>
          Require a file behind every verified value
          <span id="evidence-verification-hint" className="block text-xs text-slate-500 dark:text-slate-400">
            Someone verifying an indicator value is asked to attach the file that proves it first (a register, a signed sheet, a photo). Values that already have a file verify as before. Leave this off if you collect the proof elsewhere.
          </span>
        </span>
      </label>
      {saved && <p role="status" className="mt-2 text-sm text-success-700 dark:text-success-400">{saved}</p>}
      {error && <p role="alert" className="mt-2 text-sm text-danger-700 dark:text-danger-400">{error}</p>}
    </section>
  );
}
