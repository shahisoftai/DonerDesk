"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PlanItemFields as PlanItemFieldsView } from "@/lib/server/schemas";
import { defineProjectFieldAction, setPlanItemFieldsAction } from "@/lib/actions/workplan";
import { useActionState } from "@/lib/client/action-state";
import { useToast } from "@/components/feedback/Toast";
import { useHydrated } from "@/lib/client/use-hydrated";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { fieldDraft, fieldPayload, fieldTypeWords, parseChoiceLines } from "../domain/custom-field-view";

/**
 * The project's own fields on one planned activity (phase 28.1-C). Blank stays blank: a field nobody filled is sent as
 * nothing, not as zero. A manager may add a field here; the server checks the name is new and the choices are usable.
 */
export function PlanItemFields({ itemId, projectId, fields, values, canEdit, canDefine }: PlanItemFieldsView & { itemId: string; projectId: string; canEdit: boolean; canDefine: boolean }) {
  const router = useRouter();
  const state = useActionState();
  const toast = useToast();
  const hydrated = useHydrated();
  const [draft, setDraft] = useState<Record<string, string>>(() => fieldDraft(fields, values));
  const [label, setLabel] = useState("");
  const [type, setType] = useState<"TEXT" | "NUMBER" | "DATE" | "CHOICE">("TEXT");
  const [choices, setChoices] = useState("");

  async function save() {
    const done = await state.run(() => setPlanItemFieldsAction(itemId, { values: fieldPayload(fields, draft) }));
    if (done === true) {
      toast.push({ title: "Fields saved", tone: "success" });
      router.refresh();
    }
  }

  async function define() {
    const done = await state.run(() => defineProjectFieldAction(projectId, { label, type, ...(type === "CHOICE" ? { choices: parseChoiceLines(choices) } : {}) }));
    if (done) {
      toast.push({ title: `Field "${label.trim()}" added`, tone: "success" });
      setLabel(""); setChoices(""); setType("TEXT"); router.refresh();
    }
  }

  if (fields.length === 0 && !canDefine) return null;
  return (
    <section aria-labelledby="plan-fields-title" className="space-y-3">
      <h2 id="plan-fields-title" className="text-sm font-semibold">Your project&apos;s fields</h2>
      {fields.length === 0 && <p className="text-sm text-slate-600 dark:text-slate-300">No fields yet.</p>}
      {fields.map((f) => (
        <div key={f.id} className="max-w-md space-y-1">
          <label htmlFor={`pf-${f.id}`} className="block text-sm font-medium">{f.label}</label>
          {f.type === "CHOICE" ? (
            <Select id={`pf-${f.id}`} value={draft[f.id] ?? ""} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, [f.id]: e.target.value })}>
              <option value="">Not recorded</option>
              {f.choices.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          ) : (
            <Input id={`pf-${f.id}`} type={f.type === "DATE" ? "date" : "text"} inputMode={f.type === "NUMBER" ? "decimal" : undefined} value={draft[f.id] ?? ""} disabled={!canEdit} placeholder={f.type === "NUMBER" ? "Leave blank if not recorded" : undefined} onChange={(e) => setDraft({ ...draft, [f.id]: e.target.value })} />
          )}
          <p className="text-xs text-slate-500">{fieldTypeWords(f.type)}</p>
        </div>
      ))}
      {state.error && <p role="alert" className="text-sm text-danger-600">{state.error}</p>}
      {canEdit && fields.length > 0 && <div><Button size="sm" onClick={save} pending={state.busy} disabled={!hydrated}>Save fields</Button></div>}

      {canDefine && (
        <details className="max-w-md rounded-xl border border-slate-200 p-3 dark:border-white/10">
          <summary className="cursor-pointer text-sm font-medium">Add a field to this project</summary>
          <div className="mt-3 space-y-2">
            <label htmlFor="pf-new-label" className="block text-sm">Name</label>
            <Input id="pf-new-label" value={label} maxLength={80} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Donor activity code" />
            <label htmlFor="pf-new-type" className="block text-sm">Kind of answer</label>
            <Select id="pf-new-type" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              {(["TEXT", "NUMBER", "DATE", "CHOICE"] as const).map((t) => <option key={t} value={t}>{fieldTypeWords(t)}</option>)}
            </Select>
            {type === "CHOICE" && (
              <>
                <label htmlFor="pf-new-choices" className="block text-sm">Choices, one per line</label>
                <textarea id="pf-new-choices" rows={3} value={choices} onChange={(e) => setChoices(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm dark:border-white/15 dark:bg-slate-900" />
              </>
            )}
            <Button size="sm" onClick={define} pending={state.busy} disabled={!hydrated || !label.trim()}>Add field</Button>
          </div>
        </details>
      )}
    </section>
  );
}
