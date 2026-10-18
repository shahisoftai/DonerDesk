"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { assignChecklistItemAction, setIndicatorOwnerAction, setPeriodOwnerAction } from "@/lib/actions/tasks";
import { useActionState } from "@/lib/client/action-state";
import { useHydrated } from "@/lib/client/use-hydrated";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import type { ProjectPerson } from "../domain/ask-people";

/**
 * "Lead": who is responsible, as a picker on the row people already edit (an indicator, a report, a compliance item). It saves
 * as soon as it is changed and says so. People who cannot change it see the name only.
 */
export type LeadTarget = { type: "indicator" | "period" | "checklistItem"; id: string };

/** Which action saves which kind of lead. A table, so a new kind is a new row. */
const SAVERS = {
  indicator: setIndicatorOwnerAction,
  period: setPeriodOwnerAction,
  checklistItem: assignChecklistItemAction,
} as const;

export function LeadPicker({ label = "Lead", current, people, canEdit, target }: {
  label?: string;
  current?: string | null | undefined;
  people: ProjectPerson[];
  canEdit: boolean;
  /** What the lead is for. The picker chooses the matching action itself, so the page passes data, never a function. */
  target: LeadTarget;
}) {
  const router = useRouter();
  const state = useActionState();
  const hydrated = useHydrated();
  const [value, setValue] = useState(current ?? "");
  const [saved, setSaved] = useState(false);
  const name = people.find((p) => p.id === (current ?? ""))?.label;

  if (!canEdit) return <p className="text-sm text-slate-600 dark:text-slate-300">{label}: {current ? (name ?? "A team member") : "No lead yet"}</p>;

  async function change(next: string) {
    setValue(next);
    setSaved(false);
    const done = await state.run(() => SAVERS[target.type](target.id, { userId: next || null }));
    if (done === true) { setSaved(true); router.refresh(); } else setValue(current ?? "");
  }

  return (
    <div className="max-w-xs">
      <Field label={label}>
        <Select value={value} disabled={!hydrated || state.busy} onChange={(e) => void change(e.target.value)}>
          <option value="">No lead yet</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </Select>
      </Field>
      {saved && <p role="status" className="mt-1 text-xs text-slate-500">Saved.</p>}
      {state.error && <p role="alert" className="mt-1 text-xs text-danger-600">{state.error}</p>}
    </div>
  );
}
