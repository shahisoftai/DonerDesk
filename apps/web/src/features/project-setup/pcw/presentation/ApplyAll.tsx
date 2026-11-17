"use client";

import { useState, useTransition } from "react";
import { editDraftAction } from "@/lib/actions/project-setup-draft";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import type { SetupDraftView } from "@/lib/server/schemas-project-setup-draft";
import { APPLY_ALL_FIELDS, applyAllTargets, type ApplyAllField } from "../domain/apply-all";
import { usePcwCopy } from "./usePcwCopy";

/**
 * "Apply to all" for one field (Phase 59): the person picks a value and every row that has none gets it. Rows that already have a value
 * are never touched (the targets are computed from the draft), and the answer says how many were filled. Shown only while a row is empty.
 */
export function ApplyAll({ id, view, field, label, options, onView, onError }: {
  id: string; view: SetupDraftView; field: ApplyAllField; label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onView: (v: SetupDraftView) => void; onError: (message: string) => void;
}) {
  const c = usePcwCopy().c.simple;
  const [value, setValue] = useState("");
  const [done, setDone] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const targets = applyAllTargets(view, field);
  if (targets.length === 0 && done === null) return null;

  const run = () => start(async () => {
    let latest: SetupDraftView | null = null;
    let filled = 0;
    for (const target of targets) {
      const r = await editDraftAction(id, APPLY_ALL_FIELDS[field].edit(target, value));
      if (!r.ok) { onError(r.error.message); break; }
      latest = r.value; filled += 1;
    }
    if (latest) onView(latest);
    setDone(filled); setValue("");
  });

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 p-3 dark:border-white/10" data-testid={`apply-all-${field}`}>
      <div className="min-w-[14rem] flex-1">
        <Field label={label}>
          <Select value={value} onChange={(e) => { setValue(e.target.value); setDone(null); }}>
            <option value="">{c.applyAll.choose}</option>
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Field>
      </div>
      <button type="button" className="btn-secondary" disabled={pending || !value || targets.length === 0} onClick={run}>{c.applyAll.fill(targets.length)}</button>
      {done !== null && targets.length === 0 ? <p role="status" className="basis-full text-sm text-slate-600 dark:text-slate-300">{c.applyAll.filled(done)}</p> : null}
    </div>
  );
}
