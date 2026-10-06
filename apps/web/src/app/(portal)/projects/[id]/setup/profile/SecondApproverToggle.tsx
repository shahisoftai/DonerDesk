"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/Checkbox";
import { setRequireSecondApproverAction } from "@/lib/actions/setup";

/** "A second person must approve": the author of a report cannot approve it. Leave it off when you work alone. */
export function SecondApproverToggle({ projectId, initial }: { projectId: string; initial: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(next: boolean) {
    setBusy(true);
    setError(null);
    const result = await setRequireSecondApproverAction(projectId, next);
    setBusy(false);
    if (!result.ok) return setError(result.error.message);
    setValue(next);
    router.refresh();
  }

  return (
    <section className="card" aria-labelledby="second-approver-heading">
      <h3 id="second-approver-heading" className="text-sm font-medium">Approval</h3>
      <label className="mt-2 flex items-start gap-2 text-sm">
        <Checkbox checked={value} disabled={busy} onChange={(e) => void change(e.target.checked)} aria-describedby="second-approver-hint" />
        <span>
          A second person must approve reports
          <span id="second-approver-hint" className="block text-xs text-slate-500 dark:text-slate-400">
            The person who wrote a report cannot approve it. If you work alone, leave this off: you may approve your own report, and the audit trail records it as a self sign-off.
          </span>
        </span>
      </label>
      {error && <p role="alert" className="mt-2 text-sm text-danger-700 dark:text-danger-400">{error}</p>}
    </section>
  );
}
