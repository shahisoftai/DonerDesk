"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WORKPLAN_COPY, type PlanStatus } from "@donordesk/domain/contexts/workplan/index.js";
import { assignPlannedActivityAction, changePlanStatusAction, reschedulePlannedActivityAction } from "@/lib/actions/workplan";
import { useActionState } from "@/lib/client/action-state";
import { useHydrated } from "@/lib/client/use-hydrated";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import type { PlanFormOption } from "./PlanActivityForm";

type Panel = "move" | "lead" | "cancel" | null;

export interface PlanItemMenuProps {
  itemId: string;
  status: PlanStatus;
  plannedStart: string;
  plannedEnd: string;
  inSeries: boolean;
  /** "Why?" is asked only when this is true (the original end has passed, or a report covers the activity). */
  reasonRequired: boolean;
  ownerUserId?: string;
  leads: PlanFormOption[];
  canMove: boolean;
  canAssign: boolean;
  canCancel: boolean;
}

/**
 * Move dates · Change lead · Cancel / Restore. Each action is shown only to people the server would let do it
 * (the page passes `canActOnPlanItem` results), and "Why?" appears only when it is needed.
 */
export function PlanItemMenu(p: PlanItemMenuProps) {
  const router = useRouter();
  const state = useActionState();
  const hydrated = useHydrated();
  const [panel, setPanel] = useState<Panel>(null);
  const [start, setStart] = useState(p.plannedStart);
  const [end, setEnd] = useState(p.plannedEnd);
  const [scope, setScope] = useState<"THIS" | "SERIES_FROM_HERE">("THIS");
  const [reason, setReason] = useState("");
  const [lead, setLead] = useState(p.ownerUserId ?? "");

  const open = p.status === "PLANNED" || p.status === "IN_PROGRESS";
  const close = () => { setPanel(null); setReason(""); };
  async function done(result: true | undefined) { if (result === true) { close(); router.refresh(); } }

  const move = () => state.run(() => reschedulePlannedActivityAction(p.itemId, { plannedStart: start, plannedEnd: end || start, scope, ...(reason.trim() ? { reason } : {}) })).then((r) => done(r ? true : undefined));
  const assign = () => state.run(() => assignPlannedActivityAction(p.itemId, { ownerUserId: lead || null, supportUserIds: [] })).then(done);
  const cancel = () => state.run(() => changePlanStatusAction(p.itemId, { action: "CANCEL", reason })).then(done);
  const restore = () => state.run(() => changePlanStatusAction(p.itemId, { action: "RESTORE" })).then(done);

  const whyField = (required: boolean) => (
    <Field label={WORKPLAN_COPY.whyMoved} error={state.fields?.reason?.[0]}>
      <Textarea dictate rows={2} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} required={required} />
    </Field>
  );

  const nothing = !(p.canMove && open) && !(p.canAssign && open) && !(p.canCancel && (open || p.status === "CANCELLED"));
  if (nothing) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {p.canMove && open && <Button size="sm" variant="secondary" onClick={() => setPanel("move")}>Move dates</Button>}
        {p.canAssign && open && <Button size="sm" variant="secondary" onClick={() => setPanel("lead")}>Change lead</Button>}
        {p.canCancel && open && <Button size="sm" variant="secondary" onClick={() => setPanel("cancel")}>Cancel activity</Button>}
        {p.canCancel && p.status === "CANCELLED" && <Button size="sm" variant="secondary" pending={state.busy} onClick={restore}>Restore</Button>}
      </div>

      {panel && (
        <fieldset disabled={!hydrated || state.busy} className="max-w-md space-y-3 rounded-xl border border-slate-200 p-3 dark:border-white/10">
          {panel === "move" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Starts" error={state.fields?.plannedStart?.[0]}><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
                <Field label="Ends" error={state.fields?.plannedEnd?.[0]}><Input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} /></Field>
              </div>
              {p.inSeries && (
                <div role="radiogroup" aria-label="Which activities" className="space-y-1 text-sm">
                  <label className="flex items-center gap-2"><input type="radio" className="h-4 w-4" checked={scope === "THIS"} onChange={() => setScope("THIS")} />{WORKPLAN_COPY.onlyThisOne}</label>
                  <label className="flex items-center gap-2"><input type="radio" className="h-4 w-4" checked={scope === "SERIES_FROM_HERE"} onChange={() => setScope("SERIES_FROM_HERE")} />{WORKPLAN_COPY.thisAndLater}</label>
                </div>
              )}
              {p.reasonRequired && whyField(true)}
              <div className="flex gap-2"><Button size="sm" onClick={move} pending={state.busy}>Save</Button><Button size="sm" variant="secondary" onClick={close}>Undo</Button></div>
            </>
          )}
          {panel === "lead" && (
            <>
              <Field label="Lead">
                <Select value={lead} onChange={(e) => setLead(e.target.value)}>
                  <option value="">No lead yet</option>
                  {p.leads.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                </Select>
              </Field>
              <div className="flex gap-2"><Button size="sm" onClick={assign} pending={state.busy}>Save</Button><Button size="sm" variant="secondary" onClick={close}>Cancel</Button></div>
            </>
          )}
          {panel === "cancel" && (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-300">Say why it is cancelled. It stays in the history, and can be restored.</p>
              {whyField(true)}
              <div className="flex gap-2"><Button size="sm" variant="danger" onClick={cancel} pending={state.busy} disabled={!reason.trim()}>Cancel activity</Button><Button size="sm" variant="secondary" onClick={close}>Keep it</Button></div>
            </>
          )}
          {state.error && <p role="alert" className="text-sm text-danger-600">{state.error}</p>}
        </fieldset>
      )}
    </div>
  );
}
