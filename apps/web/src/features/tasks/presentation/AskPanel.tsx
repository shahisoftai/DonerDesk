"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WORKPLAN_COPY } from "@donordesk/domain/contexts/workplan/index.js";
import { createTaskAction } from "@/lib/actions/tasks";
import { useActionState } from "@/lib/client/action-state";
import { useHydrated } from "@/lib/client/use-hydrated";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { peopleFor, type AskKind, type ProjectPerson } from "../domain/ask-people";

export interface AskPanelProps {
  projectId: string;
  /** Set by the button that opens the panel; the person never chooses it. */
  kind: AskKind;
  /** The label of that button ("Ask for a file"). */
  buttonLabel: string;
  subject?: { type: "plannedActivity" | "activityUpdate" | "indicator"; id: string };
  /** When no subject is pinned: the planned activities to pick from ("Which planned activity is this?"). */
  subjects?: Array<{ id: string; title: string }>;
  /** An indicator value is for a reporting period: the person picks which. */
  periods?: Array<{ id: string; label: string }>;
  people: ProjectPerson[];
  /** The subject's own lead, offered first. */
  leadId?: string;
  /** Suggested by the server rule (an activity's end + 3 days, otherwise today + 3 days); always editable. */
  suggestedDue: string;
  variant?: "primary" | "secondary";
}

/**
 * The one request dialog: Who · By when (suggested) · Note · Urgent (and the period, for a value). The kind is implied by the
 * button, the title is written for the person, and only people who could do it are offered. Creating is repeatable by key.
 */
export function AskPanel(props: AskPanelProps) {
  const router = useRouter();
  const state = useActionState();
  const hydrated = useHydrated();
  const eligible = peopleFor(props.kind, props.people, props.leadId);
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [assignee, setAssignee] = useState(eligible[0]?.id ?? "");
  const [subjectId, setSubjectId] = useState(props.subject?.id ?? props.subjects?.[0]?.id ?? "");
  const [due, setDue] = useState(props.suggestedDue);
  const [period, setPeriod] = useState(props.periods?.[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [what, setWhat] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const subject = props.subject ?? (props.subjects ? { type: "plannedActivity" as const, id: subjectId } : undefined);
    const out = await state.runCreate((idempotencyKey) =>
      createTaskAction(props.projectId, {
        kind: props.kind, assigneeId: assignee, dueDate: due, urgent,
        ...(subject ? { subjectType: subject.type, subjectId: subject.id } : {}),
        ...(props.periods ? { reportingPeriodId: period } : {}),
        ...(note.trim() ? { note } : {}),
        ...(props.kind === "OTHER" ? { title: what } : {}),
      }, { idempotencyKey }),
    );
    if (out) { setSent(true); setOpen(false); setNote(""); router.refresh(); }
  }

  if (eligible.length === 0) return null;
  const err = (k: string) => state.fields?.[k]?.[0];
  const needsSubject = !props.subject && props.subjects !== undefined;
  return (
    <div className="space-y-2">
      {sent && !open && <p role="status" className="text-sm text-slate-600 dark:text-slate-300">Request sent.</p>}
      {!open ? (
        <Button size="sm" variant={props.variant ?? "secondary"} onClick={() => { setSent(false); setOpen(true); }}>{props.buttonLabel}</Button>
      ) : (
        <form onSubmit={send} className="max-w-md space-y-3 rounded-xl border border-slate-200 p-3 dark:border-white/10" aria-label={props.buttonLabel}>
          <fieldset disabled={!hydrated || state.busy} className="space-y-3">
            {props.kind === "OTHER" && (
              <Field label="What are you asking for?" error={err("title")}><Input value={what} onChange={(e) => setWhat(e.target.value)} maxLength={300} required /></Field>
            )}
            {needsSubject && (
              <Field label={WORKPLAN_COPY.whichPlanned} error={err("subjectId")}>
                <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                  {props.subjects!.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                </Select>
              </Field>
            )}
            <Field label="Who" error={err("assigneeId")}>
              <Select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                {eligible.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </Select>
            </Field>
            {props.periods && (
              <Field label="Reporting period" error={err("reportingPeriodId")}>
                <Select value={period} onChange={(e) => setPeriod(e.target.value)}>
                  {props.periods.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </Select>
              </Field>
            )}
            <Field label="By when" error={err("dueDate")}><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} required /></Field>
            <Field label="Note (optional)" error={err("note")}><Textarea dictate rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />Urgent</label>
          </fieldset>
          {state.error && <p role="alert" className="text-sm text-danger-600">{state.error}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" pending={state.busy} disabled={!hydrated || !assignee || (needsSubject && !subjectId)}>Send</Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      )}
    </div>
  );
}
