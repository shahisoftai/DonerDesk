"use client";

import type { FormFieldType } from "@donordesk/domain/contexts/collection/index.js";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { CHILD_TYPES, COLUMN_LABEL, COLUMN_TYPES, TYPE_LABEL, newChild, newColumn, type Draft } from "../../domain/designer-model";

interface DetailProps { draft: Draft; patch(p: Partial<Draft>): void; takenKeys: string[]; /** The questions before this one that hold a figure, for a formula to name. */ earlier: Array<{ key: string; label: string }> }

const Choices = ({ draft, patch }: DetailProps) => <Field label="Choices, one per line"><Textarea rows={3} value={draft.optionsText} onChange={(e) => patch({ optionsText: e.target.value })} /></Field>;

const Range = ({ draft, patch }: DetailProps) => (
  <div className="mt-2 grid grid-cols-2 gap-3">
    <Field label="Smallest allowed (optional)"><Input inputMode="decimal" value={draft.min} onChange={(e) => patch({ min: e.target.value })} /></Field>
    <Field label="Largest allowed (optional)"><Input inputMode="decimal" value={draft.max} onChange={(e) => patch({ max: e.target.value })} /></Field>
  </div>
);

const Table = ({ draft, patch, takenKeys }: DetailProps) => (
  <div className="mt-2 space-y-3">
    <Field label="Rows, one per line" description="Each line is one item to answer, for example a room or a service."><Textarea rows={5} value={draft.rowsText} onChange={(e) => patch({ rowsText: e.target.value })} /></Field>
    <div className="space-y-2">
      <p className="text-sm font-medium">Columns</p>
      {draft.columns.map((c, i) => {
        const set = (p: Partial<typeof c>) => patch({ columns: draft.columns.map((x, j) => (j === i ? { ...x, ...p } : x)) });
        return (
          <div key={c.key} className="grid gap-2 rounded-md border border-slate-200 p-2 sm:grid-cols-[2fr_1fr_auto] dark:border-slate-700">
            <Input aria-label={`Column ${i + 1} name`} placeholder="Column name" value={c.label} onChange={(e) => set({ label: e.target.value })} />
            <Select aria-label={`Column ${i + 1} type`} value={c.type} onChange={(e) => set({ type: e.target.value as typeof c.type })}>{COLUMN_TYPES.map((t) => <option key={t} value={t}>{COLUMN_LABEL[t]}</option>)}</Select>
            <Button variant="secondary" onClick={() => patch({ columns: draft.columns.filter((_, j) => j !== i) })} aria-label={`Remove column ${i + 1}`}>Remove</Button>
            {c.type === "SELECT" && <div className="sm:col-span-3"><Textarea rows={2} aria-label={`Column ${i + 1} choices`} placeholder="Choices, one per line" value={c.optionsText} onChange={(e) => set({ optionsText: e.target.value })} /></div>}
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={c.required} onChange={(e) => set({ required: e.target.checked })} /> Required</label>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={c.allowNotApplicable} onChange={(e) => set({ allowNotApplicable: e.target.checked })} /> Can be "not applicable"</label>
          </div>
        );
      })}
      <Button variant="secondary" onClick={() => patch({ columns: [...draft.columns, newColumn([...takenKeys, ...draft.columns.map((c) => c.key)])] })}>Add a column</Button>
    </div>
  </div>
);

const Repeat = ({ draft, patch }: DetailProps) => (
  <div className="mt-2 space-y-3">
    <div className="grid gap-3 sm:grid-cols-3">
      <Field label="What one row is called"><Input value={draft.rowLabel} placeholder="Block, ward, person…" onChange={(e) => patch({ rowLabel: e.target.value })} maxLength={60} /></Field>
      <Field label="Fewest rows"><Input inputMode="numeric" value={draft.minRows} onChange={(e) => patch({ minRows: e.target.value })} /></Field>
      <Field label="Most rows"><Input inputMode="numeric" value={draft.maxRows} onChange={(e) => patch({ maxRows: e.target.value })} /></Field>
    </div>
    <div className="space-y-2">
      <p className="text-sm font-medium">Questions asked for every row</p>
      {draft.children.map((c, i) => {
        const set = (p: Partial<typeof c>) => patch({ children: draft.children.map((x, j) => (j === i ? { ...x, ...p } : x)) });
        return (
          <div key={c.key} className="grid gap-2 rounded-md border border-slate-200 p-2 sm:grid-cols-[2fr_1fr_auto] dark:border-slate-700">
            <Input aria-label={`Row question ${i + 1}`} placeholder="Question" value={c.label} onChange={(e) => set({ label: e.target.value })} />
            <Select aria-label={`Row question ${i + 1} type`} value={c.type} onChange={(e) => set({ type: e.target.value as FormFieldType })}>{CHILD_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</Select>
            <Button variant="secondary" onClick={() => patch({ children: draft.children.filter((_, j) => j !== i) })} aria-label={`Remove row question ${i + 1}`}>Remove</Button>
            {(c.type === "SELECT" || c.type === "MULTI_SELECT") && <div className="sm:col-span-3"><Textarea rows={2} aria-label={`Row question ${i + 1} choices`} placeholder="Choices, one per line" value={c.optionsText} onChange={(e) => set({ optionsText: e.target.value })} /></div>}
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={c.required} onChange={(e) => set({ required: e.target.checked })} /> Required</label>
          </div>
        );
      })}
      <Button variant="secondary" onClick={() => patch({ children: [...draft.children, newChild(draft.children.map((c) => c.key))] })}>Add a question to the row</Button>
    </div>
  </div>
);

const Calculated = ({ draft, patch, earlier }: DetailProps) => (
  <div className="mt-2 space-y-2">
    <div className="grid gap-3 sm:grid-cols-[3fr_1fr]">
      <Field label="Formula" description="Name earlier questions by their key (shown under each question), with + − * / and brackets, for example q3 / q2 * 100. sum(table.*.column) adds a column of a table or repeat.">
        <Input value={draft.formula} onChange={(e) => patch({ formula: e.target.value })} maxLength={400} />
      </Field>
      <Field label="Decimals"><Input inputMode="numeric" value={draft.decimals} onChange={(e) => patch({ decimals: e.target.value })} /></Field>
    </div>
    {earlier.length > 0 && (
      <label className="flex items-center gap-2 text-sm">Add a question to the formula:
        <Select aria-label="Add a question to the formula" value="" onChange={(e) => e.target.value && patch({ formula: `${draft.formula}${draft.formula && !draft.formula.endsWith(" ") ? " " : ""}${e.target.value}` })}>
          <option value="">Choose…</option>
          {earlier.map((q) => <option key={q.key} value={q.key}>{q.label || q.key} ({q.key})</option>)}
        </Select>
      </label>
    )}
  </div>
);

const Signature = ({ draft, patch }: DetailProps) => <Field label="Who signs"><Input value={draft.signer} onChange={(e) => patch({ signer: e.target.value })} placeholder="Medical Superintendent" maxLength={120} /></Field>;

/** The extra settings each question type has. A type with none is `null`; the table is typed over every type, so a new type must say. */
export const TYPE_DETAILS: Readonly<Record<FormFieldType, ((p: DetailProps) => React.ReactNode) | null>> = {
  NUMBER: Range, TEXT: null, DATE: null, SELECT: Choices, MULTI_SELECT: Choices, YES_NO: null, PLACE: null, GPS: null, FILE: null,
  SIGNATURE: Signature, SECTION: null, NOTE: null, GRID: Table, REPEAT: Repeat, CALCULATED: Calculated,
};
