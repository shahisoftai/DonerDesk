"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { FormConstraint } from "@donordesk/domain/contexts/collection/index.js";
import { saveCollectionFormAction } from "@/lib/actions/collection";
import { useActionState } from "@/lib/client/action-state";
import type { CollectionFormView } from "@/lib/server/schemas-collection";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { FIELD_TYPE_ORDER, TYPE_LABEL, blankDraft, fieldOf, freshKey, toDraft, type Draft } from "../domain/designer-model";
import { FormSettings, type FormSettingsValue } from "./designer/FormSettings";
import { RuleEditor } from "./designer/RuleEditor";
import { TranslationsPanel } from "./designer/TranslationsPanel";
import { TYPE_DETAILS } from "./designer/TypeDetails";

type Method = CollectionFormView["mappings"][number]["method"];
interface MappingDraft { indicatorId: string; method: Method; valueField: string; dateField: string; dedupFields: string[]; where?: unknown; latestPerFacility?: boolean }
const METHOD_LABEL: Record<Method, string> = {
  COUNT: "Count the records", SUM: "Add up a number", COUNT_WHERE: "Count the records where…", PERCENT_WHERE: "Share of records where… (a percent)", AVERAGE_SCORE: "Average score of the records",
};
const WHERE_OPS = { EQ: "is", NEQ: "is not" } as const;

