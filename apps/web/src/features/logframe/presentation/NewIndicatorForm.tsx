"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createIndicatorAction } from "@/lib/actions/indicators";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/feedback/InlineAlert";
import { INDICATOR_TYPE_OPTIONS, INDICATOR_TYPE_LABEL } from "@/lib/labels";
import type { OutlineSource } from "@/features/logframe/domain/logframe-outline";
import { LogframeItemSelect } from "./LogframeItemSelect";
import { SemanticsBadge } from "./SemanticsBadge";
import { ConfirmSemanticsButton } from "./ConfirmSemanticsButton";
import Link from "next/link";

/** Types whose value is usually calculated from two other indicators, so the calculation must be configured. */
const CALCULATED_TYPES = new Set(["PERCENTAGE", "RATIO"]);

export function NewIndicatorForm({
  projectId,
  items,
  initialItemId,
}: {
  projectId: string;
  items: OutlineSource[];
  initialItemId?: string;
}) {
  const router = useRouter();
  const [logframeItemId, setLogframeItemId] = useState(items.some((item) => item.id === initialItemId) ? initialItemId ?? "" : "");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("NUMBER");
  const [baseline, setBaseline] = useState("");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("");
  const [meansOfVerification, setMeansOfVerification] = useState("");
  const [dataSource, setDataSource] = useState("");
  const [frequency, setFrequency] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ id: string; summary: string; needsReview: boolean } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    // Stay locked while leaving the page: re-enabling the button during the route change allowed a second save.
    let leaving = false;
    try {
      const result = await createIndicatorAction({
        projectId,
        logframeItemId,
        code,
        name,
        type,
        baseline: baseline || undefined,
        target: target || undefined,
        unit: unit || undefined,
        meansOfVerification: meansOfVerification || undefined,
        dataSource: dataSource || undefined,
        frequency: frequency || undefined,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      const description = result.value.semanticsDescription;
      if (description) {
        // Show how reports will treat it right away, with a one-click confirm, instead of leaving it to be found later.
        setCreated({ id: result.value.id, summary: description.summary, needsReview: description.needsReview });
        router.refresh();
        return;
      }
      leaving = true;
      router.push(`/projects/${projectId}/logframe`);
      router.refresh();
    } finally { if (!leaving) setBusy(false); }
  }

  if (created) {
    return (
      <section className="card mt-6 space-y-4" aria-live="polite">
        <h2 className="font-semibold">Indicator saved</h2>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <SemanticsBadge description={{ summary: created.summary, needsReview: created.needsReview }} />
          <span>{created.summary}</span>
        </div>
        <div className="flex flex-wrap gap-3">
          {created.needsReview && <ConfirmSemanticsButton indicatorIds={[created.id]} label="Confirm as suggested" size="md" />}
          <Link className="btn-secondary" href={`/projects/${projectId}/indicators/${encodeURIComponent(created.id)}#semantics-heading`}>Change calculation</Link>
          <Link className="btn-secondary" href={`/projects/${projectId}/logframe`}>Done</Link>
        </div>
      </section>
    );
  }

  return (
    <form onSubmit={submit} className="card mt-6 space-y-4">
      <Field label="Measures" htmlFor="logframeItemId" description="The goal, outcome, output or activity this indicator measures.">
        <LogframeItemSelect id="logframeItemId" items={items} value={logframeItemId} onChange={setLogframeItemId} emptyLabel="Choose a logframe item…" required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Code" htmlFor="code">
          <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. O1.1" required />
        </Field>
        <Field label="Type" htmlFor="type">
          <Select id="type" value={type} onChange={(e) => setType(e.target.value)}>
            {INDICATOR_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{INDICATOR_TYPE_LABEL[t]}</option>)}
          </Select>
        </Field>
      </div>
      {CALCULATED_TYPES.has(type) && (
        <InlineAlert tone="info" title="You'll set how this rate is calculated next">
          After saving you can confirm that it is reported directly (e.g. a survey result), or choose a numerator and denominator indicator to calculate it from.
        </InlineAlert>
      )}
      <Field label="Indicator name" htmlFor="name">
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Baseline" htmlFor="baseline">
          <Input id="baseline" value={baseline} onChange={(e) => setBaseline(e.target.value)} />
        </Field>
        <Field label="Target" htmlFor="target">
          <Input id="target" value={target} onChange={(e) => setTarget(e.target.value)} />
        </Field>
      </div>
      <Field label="Unit (optional)" htmlFor="unit">
        <Input id="unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="e.g. households" />
      </Field>
      <Field label="Means of verification (optional)" htmlFor="meansOfVerification">
        <Input id="meansOfVerification" value={meansOfVerification} onChange={(e) => setMeansOfVerification(e.target.value)} />
      </Field>
      <Field label="Data source (optional)" htmlFor="dataSource">
        <Input id="dataSource" value={dataSource} onChange={(e) => setDataSource(e.target.value)} />
      </Field>
      <Field label="Frequency (optional)" htmlFor="frequency">
        <Input id="frequency" value={frequency} onChange={(e) => setFrequency(e.target.value)} />
      </Field>
      {error && <InlineAlert tone="danger" title={error} />}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" pending={busy}>Save indicator</Button>
      </div>
    </form>
  );
}
