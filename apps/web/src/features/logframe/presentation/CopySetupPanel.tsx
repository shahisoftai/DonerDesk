"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { copyProjectSetupAction } from "@/lib/actions/logframe";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/feedback/InlineAlert";

/** Offered on an empty logframe: reuse another project's results framework instead of rebuilding it. */
export function CopySetupPanel({
  projectId,
  candidates,
  canCopyPlan = false,
}: {
  projectId: string;
  canCopyPlan?: boolean;
  candidates: Array<{ id: string; title: string }>;
}) {
  const router = useRouter();
  const [sourceId, setSourceId] = useState("");
  const [copyPlan, setCopyPlan] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (candidates.length === 0) return null;

  async function copy() {
    setBusy(true);
    setError(null);
    const result = await copyProjectSetupAction(projectId, { sourceProjectId: sourceId, copyWorkPlan: copyPlan });
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    // The logframe was copied either way; say so when the plan could not be.
    if (copyPlan && result.value.planMessage) setNote(`The logframe was copied. The planned activities were not: ${result.value.planMessage}`);
    router.refresh();
  }

  return (
    <div className="card mt-3 space-y-3">
      <h3 className="text-sm font-medium">Reuse another project&apos;s logframe</h3>
      <Field label="Copy from" htmlFor="copy-setup-source" description="Copies the results hierarchy and the indicator definitions. Recorded values, evidence and activities are not copied.">
        <Select id="copy-setup-source" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
          <option value="">Choose a project…</option>
          {candidates.map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </Select>
      </Field>
      {canCopyPlan && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4" checked={copyPlan} onChange={(e) => setCopyPlan(e.target.checked)} />
          Also copy the planned activities (dates move with this project&apos;s start; leads and progress are not copied)
        </label>
      )}
      {note && <InlineAlert tone="warning" title={note} />}
      {error && <InlineAlert tone="danger" title={error} />}
      <Button type="button" size="sm" pending={busy} disabled={!sourceId || busy} onClick={() => void copy()}>
        Copy logframe and indicators
      </Button>
    </div>
  );
}