/** Designs a draft form: its questions (sections, tables, repeats, calculated figures…), rules and score, and which indicator the records add up to. */
export function FormDesigner({ projectId, form, indicators, start }: { projectId: string; form?: CollectionFormView; indicators: Array<{ id: string; label: string }>; start?: Array<Record<string, unknown>> }) {
  const router = useRouter();
  const save = useActionState();
  const [name, setName] = useState(form?.name ?? "");
  const [description, setDescription] = useState(form?.description ?? "");
  const [fields, setFields] = useState<Draft[]>(() => ((form?.fields ?? start ?? []) as never[]).map(toDraft));
  const [settings, setSettings] = useState<FormSettingsValue>(() => ({
    subject: form?.subject ?? "NONE", constraints: (form?.constraints ?? []) as FormConstraint[], scoreText: form?.score ? JSON.stringify(form.score, null, 2) : "", languages: (form?.languages ?? []).join(", "),
  }));
  const [mappings, setMappings] = useState<MappingDraft[]>(() => (form?.mappings ?? []).map((m) => ({
    indicatorId: m.indicatorId, method: m.method, valueField: m.valueField ?? "", dateField: m.dateField ?? "", dedupFields: m.dedupFields ?? [], ...(m.where ? { where: m.where } : {}), ...(m.latestPerFacility ? { latestPerFacility: true } : {}),
  })));
  const [scoreError, setScoreError] = useState("");

  const patch = (i: number, p: Partial<Draft>) => setFields((list) => list.map((f, j) => (j === i ? { ...f, ...p } : f)));
  const addField = (type: Draft["type"] = "NUMBER") => setFields((list) => [...list, blankDraft(freshKey(list.map((f) => f.key)), type)]);
  const remove = (i: number) => setFields((list) => list.filter((_, j) => j !== i).map((f) => ({
    ...f, showWhen: f.showWhen?.field === list[i]!.key ? null : f.showWhen, requiredWhen: f.requiredWhen?.field === list[i]!.key ? null : f.requiredWhen,
  })));
  const move = (i: number, by: -1 | 1) => setFields((list) => {
    const j = i + by;
    if (j < 0 || j >= list.length) return list;
    const next = [...list];
    [next[i], next[j]] = [next[j]!, next[i]!];
    return next;
  });
  const translate = (i: number, lang: string, label: string, help: string) => setFields((list) => list.map((f, j) => {
    if (j !== i) return f;
    const original = { ...(f.original ?? { key: f.key, label: f.label, type: f.type }) };
    const labels = { ...(original.labels ?? {}) }; if (label.trim()) labels[lang] = label; else delete labels[lang];
    const helpLabels = { ...(original.helpLabels ?? {}) }; if (help.trim()) helpLabels[lang] = help; else delete helpLabels[lang];
    return { ...f, original: { ...original, ...(Object.keys(labels).length ? { labels } : { labels: undefined }), ...(Object.keys(helpLabels).length ? { helpLabels } : { helpLabels: undefined }) } as never };
  }));

  const askable = fields.filter((f) => f.type !== "SECTION" && f.type !== "NOTE");
  const numberFields = fields.filter((f) => f.type === "NUMBER");
  const dateFields = fields.filter((f) => f.type === "DATE");
  const languages = useMemo(() => settings.languages.split(",").map((l) => l.trim().toLowerCase()).filter(Boolean), [settings.languages]);
  const labelOf = (key: string) => fields.find((f) => f.key === key)?.label.trim() || "an earlier question";

  async function submit() {
    setScoreError("");
    let score: unknown;
    if (settings.scoreText.trim()) {
      try { score = JSON.parse(settings.scoreText); } catch { setScoreError("The score rules are not valid. Check the commas and brackets."); return; }
    }
    const payload = {
      projectId, name, description: description.trim() || undefined,
      fields: fields.map(fieldOf),
      ...(settings.constraints.length ? { constraints: settings.constraints.filter((c) => c.fields.length >= 2) } : {}),
      ...(settings.subject !== "NONE" ? { subject: settings.subject } : {}),
      ...(score ? { score } : {}),
      ...(languages.length ? { languages } : {}),
      mappings: mappings.filter((m) => m.indicatorId).map((m) => ({
        indicatorId: m.indicatorId, method: m.method,
        ...(m.method === "SUM" && m.valueField ? { valueField: m.valueField } : {}), ...(m.dateField ? { dateField: m.dateField } : {}),
        ...(m.dedupFields.length ? { dedupFields: m.dedupFields } : {}), ...(m.where ? { where: m.where } : {}), ...(m.latestPerFacility ? { latestPerFacility: true } : {}),
      })),
    };
    const result = await save.run(() => saveCollectionFormAction(payload, form?.id));
    if (result && typeof result === "object" && "id" in result) router.push(`/projects/${projectId}/forms/${(result as { id: string }).id}`);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Form name"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} /></Field>
        <Field label="What it is for (optional)"><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} /></Field>
      </div>

      <FormSettings value={settings} onChange={setSettings} questions={askable.map((f) => ({ key: f.key, label: f.label }))} />
      {scoreError && <p role="alert" className="text-sm text-danger-600">{scoreError}</p>}

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Questions</h2>
        {fields.length === 0 && <p className="text-sm text-slate-500">No questions yet. Add the first one.</p>}
        {fields.map((f, i) => {
          const earlier = fields.slice(0, i);
          const Details = TYPE_DETAILS[f.type];
          const heading = f.type === "SECTION" || f.type === "NOTE";
          return (
            <div key={f.key} className={`rounded-lg border p-3 ${f.type === "SECTION" ? "border-brand-300 bg-brand-50/40 dark:border-brand-700 dark:bg-slate-800/40" : "border-slate-200 dark:border-slate-700"}`}>
              <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto]">
                <Field label={f.type === "SECTION" ? "Section title" : f.type === "NOTE" ? "Note" : `Question ${i + 1}`}>
                  {f.type === "NOTE" ? <Textarea rows={2} value={f.label} onChange={(e) => patch(i, { label: e.target.value })} maxLength={2000} /> : <Input value={f.label} onChange={(e) => patch(i, { label: e.target.value })} maxLength={f.type === "SECTION" ? 200 : 600} />}
                </Field>
                <Field label="Type">
                  <Select value={f.type} onChange={(e) => patch(i, { type: e.target.value as Draft["type"] })}>{FIELD_TYPE_ORDER.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</Select>
                </Field>
                <div className="flex items-end gap-1">
                  <Button variant="secondary" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move item ${i + 1} up`}>↑</Button>
                  <Button variant="secondary" onClick={() => move(i, 1)} disabled={i === fields.length - 1} aria-label={`Move item ${i + 1} down`}>↓</Button>
                  <Button variant="secondary" onClick={() => remove(i)} aria-label={`Remove item ${i + 1}`}>Remove</Button>
                </div>
              </div>
              <p className="mt-1 text-xs text-slate-500">Key: <code>{f.key}</code> (rules, formulas and the score name a question by this)</p>
              {!heading && f.type !== "CALCULATED" && <label className="mt-2 flex items-center gap-2 text-sm"><Checkbox checked={f.required} onChange={(e) => patch(i, { required: e.target.checked })} /> Always required</label>}
              {Details && <Details draft={f} patch={(p) => patch(i, p)} takenKeys={fields.map((x) => x.key)} earlier={earlier.filter((e) => ["NUMBER", "CALCULATED"].includes(e.type)).map((e) => ({ key: e.key, label: e.label }))} />}
              <Field label={f.type === "SECTION" ? "Introduction (optional)" : "Instructions shown under the question (optional)"}><Textarea rows={2} value={f.help} onChange={(e) => patch(i, { help: e.target.value })} maxLength={4000} /></Field>
              {!heading && !["REPEAT", "GRID", "CALCULATED", "SIGNATURE"].includes(f.type) && (
                <div className="mt-2 flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2"><Checkbox checked={f.allowNotApplicable} onChange={(e) => patch(i, { allowNotApplicable: e.target.checked })} /> Can be "not applicable"</label>
                  <label className="flex items-center gap-2"><Checkbox checked={f.carryForward} onChange={(e) => patch(i, { carryForward: e.target.checked })} /> Offer the last visit's answer</label>
                </div>
              )}
              <div className="mt-3 space-y-2 text-sm">
                <RuleEditor title={f.type === "SECTION" ? "Ask this section only when" : "Ask this only when"} earlier={earlier} labelOf={labelOf} rule={f.showWhen} custom={f.customShow !== undefined} onChange={(r) => patch(i, { showWhen: r, customShow: undefined })} />
                {!heading && <RuleEditor title="Make it required when" earlier={earlier} labelOf={labelOf} rule={f.requiredWhen} custom={f.customRequired !== undefined} onChange={(r) => patch(i, { requiredWhen: r, customRequired: undefined })} />}
              </div>
            </div>
          );
        })}
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => addField("NUMBER")}>Add a question</Button>
          <Button variant="secondary" onClick={() => addField("SECTION")}>Add a section</Button>
          <Button variant="secondary" onClick={() => addField("GRID")}>Add a table</Button>
          <Button variant="secondary" onClick={() => addField("REPEAT")}>Add a repeating group</Button>
        </div>
      </section>

      <TranslationsPanel languages={languages} fields={fields} onChange={translate} />

      <section className="space-y-3">
        <h2 className="text-base font-semibold">What the answers add up to</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">Each accepted record is counted, or a figure from it is worked out, into an indicator for the period its date falls in. A form that is only an assessment may leave this empty.</p>
        {mappings.map((m, i) => {
          const set = (p: Partial<MappingDraft>) => setMappings((l) => l.map((x, j) => (j === i ? { ...x, ...p } : x)));
          const where = (m.where ?? { field: "", op: "EQ", value: "" }) as { field: string; op: "EQ" | "NEQ"; value: string };
          return (
            <div key={i} className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-2 dark:border-slate-700">
              <Field label="Indicator"><Select value={m.indicatorId} onChange={(e) => set({ indicatorId: e.target.value })}><option value="">Choose an indicator…</option>{indicators.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</Select></Field>
              <Field label="How"><Select value={m.method} onChange={(e) => set({ method: e.target.value as Method })}>{(Object.keys(METHOD_LABEL) as Method[]).map((k) => <option key={k} value={k}>{METHOD_LABEL[k]}</option>)}</Select></Field>
              {m.method === "SUM" && <Field label="The number to add up"><Select value={m.valueField} onChange={(e) => set({ valueField: e.target.value })}><option value="">Choose a question…</option>{numberFields.map((f) => <option key={f.key} value={f.key}>{f.label || "Untitled question"}</option>)}</Select></Field>}
              {(m.method === "COUNT_WHERE" || m.method === "PERCENT_WHERE") && (
                <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
                  <Field label="Records where"><Select value={where.field} onChange={(e) => set({ where: { ...where, field: e.target.value } })}><option value="">Choose a question…</option>{askable.map((f) => <option key={f.key} value={f.key}>{f.label || "Untitled question"}</option>)}</Select></Field>
                  <Select aria-label="Comparison" value={where.op} onChange={(e) => set({ where: { ...where, op: e.target.value } })}>{(Object.keys(WHERE_OPS) as Array<keyof typeof WHERE_OPS>).map((o) => <option key={o} value={o}>{WHERE_OPS[o]}</option>)}</Select>
                  <Input aria-label="Value" className="max-w-[10rem]" placeholder="yes" value={String(where.value ?? "")} onChange={(e) => set({ where: { ...where, value: e.target.value } })} />
                </div>
              )}
              <Field label="The date that decides the period" description="If you leave it empty, the day the record was sent is used."><Select value={m.dateField} onChange={(e) => set({ dateField: e.target.value })}><option value="">The day it was sent</option>{dateFields.map((f) => <option key={f.key} value={f.key}>{f.label || "Untitled question"}</option>)}</Select></Field>
              {settings.subject !== "NONE" && <label className="flex items-center gap-2 text-sm"><Checkbox checked={m.latestPerFacility === true} onChange={(e) => set({ latestPerFacility: e.target.checked })} /> Count only the latest record of each facility in a period</label>}
              <div className="sm:col-span-2"><Button variant="secondary" onClick={() => setMappings((l) => l.filter((_, j) => j !== i))}>Remove this</Button></div>
            </div>
          );
        })}
        <Button variant="secondary" onClick={() => setMappings((l) => [...l, { indicatorId: "", method: "COUNT", valueField: "", dateField: "", dedupFields: [] }])}>Add an indicator</Button>
      </section>

      {save.error && <p role="alert" className="text-sm text-danger-600">{save.error}</p>}
      <Button onClick={() => void submit()} pending={save.busy} disabled={save.busy || !name.trim()}>Save the draft</Button>
    </div>
  );
}
