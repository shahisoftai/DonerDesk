"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WORKPLAN_COPY } from "@donordesk/domain/contexts/workplan/index.js";
import { createPlannedActivityAction } from "@/lib/actions/workplan";
import { useActionState } from "@/lib/client/action-state";
import { useHydrated } from "@/lib/client/use-hydrated";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";

export interface PlanFormOption { id: string; label: string }

/** Title · Dates · Repeats · Lead · Logframe activity; the rest under "More details". One date makes a milestone. */
export function PlanActivityForm({ projectId, leads, activities }: { projectId: string; leads: PlanFormOption[]; activities: PlanFormOption[] }) {
  const router = useRouter();
  const state = useActionState();
  const hydrated = useHydrated();
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [repeat, setRepeat] = useState<"" | "WEEK" | "MONTH">("");
  const [until, setUntil] = useState("");
  const [lead, setLead] = useState("");
  const [node, setNode] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [people, setPeople] = useState("");
  const [sessions, setSessions] = useState("");

  const num = (v: string) => (v.trim() ? Number(v) : undefined);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const out = await state.runCreate((idempotencyKey) =>
      createPlannedActivityAction(projectId, {
        title,
        plannedStart: start,
        plannedEnd: end || start,
        ...(repeat ? { repeats: { every: repeat, until } } : {}),
        ...(lead ? { ownerUserId: lead } : {}),
        ...(node ? { logframeActivityId: node } : {}),
        ...(location.trim() ? { location } : {}),
        ...(description.trim() ? { description } : {}),
        ...(num(people) !== undefined ? { targetParticipants: num(people) } : {}),
        ...(num(sessions) !== undefined ? { targetCount: num(sessions) } : {}),
      }, { idempotencyKey }),
    );
    if (out) router.push(`/projects/${projectId}/activities?view=planned`);
  }

  const err = (k: string) => state.fields?.[k]?.[0];
  return (
    <form onSubmit={submit} className="max-w-xl space-y-4" aria-busy={state.busy}>
      <fieldset disabled={!hydrated || state.busy} className="space-y-4">
        <Field label="Title" error={err("title")}><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts" error={err("plannedStart")}><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} required /></Field>
          <Field label="Ends (leave empty for one day)" error={err("plannedEnd")}><Input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Repeats">
            <Select value={repeat} onChange={(e) => setRepeat(e.target.value as "" | "WEEK" | "MONTH")}>
              <option value="">No</option><option value="WEEK">Every week</option><option value="MONTH">Every month</option>
            </Select>
          </Field>
          {repeat && <Field label="Until" error={err("repeats.until")}><Input type="date" value={until} min={start} onChange={(e) => setUntil(e.target.value)} required /></Field>}
        </div>
        <Field label="Lead">
          <Select value={lead} onChange={(e) => setLead(e.target.value)}>
            <option value="">No lead yet</option>
            {leads.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </Select>
        </Field>
        {activities.length > 0 && (
          <Field label="Logframe activity">
            <Select value={node} onChange={(e) => setNode(e.target.value)}>
              <option value="">Not linked</option>
              {activities.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </Select>
          </Field>
        )}
        <details>
          <summary className="cursor-pointer text-sm text-slate-600 dark:text-slate-300">More details</summary>
          <div className="mt-3 space-y-4">
            <Field label="Location"><Input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} /></Field>
            <Field label="Notes"><Textarea dictate rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="People expected" error={err("targetParticipants")}><Input inputMode="numeric" value={people} onChange={(e) => setPeople(e.target.value)} /></Field>
              <Field label="Number of sessions" error={err("targetCount")}><Input inputMode="numeric" value={sessions} onChange={(e) => setSessions(e.target.value)} /></Field>
            </div>
          </div>
        </details>
      </fieldset>
      {state.error && <p role="alert" className="text-sm text-danger-600">{state.error}</p>}
      <Button type="submit" pending={state.busy} disabled={!hydrated}>{WORKPLAN_COPY.addPlanned}</Button>
    </form>
  );
}
