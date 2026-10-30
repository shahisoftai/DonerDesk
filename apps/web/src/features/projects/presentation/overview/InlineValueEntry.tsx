"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { quickEnterValueAction } from "@/lib/actions/indicators";
import type { InlineValueEntry as Entry } from "@/features/projects/domain/overview-derive";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useActionState } from "@/lib/client/action-state";
import { useHydrated } from "@/lib/client/use-hydrated";

/**
 * Type an overdue value where it is listed. It is the same quick-entry save as the Enter data page (the period is named, so
 * the day does not matter), so every rule and the project's review setting apply unchanged. A refusal is shown here, with its reason.
 */
export function InlineValueEntry({ entry, today }: { entry: Entry; today: string }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const state = useActionState();
  const [value, setValue] = useState("");
  const [done, setDone] = useState<string[] | null>(null);

  async function save() {
    if (value.trim() === "") return;
    const result = await state.run(() => quickEnterValueAction({ indicatorId: entry.indicatorId, reportingPeriodId: entry.periodId, date: today, periodAchievement: value.trim() }));
    if (result) {
      setDone(["Saved.", ...result.notices]);
      router.refresh();
    }
  }

  if (done) return <p role="status" className="text-xs text-success-700 dark:text-success-400">{done.join(" ")}</p>;
  return (
    <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <label className="min-w-0 flex-1 text-xs text-slate-600 dark:text-slate-300">
        <span className="block truncate" title={entry.label}>{entry.label}</span>
        <Input aria-label={`Value for ${entry.label}`} inputMode="decimal" autoComplete="off" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Value" className="mt-1" />
      </label>
      <Button type="submit" size="sm" pending={state.busy} disabled={!hydrated || value.trim() === ""}>Save</Button>
      {state.error && <p role="alert" className="basis-full text-xs text-danger-700 dark:text-danger-400">{state.error}</p>}
    </form>
  );
}
