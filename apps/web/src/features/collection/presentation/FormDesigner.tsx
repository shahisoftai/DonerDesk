"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveCollectionFormAction } from "@/lib/actions/collection";
import { useActionState } from "@/lib/client/action-state";
import type { CollectionFormView } from "@/lib/server/schemas-collection";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Checkbox } from "@/components/ui/Checkbox";

type FieldType = CollectionFormView["fields"][number]["type"];
type Op = "EQ" | "NEQ" | "GT" | "LT" | "FILLED" | "EMPTY";

const TYPE_LABEL: Record<FieldType, string> = { NUMBER: "Number", TEXT: "Text", DATE: "Date", SELECT: "Choice", YES_NO: "Yes / No", PLACE: "Place", GPS: "GPS point" };
const OP_LABEL: Record<Op, string> = { EQ: "is", NEQ: "is not", GT: "is more than", LT: "is less than", FILLED: "has an answer", EMPTY: "has no answer" };

interface Rule { field: string; op: Op; value: string }
interface Draft {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  optionsText: string;
  min: string;
  max: string;
  showWhen: Rule | null;
  /** A rule the designer cannot show (a group of conditions) is kept as it was. */
  customShow?: unknown;
  requiredWhen: Rule | null;
  customRequired?: unknown;
}
interface MappingDraft { indicatorId: string; method: "COUNT" | "SUM"; valueField: string; dateField: string; dedupFields: string[] }

const asRule = (c: unknown): { rule: Rule | null; custom?: unknown } => {
  if (!c) return { rule: null };
  const leaf = c as { field?: unknown; op?: unknown; value?: unknown };
  if (typeof leaf.field === "string" && typeof leaf.op === "string" && ["EQ", "NEQ", "GT", "LT", "FILLED", "EMPTY"].includes(leaf.op)) {
    return { rule: { field: leaf.field, op: leaf.op as Op, value: leaf.value === undefined ? "" : String(leaf.value) } };
  }
  return { rule: null, custom: c };
};

const ruleToCondition = (r: Rule | null, custom: unknown) => {
  if (r && r.field) return r.op === "FILLED" || r.op === "EMPTY" ? { field: r.field, op: r.op } : { field: r.field, op: r.op, value: r.op === "GT" || r.op === "LT" ? Number(r.value) : r.value };
  return custom ?? undefined;
};

function toDraft(f: CollectionFormView["fields"][number]): Draft {
  const show = asRule(f.relevantWhen);
  const req = asRule(f.requiredWhen);
  return {
    key: f.key, label: f.label, type: f.type, required: f.required === true,
    optionsText: (f.options ?? []).map((o) => o.label).join("\n"), min: f.min === undefined ? "" : String(f.min), max: f.max === undefined ? "" : String(f.max),
    showWhen: show.rule, customShow: show.custom, requiredWhen: req.rule, customRequired: req.custom,
  };
}

const slug = (text: string) => text.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 30);

