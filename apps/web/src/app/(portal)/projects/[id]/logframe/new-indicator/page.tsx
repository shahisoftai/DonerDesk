"use client";
import { use, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createIndicatorAction } from "@/lib/actions/indicators";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/feedback/InlineAlert";
import { INDICATOR_TYPE_OPTIONS, INDICATOR_TYPE_LABEL } from "@/lib/labels";

export default function NewIndicatorPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [logframeItemId, setLogframeItemId] = useState("");
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

  useEffect(() => {
    const itemId = searchParams.get("itemId");
    if (itemId) setLogframeItemId(itemId);
  }, [searchParams]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const result = await createIndicatorAction({
        projectId: resolvedParams.id,
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
      router.push(`/projects/${resolvedParams.id}/logframe`);
      router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <div className="animate-fade-in mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">Add indicator</h1>
      <form onSubmit={submit} className="card mt-6 space-y-4">
        <Field label="Logframe item id" htmlFor="logframeItemId" description="Paste the id of the logframe item this indicator belongs to (e.g. a goal, outcome, or output).">
          <Input id="logframeItemId" value={logframeItemId} onChange={(e) => setLogframeItemId(e.target.value)} required />
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
    </div>
  );
}
