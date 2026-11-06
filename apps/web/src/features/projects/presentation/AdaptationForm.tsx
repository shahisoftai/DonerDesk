"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { recordAdaptationAction } from "@/lib/actions/adaptations";
import { useActionState } from "@/lib/client/action-state";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";

const today = (): string => new Date().toISOString().slice(0, 10);

/** Record a change of plan. The effect on results and the links are optional; what changed and why are not. */
export function AdaptationForm({ projectId, indicators, periods }: { projectId: string; indicators: Array<{ id: string; label: string }>; periods: Array<{ id: string; label: string }> }) {
  const router = useRouter();
  const state = useActionState();
  const [recordedOn, setRecordedOn] = useState(today());
  const [whatChanged, setWhatChanged] = useState("");
  const [why, setWhy] = useState("");
  const [effect, setEffect] = useState("");
  const [indicatorId, setIndicatorId] = useState("");
  const [reportingPeriodId, setReportingPeriodId] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const result = await state.run(() =>
      recordAdaptationAction(projectId, {
        recordedOn, whatChanged, why,
        ...(effect.trim() ? { effectOnResults: effect } : {}),
        ...(indicatorId ? { indicatorId } : {}),
        ...(reportingPeriodId ? { reportingPeriodId } : {}),
      }),
    );
    if (result) {
      setWhatChanged(""); setWhy(""); setEffect(""); setIndicatorId(""); setReportingPeriodId("");
      router.refresh();
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3" aria-label="Record a change of plan">
      <h2 className="font-medium">Record a change</h2>
      <Field label="Day it changed" htmlFor="adapt-day"><Input id="adapt-day" type="date" value={recordedOn} onChange={(e) => setRecordedOn(e.target.value)} /></Field>
      <Field label="What changed" htmlFor="adapt-what"><Textarea id="adapt-what" rows={2} maxLength={500} value={whatChanged} onChange={(e) => setWhatChanged(e.target.value)} dictate /></Field>
      <Field label="Why" htmlFor="adapt-why"><Textarea id="adapt-why" rows={2} maxLength={1000} value={why} onChange={(e) => setWhy(e.target.value)} dictate /></Field>
      <Field label="Effect on results (optional)" htmlFor="adapt-effect"><Textarea id="adapt-effect" rows={2} maxLength={1000} value={effect} onChange={(e) => setEffect(e.target.value)} dictate /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Indicator it touches (optional)" htmlFor="adapt-indicator">
          <Select id="adapt-indicator" value={indicatorId} onChange={(e) => setIndicatorId(e.target.value)}>
            <option value="">None</option>
            {indicators.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
          </Select>
        </Field>
        <Field label="Report it belongs to (optional)" htmlFor="adapt-period">
          <Select id="adapt-period" value={reportingPeriodId} onChange={(e) => setReportingPeriodId(e.target.value)}>
            <option value="">None</option>
            {periods.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </Select>
        </Field>
      </div>
      {state.error && <p role="alert" className="text-sm font-medium text-danger-700 dark:text-danger-400">{state.error}</p>}
      <Button type="submit" pending={state.busy} disabled={!whatChanged.trim() || !why.trim()}>Record the change</Button>
    </form>
  );
}