/** Designs a draft form: its questions, when each is asked or required, and which indicator the records add up to. */
export function FormDesigner({ projectId, form, indicators }: { projectId: string; form?: CollectionFormView; indicators: Array<{ id: string; label: string }> }) {
  const router = useRouter();
  const save = useActionState();
  const [name, setName] = useState(form?.name ?? "");
  const [description, setDescription] = useState(form?.description ?? "");
  const [fields, setFields] = useState<Draft[]>(() => (form?.fields ?? []).map(toDraft));
  const [mappings, setMappings] = useState<MappingDraft[]>(() =>
    (form?.mappings ?? []).map((m) => ({ indicatorId: m.indicatorId, method: m.method, valueField: m.valueField ?? "", dateField: m.dateField ?? "", dedupFields: m.dedupFields ?? [] })),
  );

  const patch = (i: number, p: Partial<Draft>) => setFields((list) => list.map((f, j) => (j === i ? { ...f, ...p } : f)));
  const addField = () => setFields((list) => {
    const taken = new Set(list.map((f) => f.key));
    let n = list.length + 1;
    while (taken.has(`q${n}`)) n += 1;
    return [...list, { key: `q${n}`, label: "", type: "NUMBER", required: true, optionsText: "", min: "", max: "", showWhen: null, requiredWhen: null }];
  });
  const remove = (i: number) => setFields((list) => list.filter((_, j) => j !== i).map((f) => ({
    ...f,
    showWhen: f.showWhen?.field === list[i]!.key ? null : f.showWhen,
    requiredWhen: f.requiredWhen?.field === list[i]!.key ? null : f.requiredWhen,
  })));
  const move = (i: number, by: -1 | 1) => setFields((list) => {
    const j = i + by;
    if (j < 0 || j >= list.length) return list;
    const next = [...list];
    [next[i], next[j]] = [next[j]!, next[i]!];
    return next;
  });

  const numberFields = fields.filter((f) => f.type === "NUMBER");
  const dateFields = fields.filter((f) => f.type === "DATE");

  async function submit() {
    const payload = {
      projectId, name, description: description.trim() || undefined,
      fields: fields.map((f) => {
        const options = f.type === "SELECT" ? f.optionsText.split("\n").map((l) => l.trim()).filter(Boolean).map((label, idx) => ({ value: slug(label) || `option_${idx + 1}`, label })) : undefined;
        const label = f.label.trim();
        return {
          key: f.key, label, type: f.type, ...(f.required ? { required: true } : {}),
          ...(f.type === "SELECT" ? { options } : {}),
          ...(f.type === "NUMBER" && f.min.trim() !== "" ? { min: Number(f.min) } : {}), ...(f.type === "NUMBER" && f.max.trim() !== "" ? { max: Number(f.max) } : {}),
          ...(ruleToCondition(f.showWhen, f.customShow) ? { relevantWhen: ruleToCondition(f.showWhen, f.customShow) } : {}),
          ...(ruleToCondition(f.requiredWhen, f.customRequired) ? { requiredWhen: ruleToCondition(f.requiredWhen, f.customRequired) } : {}),
        };
      }),
      mappings: mappings.filter((m) => m.indicatorId).map((m) => ({
        indicatorId: m.indicatorId, method: m.method,
        ...(m.method === "SUM" && m.valueField ? { valueField: m.valueField } : {}), ...(m.dateField ? { dateField: m.dateField } : {}),
        ...(m.dedupFields.length ? { dedupFields: m.dedupFields } : {}),
      })),
    };
    const result = await save.run(() => saveCollectionFormAction(payload, form?.id));
    if (result && typeof result === "object" && "id" in result) router.push(`/projects/${projectId}/forms/${(result as { id: string }).id}`);
  }

  const labelOf = (key: string) => fields.find((f) => f.key === key)?.label.trim() || "an earlier question";

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Form name"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} /></Field>
        <Field label="What it is for (optional)"><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} /></Field>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Questions</h2>
        {fields.length === 0 && <p className="text-sm text-slate-500">No questions yet. Add the first one.</p>}
        {fields.map((f, i) => {
          const earlier = fields.slice(0, i);
          return (
            <div key={f.key} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto]">
                <Field label={`Question ${i + 1}`}><Input value={f.label} onChange={(e) => patch(i, { label: e.target.value })} maxLength={200} /></Field>
                <Field label="Answer type">
                  <Select value={f.type} onChange={(e) => patch(i, { type: e.target.value as FieldType })}>
                    {(Object.keys(TYPE_LABEL) as FieldType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                  </Select>
                </Field>
                <div className="flex items-end gap-1">
                  <Button variant="secondary" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move question ${i + 1} up`}>↑</Button>
                  <Button variant="secondary" onClick={() => move(i, 1)} disabled={i === fields.length - 1} aria-label={`Move question ${i + 1} down`}>↓</Button>
                  <Button variant="secondary" onClick={() => remove(i)} aria-label={`Remove question ${i + 1}`}>Remove</Button>
                </div>
              </div>
              <label className="mt-2 flex items-center gap-2 text-sm"><Checkbox checked={f.required} onChange={(e) => patch(i, { required: e.target.checked })} /> Always required</label>
              {f.type === "SELECT" && (
                <Field label="Choices, one per line"><Textarea rows={3} value={f.optionsText} onChange={(e) => patch(i, { optionsText: e.target.value })} /></Field>
              )}
              {f.type === "NUMBER" && (
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <Field label="Smallest allowed (optional)"><Input inputMode="decimal" value={f.min} onChange={(e) => patch(i, { min: e.target.value })} /></Field>
                  <Field label="Largest allowed (optional)"><Input inputMode="decimal" value={f.max} onChange={(e) => patch(i, { max: e.target.value })} /></Field>
                </div>
              )}
              {earlier.length > 0 && (
                <div className="mt-3 space-y-2 text-sm">
                  <RuleEditor title="Ask this only when" earlier={earlier} labelOf={labelOf} rule={f.showWhen} custom={f.customShow !== undefined} onChange={(r) => patch(i, { showWhen: r, customShow: undefined })} />
                  <RuleEditor title="Make it required when" earlier={earlier} labelOf={labelOf} rule={f.requiredWhen} custom={f.customRequired !== undefined} onChange={(r) => patch(i, { requiredWhen: r, customRequired: undefined })} />
                </div>
              )}
            </div>
          );
        })}
        <Button variant="secondary" onClick={addField}>Add a question</Button>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">What the answers add up to</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">Each accepted record is counted, or a number from it is added up, into an indicator for the period its date falls in.</p>
        {mappings.map((m, i) => (
          <div key={i} className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-2 dark:border-slate-700">
            <Field label="Indicator">
              <Select value={m.indicatorId} onChange={(e) => setMappings((l) => l.map((x, j) => (j === i ? { ...x, indicatorId: e.target.value } : x)))}>
                <option value="">Choose an indicator…</option>
                {indicators.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </Select>
            </Field>
            <Field label="How">
              <Select value={m.method} onChange={(e) => setMappings((l) => l.map((x, j) => (j === i ? { ...x, method: e.target.value as "COUNT" | "SUM" } : x)))}>
                <option value="COUNT">Count the records</option>
                <option value="SUM">Add up a number</option>
              </Select>
            </Field>
            {m.method === "SUM" && (
              <Field label="The number to add up">
                <Select value={m.valueField} onChange={(e) => setMappings((l) => l.map((x, j) => (j === i ? { ...x, valueField: e.target.value } : x)))}>
                  <option value="">Choose a question…</option>
                  {numberFields.map((f) => <option key={f.key} value={f.key}>{f.label || "Untitled question"}</option>)}
                </Select>
              </Field>
            )}
            <Field label="The date that decides the period" description="If you leave it empty, the day the record was sent is used.">
              <Select value={m.dateField} onChange={(e) => setMappings((l) => l.map((x, j) => (j === i ? { ...x, dateField: e.target.value } : x)))}>
                <option value="">The day it was sent</option>
                {dateFields.map((f) => <option key={f.key} value={f.key}>{f.label || "Untitled question"}</option>)}
              </Select>
            </Field>
            <div className="sm:col-span-2"><Button variant="secondary" onClick={() => setMappings((l) => l.filter((_, j) => j !== i))}>Remove this</Button></div>
          </div>
        ))}
        <Button variant="secondary" onClick={() => setMappings((l) => [...l, { indicatorId: "", method: "COUNT", valueField: "", dateField: "", dedupFields: [] }])}>Add an indicator</Button>
      </section>

      {save.error && <p role="alert" className="text-sm text-danger-600">{save.error}</p>}
      <Button onClick={() => void submit()} pending={save.busy} disabled={save.busy || !name.trim()}>Save the draft</Button>
    </div>
  );
}

function RuleEditor({ title, earlier, labelOf, rule, custom, onChange }: {
  title: string; earlier: Draft[]; labelOf: (key: string) => string; rule: Rule | null; custom: boolean; onChange: (r: Rule | null) => void;
}) {
  if (custom) return <p className="text-xs text-slate-500">{title}: a combined rule that is kept as it is. Choose a simple rule below to replace it.<Button variant="secondary" onClick={() => onChange({ field: earlier[0]!.key, op: "EQ", value: "" })}>Replace it</Button></p>;
  if (!rule) return <button type="button" className="text-xs text-brand-600 hover:underline dark:text-brand-400" onClick={() => onChange({ field: earlier[0]!.key, op: "EQ", value: "" })}>{title}…</button>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs">{title}</span>
      <Select aria-label={`${title}: question`} value={rule.field} onChange={(e) => onChange({ ...rule, field: e.target.value })}>
        {earlier.map((e) => <option key={e.key} value={e.key}>{labelOf(e.key)}</option>)}
      </Select>
      <Select aria-label={`${title}: comparison`} value={rule.op} onChange={(e) => onChange({ ...rule, op: e.target.value as Op })}>
        {(Object.keys(OP_LABEL) as Op[]).map((o) => <option key={o} value={o}>{OP_LABEL[o]}</option>)}
      </Select>
      {rule.op !== "FILLED" && rule.op !== "EMPTY" && <Input aria-label={`${title}: value`} className="max-w-[10rem]" value={rule.value} onChange={(e) => onChange({ ...rule, value: e.target.value })} />}
      <button type="button" className="text-xs text-slate-500 hover:underline" onClick={() => onChange(null)}>Remove</button>
    </div>
  );
}
