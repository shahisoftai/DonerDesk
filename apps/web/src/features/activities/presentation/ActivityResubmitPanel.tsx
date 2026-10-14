"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resubmitActivityAction } from "@/lib/actions/activities";
import { useActionState } from "@/lib/client/action-state";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";

export interface ResubmitInitial {
  summary: string;
  achievements: string;
  challenges: string;
  lessonsLearned: string;
  nextSteps: string;
  location: string;
  /** The planned activity (logframe node) the record is linked to; empty = not linked. */
  logframeActivityId: string;
}

/**
 * Answers a revision request on the same page: the reviewer's notes are shown beside the text (never inside it),
 * the submitter corrects the record and sends it back to review.
 */
export function ActivityResubmitPanel({ activityId, notes, initial, logframeActivities = [] }: { activityId: string; notes: string[]; initial: ResubmitInitial; logframeActivities?: Array<{ id: string; label: string }> }) {
  const router = useRouter();
  const actionState = useActionState();
  const [form, setForm] = useState(initial);
  const [leaving, setLeaving] = useState(false);
  const set = (key: keyof ResubmitInitial) => (value: string) => setForm((f) => ({ ...f, [key]: value }));
  const fields = actionState.fields ?? {};

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const result = await actionState.run(() =>
      resubmitActivityAction(activityId, {
        summary: form.summary.trim(),
        achievements: form.achievements,
        challenges: form.challenges,
        lessonsLearned: form.lessonsLearned,
        nextSteps: form.nextSteps,
        location: form.location.trim() || undefined,
        // only sent when it changed, so a record keeps its link unless the person changes it
        logframeActivityId: form.logframeActivityId !== initial.logframeActivityId && form.logframeActivityId ? form.logframeActivityId : undefined,
      }),
    );
    if (result) {
      setLeaving(true);
      router.refresh();
    }
  }

  return (
    <section aria-labelledby="resubmit-title" className="card space-y-4">
      <h2 id="resubmit-title" className="text-sm font-medium text-slate-800 dark:text-slate-100">Answer the revision request</h2>
      {notes.length > 0 && (
        <div role="note" className="rounded-lg border border-warning-500/30 bg-warning-500/5 p-3 text-sm">
          <p className="font-medium text-warning-800 dark:text-warning-300">{notes.length === 1 ? "The reviewer asked:" : "The reviewer asked:"}</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-700 dark:text-slate-200">
            {notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </div>
      )}
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Summary" htmlFor="resubmit-summary" error={fields.patch?.[0] ?? fields["patch.summary"]?.[0]}>
          <Textarea dictate id="resubmit-summary" value={form.summary} onChange={(e) => set("summary")(e.target.value)} className="min-h-[120px]" maxLength={10000} required />
        </Field>
        <Field label="Location" htmlFor="resubmit-location"><Input id="resubmit-location" value={form.location} onChange={(e) => set("location")(e.target.value)} maxLength={200} /></Field>
        {logframeActivities.length > 0 && (
          <Field label="Planned activity (logframe)" htmlFor="resubmit-node" hint="Link the record to the activity it delivers, so the logframe and the reports count it.">
            <Select id="resubmit-node" value={form.logframeActivityId} onChange={(e) => set("logframeActivityId")(e.target.value)}>
              <option value="">Not linked to a planned activity</option>
              {logframeActivities.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Achievements" htmlFor="resubmit-achievements"><Textarea dictate id="resubmit-achievements" value={form.achievements} onChange={(e) => set("achievements")(e.target.value)} maxLength={5000} /></Field>
        <Field label="Challenges" htmlFor="resubmit-challenges"><Textarea dictate id="resubmit-challenges" value={form.challenges} onChange={(e) => set("challenges")(e.target.value)} maxLength={5000} /></Field>
        <Field label="Lessons learned" htmlFor="resubmit-lessons"><Textarea dictate id="resubmit-lessons" value={form.lessonsLearned} onChange={(e) => set("lessonsLearned")(e.target.value)} maxLength={5000} /></Field>
        <Field label="Next steps" htmlFor="resubmit-next"><Textarea dictate id="resubmit-next" value={form.nextSteps} onChange={(e) => set("nextSteps")(e.target.value)} maxLength={5000} /></Field>
        {actionState.error && <p role="alert" className="text-sm font-medium text-danger-700 dark:text-danger-400">{actionState.error}</p>}
        <div className="flex justify-end">
          <Button type="submit" pending={actionState.busy || leaving} disabled={leaving || !form.summary.trim()}>Resubmit for review</Button>
        </div>
      </form>
    </section>
  );
}
