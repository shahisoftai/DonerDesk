"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/Checkbox";
import { setSimpleReviewAction } from "@/lib/actions/setup";
import { useHydrated } from "@/lib/client/use-hydrated";

/** "Simple review": a small team skips the separate hand-in step. It saves at once and says so. */
export function SimpleReviewToggle({ projectId, initial }: { projectId: string; initial: boolean }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(next: boolean) {
    setBusy(true);
    setError(null);
    setSaved(null);
    const result = await setSimpleReviewAction(projectId, next);
    setBusy(false);
    if (!result.ok) return setError(result.error.message);
    setValue(next);
    setSaved(next ? "Saved: values are handed in as soon as they are saved." : "Saved: values stay drafts until someone hands them in.");
    router.refresh();
  }

  return (
    <section className="card" aria-labelledby="simple-review-heading">
      <h3 id="simple-review-heading" className="text-sm font-medium">Entering indicator values</h3>
      <label className="mt-2 flex items-start gap-2 text-sm">
        <Checkbox checked={value} disabled={busy || !hydrated} onChange={(e) => void change(e.target.checked)} aria-describedby="simple-review-hint" />
        <span>
          Hand values in as soon as they are saved (simple review)
          <span id="simple-review-hint" className="block text-xs text-slate-500 dark:text-slate-400">
            For small teams. A saved value goes straight to review without a separate &ldquo;Submit&rdquo; step. A person who may verify values and has attached a file behind the value also has it verified at once. Autosave in the sheet still keeps drafts until you press Save. Leave this off if a second person should always check values first.
          </span>
        </span>
      </label>
      {saved && <p role="status" className="mt-2 text-sm text-success-700 dark:text-success-400">{saved}</p>}
      {error && <p role="alert" className="mt-2 text-sm text-danger-700 dark:text-danger-400">{error}</p>}
    </section>
  );
}
