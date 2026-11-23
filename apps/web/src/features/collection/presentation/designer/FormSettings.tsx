"use client";

import { useState } from "react";
import type { ConstraintKind, FormConstraint } from "@donordesk/domain/contexts/collection/index.js";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";

export type Subject = "NONE" | "FACILITY" | "PLACE";
const SUBJECT_LABEL: Record<Subject, string> = { NONE: "Nothing in particular", FACILITY: "A facility (one assessment per visit)", PLACE: "A place" };
const KIND_LABEL: Record<ConstraintKind, string> = { LTE: "is not more than", GTE: "is not less than", SUM_EQUALS: "equals the sum of", ONE_OF_REQUIRED: "at least one of these is given" };

export interface FormSettingsValue { subject: Subject; constraints: FormConstraint[]; scoreText: string; languages: string }

/**
 * What a form is about, the rules across answers (functional beds not above sanctioned beds), how it scores, and the languages its wording
 * exists in. The score is edited as its rules (a kit supplies them); a mistake is named when the form is saved.
 */
export function FormSettings({ value, onChange, questions }: { value: FormSettingsValue; onChange(v: FormSettingsValue): void; questions: Array<{ key: string; label: string }> }) {
  const [open, setOpen] = useState(value.subject !== "NONE" || value.constraints.length > 0 || value.scoreText.trim() !== "" || value.languages.trim() !== "");
  const patch = (p: Partial<FormSettingsValue>) => onChange({ ...value, ...p });
  const label = (k: string) => questions.find((q) => q.key === k)?.label || k;
  const setRule = (i: number, rule: FormConstraint) => patch({ constraints: value.constraints.map((c, j) => (j === i ? rule : c)) });
  return (
    <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <summary className="cursor-pointer text-base font-semibold">Assessment settings (facility forms, rules, score, languages)</summary>
      <div className="mt-3 space-y-5">
        <Field label="What one record is about" description="A facility form is filled once per facility visit, can be given to assessors, and keeps the visits apart so they can be compared.">
          <Select value={value.subject} onChange={(e) => patch({ subject: e.target.value as Subject })}>{(Object.keys(SUBJECT_LABEL) as Subject[]).map((s) => <option key={s} value={s}>{SUBJECT_LABEL[s]}</option>)}</Select>
        </Field>

        <div className="space-y-2">
          <p className="text-sm font-medium">Rules across answers</p>
          {value.constraints.map((c, i) => (
            <div key={i} className="grid gap-2 rounded-md border border-slate-200 p-2 sm:grid-cols-[2fr_1.5fr_2fr_auto] dark:border-slate-700">
              <Select aria-label={`Rule ${i + 1}: first question`} value={c.fields[0] ?? ""} onChange={(e) => setRule(i, { ...c, fields: [e.target.value, ...c.fields.slice(1)] })}>{questions.map((q) => <option key={q.key} value={q.key}>{label(q.key)}</option>)}</Select>
              <Select aria-label={`Rule ${i + 1}: kind`} value={c.kind} onChange={(e) => setRule(i, { ...c, kind: e.target.value as ConstraintKind })}>{(Object.keys(KIND_LABEL) as ConstraintKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</Select>
              <Input aria-label={`Rule ${i + 1}: other questions (keys, separated by commas)`} placeholder="keys of the other questions, comma separated" value={c.fields.slice(1).join(", ")} onChange={(e) => setRule(i, { ...c, fields: [c.fields[0] ?? "", ...e.target.value.split(",").map((s) => s.trim()).filter(Boolean)] })} />
              <Button variant="secondary" onClick={() => patch({ constraints: value.constraints.filter((_, j) => j !== i) })} aria-label={`Remove rule ${i + 1}`}>Remove</Button>
            </div>
          ))}
          <Button variant="secondary" onClick={() => patch({ constraints: [...value.constraints, { kind: "LTE", fields: [questions[0]?.key ?? "", questions[1]?.key ?? ""] }] })} disabled={questions.length < 2}>Add a rule</Button>
        </div>

        <Field label="Score rules (advanced)" description="How answers become a score: sections, items with points per answer, and bands. A ready-made form comes with its own. Leave empty for no score.">
          <Textarea rows={6} value={value.scoreText} onChange={(e) => patch({ scoreText: e.target.value })} className="font-mono text-xs" spellCheck={false} />
        </Field>

        <Field label="Languages this form has wording for" description="Language codes separated by commas, for example ur, ps, fr. Add the wording for each language in the table below.">
          <Input value={value.languages} onChange={(e) => patch({ languages: e.target.value })} placeholder="ur, ps" />
        </Field>
      </div>
    </details>
  );
}
