"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { Field } from "@/components/ui/Field";
import { InlineAlert } from "@/components/feedback/InlineAlert";
import { UnsavedChangesGuard } from "@/components/editor/UnsavedChangesGuard";
import { updateTemplateRequirementsAction } from "@/lib/actions/templates";
import type { TemplateRequirementsView } from "@/lib/server/schemas";
import { ListEditor } from "./ListEditor";

const FREQUENCIES = [
  { value: "", label: "Not specified" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "SEMI_ANNUAL", label: "Semi-annual" },
  { value: "ANNUAL", label: "Annual" },
  { value: "FINAL", label: "Final" },
  { value: "CUSTOM", label: "Custom" },
];

const intOrUndefined = (v: string) => (v.trim() === "" ? undefined : Math.max(0, Math.floor(Number(v))));
const clean = (v: string[]) => v.map((x) => x.trim()).filter(Boolean);
const text = (v?: string) => (v?.trim() ? v.trim() : undefined);

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-3">
      <div>
        <h3 className="font-medium">{title}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      {children}
    </section>
  );
}

/** Report-wide donor requirements: AI guidance, formatting, submission, annexes, indicators, compliance. */
export function RequirementsEditor({
  templateId,
  initial,
  version,
  readOnly,
  onSaved,
}: {
  templateId: string;
  initial: TemplateRequirementsView;
  version: number;
  readOnly?: boolean;
  onSaved: (version: number) => void;
}) {
  const router = useRouter();
  const [req, setReq] = useState<TemplateRequirementsView>(initial);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  const update = (p: Partial<TemplateRequirementsView>) => {
    setReq((r) => ({ ...r, ...p }));
    setDirty(true);
    setMessage(null);
  };

  async function save() {
    setSaving(true);
    const payload = {
      reportTitle: text(req.reportTitle),
      reportingFrequency: req.reportingFrequency || undefined,
      submission: { ...req.submission, instructions: clean(req.submission.instructions), deadlineRule: text(req.submission.deadlineRule), channel: text(req.submission.channel), format: text(req.submission.format) },
      formatting: { ...req.formatting, rules: clean(req.formatting.rules), font: text(req.formatting.font) },
      annexes: req.annexes.filter((a) => a.name.trim()).map((a) => ({ ...a, name: a.name.trim(), description: text(a.description) })),
      indicatorRequirements: req.indicatorRequirements.filter((i) => i.text.trim()).map((i) => ({ ...i, text: i.text.trim(), disaggregation: clean(i.disaggregation) })),
      compliance: req.compliance.filter((c) => c.text.trim()).map((c) => ({ ...c, text: c.text.trim() })),
      generalInstructions: clean(req.generalInstructions),
    };
    const r = await updateTemplateRequirementsAction(templateId, payload, version);
    setSaving(false);
    if (!r.ok) {
      setMessage({ tone: "danger", text: r.error.message });
      return;
    }
    setDirty(false);
    setMessage({ tone: "success", text: `Saved as version ${r.value.version}.` });
    onSaved(r.value.version);
    router.refresh();
  }

  return (
    <fieldset disabled={readOnly} className="space-y-4">
      <UnsavedChangesGuard dirty={dirty} />
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600 dark:text-slate-400">Report-wide requirements apply to every section and are sent to the AI writer.</p>
        {!readOnly && <Button type="button" size="sm" onClick={save} pending={saving} disabled={!dirty || saving}>Save requirements</Button>}
      </div>
      {message && <InlineAlert tone={message.tone} title={message.text} />}

      <Section title="Report" description="How the donor names and schedules this report.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Report title required by the donor" htmlFor="req-title">
            <Input id="req-title" value={req.reportTitle ?? ""} onChange={(e) => update({ reportTitle: e.target.value || undefined })} />
          </Field>
          <Field label="Reporting frequency" htmlFor="req-freq">
            <Select id="req-freq" value={req.reportingFrequency ?? ""} onChange={(e) => update({ reportingFrequency: e.target.value || undefined })}>
              {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </Select>
          </Field>
        </div>
      </Section>

      <Section title="Instructions for the AI writer" description="Donor guidance that applies to the whole report (audience, tone, what to avoid).">
        <ListEditor label="General instructions" items={req.generalInstructions} onChange={(v) => update({ generalInstructions: v })} addLabel="Add instruction" multiline />
      </Section>

      <Section title="Formatting" description="Layout and length rules.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Maximum pages (whole report)" htmlFor="req-pages">
            <Input id="req-pages" type="number" min={1} value={req.formatting.maxPages ?? ""} onChange={(e) => update({ formatting: { ...req.formatting, maxPages: intOrUndefined(e.target.value) || undefined } })} />
          </Field>
          <Field label="Font" htmlFor="req-font">
            <Input id="req-font" value={req.formatting.font ?? ""} onChange={(e) => update({ formatting: { ...req.formatting, font: e.target.value || undefined } })} />
          </Field>
        </div>
        <ListEditor label="Formatting rules" items={req.formatting.rules} onChange={(v) => update({ formatting: { ...req.formatting, rules: v } })} addLabel="Add rule" />
      </Section>

      <Section title="Submission" description="Deadline and how the report is submitted. The deadline offset pre-fills reporting periods.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Deadline rule (as written)" htmlFor="req-deadline">
            <Input id="req-deadline" value={req.submission.deadlineRule ?? ""} onChange={(e) => update({ submission: { ...req.submission, deadlineRule: e.target.value || undefined } })} />
          </Field>
          <Field label="Days after period end" htmlFor="req-offset">
            <Input id="req-offset" type="number" min={0} value={req.submission.deadlineOffsetDays ?? ""} onChange={(e) => update({ submission: { ...req.submission, deadlineOffsetDays: intOrUndefined(e.target.value) } })} />
          </Field>
          <Field label="Submission channel" htmlFor="req-channel">
            <Input id="req-channel" value={req.submission.channel ?? ""} placeholder="e.g. donor portal, grants@donor.org" onChange={(e) => update({ submission: { ...req.submission, channel: e.target.value || undefined } })} />
          </Field>
          <Field label="File format" htmlFor="req-format">
            <Input id="req-format" value={req.submission.format ?? ""} placeholder="e.g. PDF and Word" onChange={(e) => update({ submission: { ...req.submission, format: e.target.value || undefined } })} />
          </Field>
        </div>
        <ListEditor label="Submission instructions" items={req.submission.instructions} onChange={(v) => update({ submission: { ...req.submission, instructions: v } })} addLabel="Add instruction" multiline />
      </Section>

      <Section title="Annexes" description="Documents to attach. Required annexes are checked in report readiness.">
        {req.annexes.map((a, i) => (
          <div key={a.id ?? i} className="flex flex-wrap items-center gap-2">
            <Input aria-label="Annex name" className="min-w-[12rem] flex-1" value={a.name} onChange={(e) => update({ annexes: req.annexes.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
            <Input aria-label="Annex description" className="min-w-[12rem] flex-1" placeholder="Description (optional)" value={a.description ?? ""} onChange={(e) => update({ annexes: req.annexes.map((x, j) => (j === i ? { ...x, description: e.target.value || undefined } : x)) })} />
            <label className="flex items-center gap-1 text-xs">
              <Switch checked={a.required} onCheckedChange={(v) => update({ annexes: req.annexes.map((x, j) => (j === i ? { ...x, required: v } : x)) })} label={`${a.name} required`} /> Required
            </label>
            <Button type="button" size="sm" variant="ghost" aria-label="Remove annex" onClick={() => update({ annexes: req.annexes.filter((_, j) => j !== i) })}>✕</Button>
          </div>
        ))}
        <Button type="button" size="sm" variant="secondary" onClick={() => update({ annexes: [...req.annexes, { name: "", required: true }] })}>Add annex</Button>
      </Section>

      <Section title="Indicator reporting" description="How the donor wants indicators reported, including disaggregation.">
        {req.indicatorRequirements.map((r, i) => (
          <div key={r.id ?? i} className="flex flex-wrap items-center gap-2">
            <Input aria-label="Indicator requirement" className="min-w-[16rem] flex-[2]" value={r.text} onChange={(e) => update({ indicatorRequirements: req.indicatorRequirements.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} />
            <Input
              aria-label="Disaggregation (comma separated)"
              className="min-w-[10rem] flex-1"
              placeholder="Disaggregate by (sex, age, …)"
              value={r.disaggregation.join(", ")}
              onChange={(e) => update({ indicatorRequirements: req.indicatorRequirements.map((x, j) => (j === i ? { ...x, disaggregation: e.target.value.split(",").map((d) => d.trimStart()) } : x)) })}
            />
            <Button type="button" size="sm" variant="ghost" aria-label="Remove requirement" onClick={() => update({ indicatorRequirements: req.indicatorRequirements.filter((_, j) => j !== i) })}>✕</Button>
          </div>
        ))}
        <Button type="button" size="sm" variant="secondary" onClick={() => update({ indicatorRequirements: [...req.indicatorRequirements, { text: "", disaggregation: [] }] })}>Add requirement</Button>
      </Section>

      <Section title="Compliance" description="Rules the report must respect. Blocking rules must be confirmed before submission.">
        {req.compliance.map((c, i) => (
          <div key={c.id ?? i} className="flex flex-wrap items-center gap-2">
            <Input aria-label="Compliance rule" className="min-w-[16rem] flex-1" value={c.text} onChange={(e) => update({ compliance: req.compliance.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} />
            <Select aria-label="Severity" value={c.severity} onChange={(e) => update({ compliance: req.compliance.map((x, j) => (j === i ? { ...x, severity: e.target.value as typeof c.severity } : x)) })}>
              <option value="INFO">Info</option>
              <option value="WARN">Warning</option>
              <option value="BLOCK">Blocking</option>
            </Select>
            <Button type="button" size="sm" variant="ghost" aria-label="Remove rule" onClick={() => update({ compliance: req.compliance.filter((_, j) => j !== i) })}>✕</Button>
          </div>
        ))}
        <Button type="button" size="sm" variant="secondary" onClick={() => update({ compliance: [...req.compliance, { text: "", severity: "WARN" }] })}>Add rule</Button>
      </Section>
    </fieldset>
  );
}
