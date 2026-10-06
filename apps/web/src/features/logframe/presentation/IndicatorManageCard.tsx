"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { archiveIndicatorAction, moveIndicatorAction, updateIndicatorAction } from "@/lib/actions/indicators";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { InlineAlert } from "@/components/feedback/InlineAlert";
import type { OutlineSource } from "@/features/logframe/domain/logframe-outline";
import { LogframeItemSelect } from "./LogframeItemSelect";

export interface ManagedIndicator {
  id: string;
  projectId: string;
  logframeItemId?: string;
  name: string;
  code: string;
  baseline: string;
  target: string;
  unit?: string;
  disaggregationRequired: boolean;
}

/**
 * Fixes an indicator after it was created: its wording, targets and breakdown, the item it measures, or removing it.
 * Every refusal comes back from the server with its reason and is shown as-is.
 */
export function IndicatorManageCard({ indicator, items }: { indicator: ManagedIndicator; items: OutlineSource[] }) {
  const router = useRouter();
  const [name, setName] = useState(indicator.name);
  const [code, setCode] = useState(indicator.code);
  const [baseline, setBaseline] = useState(indicator.baseline);
  const [target, setTarget] = useState(indicator.target);
  const [unit, setUnit] = useState(indicator.unit ?? "");
  const [breakdown, setBreakdown] = useState(indicator.disaggregationRequired);
  const [itemId, setItemId] = useState(indicator.logframeItemId ?? "");
  const [busy, setBusy] = useState<"save" | "move" | "remove" | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  async function save() {
    if (busy) return;
    setBusy("save");
    setMessage(null);
    const result = await updateIndicatorAction({
      indicatorId: indicator.id,
      name: name.trim(),
      code: code.trim(),
      baseline,
      target,
      unit: unit.trim() || undefined,
      disaggregationRequired: breakdown,
    });
    setBusy(null);
    if (!result.ok) return setMessage({ tone: "error", text: result.error.message });
    setMessage({ tone: "ok", text: "Saved." });
    router.refresh();
  }

  async function move() {
    if (busy || !itemId) return;
    setBusy("move");
    setMessage(null);
    const result = await moveIndicatorAction({ indicatorId: indicator.id, logframeItemId: itemId });
    setBusy(null);
    if (!result.ok) return setMessage({ tone: "error", text: result.error.message });
    setMessage({ tone: "ok", text: result.value.moved ? "Moved." : "Already under that item." });
    router.refresh();
  }

  async function remove() {
    if (busy) return;
    setBusy("remove");
    const result = await archiveIndicatorAction(indicator.id);
    if (!result.ok) {
      setBusy(null);
      setConfirmRemove(false);
      return setMessage({ tone: "error", text: result.error.message });
    }
    // Stay locked while leaving the page.
    router.push(`/projects/${indicator.projectId}/logframe`);
    router.refresh();
  }

  return (
    <section className="card mt-4 space-y-4" aria-labelledby="manage-heading">
      <h3 id="manage-heading" className="font-medium">Edit indicator</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Code" htmlFor="manage-code"><Input id="manage-code" value={code} onChange={(e) => setCode(e.target.value)} /></Field>
        <Field label="Unit" htmlFor="manage-unit"><Input id="manage-unit" value={unit} onChange={(e) => setUnit(e.target.value)} /></Field>
      </div>
      <Field label="Name" htmlFor="manage-name"><Input id="manage-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Baseline" htmlFor="manage-baseline"><Input id="manage-baseline" value={baseline} onChange={(e) => setBaseline(e.target.value)} /></Field>
        <Field label="Target" htmlFor="manage-target"><Input id="manage-target" value={target} onChange={(e) => setTarget(e.target.value)} /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={breakdown} onChange={(e) => setBreakdown(e.target.checked)} />
        <span>Record a breakdown by sex, age group and disability</span>
      </label>
      <div><Button onClick={() => void save()} pending={busy === "save"} disabled={busy !== null || !name.trim() || !code.trim()}>Save changes</Button></div>

      <div className="border-t border-slate-200 pt-4 dark:border-white/10">
        <Field label="Measures" htmlFor="manage-item" description="Move this indicator under a different goal, outcome, output or activity.">
          <LogframeItemSelect id="manage-item" items={items} value={itemId} onChange={setItemId} emptyLabel="Choose a logframe item…" />
        </Field>
        <div className="mt-3">
          <Button variant="secondary" onClick={() => void move()} pending={busy === "move"} disabled={busy !== null || !itemId || itemId === indicator.logframeItemId}>Move indicator</Button>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-4 dark:border-white/10">
        <Button variant="danger" onClick={() => setConfirmRemove(true)} disabled={busy !== null}>Remove indicator</Button>
      </div>

      {message && (message.tone === "error"
        ? <InlineAlert tone="danger" title={message.text} />
        : <p role="status" className="text-sm text-success-700 dark:text-success-400">{message.text}</p>)}

      <ConfirmDialog
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        onConfirm={() => remove()}
        pending={busy === "remove"}
        title="Remove this indicator?"
        message="If nothing was recorded for it, it is deleted. If values exist, it is archived: reports keep their history and you can restore it."
        confirmLabel="Remove"
      />
    </section>
  );
}
