"use client";

import { useState, useTransition } from "react";
import { editDraftAction } from "@/lib/actions/project-setup-draft";
import { Checkbox } from "@/components/ui/Checkbox";
import type { SetupDraftView } from "@/lib/server/schemas-project-setup-draft";
import { usePcwCopy } from "./usePcwCopy";
import { notUsedAnswer } from "../domain/pcw-view";

/** The two "not used" answers of the Places step (no named places, no project area) as one choice: a project that has no fixed places. */
const REQUIREMENTS = ["places.decided", "places.area"] as const;

export function NoFixedPlaces({ id, view, onView }: { id: string; view: SetupDraftView; onView: (v: SetupDraftView) => void }) {
  const c = usePcwCopy().c.places;
  const on = REQUIREMENTS.every((r) => notUsedAnswer(view, r).notUsed);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const change = (checked: boolean) => start(async () => {
    let latest = view;
    for (const requirement of REQUIREMENTS) {
      const r = await editDraftAction(id, checked ? { kind: "ANSWER_NOT_USED", requirement } : { kind: "REOPEN_REQUIREMENT", requirement });
      if (!r.ok) { setError(r.error.message); return; }
      latest = r.value;
    }
    setError(null); onView(latest);
  });
  return (
    <div className="space-y-1 text-sm">
      <label className="flex items-center gap-2"><Checkbox checked={on} disabled={pending} onChange={(e) => change(e.target.checked)} />{c.noFixedPlaces}</label>
      <p className="ps-6 text-xs text-slate-600 dark:text-slate-300">{c.noFixedPlacesHelp}</p>
      {error ? <p role="alert" className="text-danger-600">{error}</p> : null}
    </div>
  );
}
