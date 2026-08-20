"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createActivityAction } from "@/lib/actions/activities";
import { useActionState } from "@/lib/client/action-state";
import { validateParticipantBreakdown } from "@/lib/shared/participants";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormSummary } from "@/components/ui/FormSummary";

type PeriodOption = { id: string; label: string };
type EvidenceOption = { id: string; label: string };

export function NewActivityForm({
  projectId,
  reportingPeriods,
  evidenceOptions,
}: {
  projectId: string;
  reportingPeriods: PeriodOption[];
  evidenceOptions: EvidenceOption[];
}) {
  const router = useRouter();
  const actionState = useActionState();

  const [reportingPeriodId, setReportingPeriodId] = useState(reportingPeriods[0]?.id ?? "");
  const [activityTitle, setActivityTitle] = useState("");
  const [activityDate, setActivityDate] = useState("");
  const [location, setLocation] = useState("");
  const [participantsTotal, setParticipantsTotal] = useState("");
  const [participantsMale, setParticipantsMale] = useState("");
  const [participantsFemale, setParticipantsFemale] = useState("");
  const [participantsChildren, setParticipantsChildren] = useState("");
  const [participantsDisability, setParticipantsDisability] = useState("");
  const [summary, setSummary] = useState("");
  const [achievements, setAchievements] = useState("");
  const [challenges, setChallenges] = useState("");
  const [lessonsLearned, setLessonsLearned] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [selectedEvidence, setSelectedEvidence] = useState<string[]>([]);
  const [localErrors, setLocalErrors] = useState<Record<string, string[]>>({});

  const fields = actionState.fields ?? localErrors;

  function toggleEvidence(id: string) {
    setSelectedEvidence((prev) => (prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    const participantErrors = validateParticipantBreakdown({
      participantsTotal: participantsTotal ? Number(participantsTotal) : undefined,
      participantsMale: participantsMale ? Number(participantsMale) : undefined,
      participantsFemale: participantsFemale ? Number(participantsFemale) : undefined,
      participantsChildren: participantsChildren ? Number(participantsChildren) : undefined,
      participantsDisability: participantsDisability ? Number(participantsDisability) : undefined,
    });
    if (Object.keys(participantErrors).length > 0) {
      setLocalErrors(participantErrors);
      return;
    }
    setLocalErrors({});

    const dateValue = activityDate ? new Date(activityDate).toISOString() : undefined;
    const result = await actionState.run(() =>
      createActivityAction({
        projectId,
        reportingPeriodId,
        activityTitle,
        activityDate: dateValue ?? new Date().toISOString(),
        location: location || undefined,
        participantsTotal: participantsTotal ? Number(participantsTotal) : undefined,
        participantsMale: participantsMale ? Number(participantsMale) : undefined,
        participantsFemale: participantsFemale ? Number(participantsFemale) : undefined,
        participantsChildren: participantsChildren ? Number(participantsChildren) : undefined,
        participantsDisability: participantsDisability ? Number(participantsDisability) : undefined,
        summary,
        achievements,
        challenges,
        lessonsLearned,
        nextSteps,
        attachedEvidenceIds: selectedEvidence,
      }),
    );
    if (result) {
      router.push(`/projects/${projectId}/activities`);
      router.refresh();
    }
  }

  const errorCount = Object.keys(fields).reduce((sum, key) => sum + (fields[key]?.length ?? 0), 0);

  return (
    <form onSubmit={submit} className="card mt-6 grid max-w-3xl gap-4" noValidate>
      <FormSummary errors={fields} count={errorCount} />

      <Field label="Reporting period" htmlFor="reportingPeriodId" error={fields.reportingPeriodId?.[0]}>
        <Select
          id="reportingPeriodId"
          name="reportingPeriodId"
          value={reportingPeriodId}
          onChange={(e) => setReportingPeriodId(e.target.value)}
          invalid={Boolean(fields.reportingPeriodId)}
          required
        >
          {reportingPeriods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Activity title" htmlFor="activityTitle" error={fields.activityTitle?.[0]}>
        <Input
          id="activityTitle"
          name="activityTitle"
          value={activityTitle}
          onChange={(e) => setActivityTitle(e.target.value)}
          invalid={Boolean(fields.activityTitle)}
          required
          maxLength={300}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Activity date" htmlFor="activityDate" error={fields.activityDate?.[0]}>
          <Input
            id="activityDate"
            name="activityDate"
            type="date"
            value={activityDate}
            onChange={(e) => setActivityDate(e.target.value)}
            invalid={Boolean(fields.activityDate)}
            required
          />
        </Field>
        <Field label="Location" htmlFor="location" error={fields.location?.[0]}>
          <Input
            id="location"
            name="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            invalid={Boolean(fields.location)}
            maxLength={200}
          />
        </Field>
      </div>

      <fieldset className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
        <legend className="px-1 text-sm font-medium text-slate-700 dark:text-slate-200">Participants (optional)</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Total participants" htmlFor="participantsTotal" error={fields.participantsTotal?.[0]}>
            <Input
              id="participantsTotal"
              name="participantsTotal"
              type="number"
              min={0}
              inputMode="numeric"
              value={participantsTotal}
              onChange={(e) => setParticipantsTotal(e.target.value)}
              invalid={Boolean(fields.participantsTotal)}
            />
          </Field>
          <Field label="Male" htmlFor="participantsMale" error={fields.participantsMale?.[0]}>
            <Input
              id="participantsMale"
              name="participantsMale"
              type="number"
              min={0}
              inputMode="numeric"
              value={participantsMale}
              onChange={(e) => setParticipantsMale(e.target.value)}
              invalid={Boolean(fields.participantsMale)}
            />
          </Field>
          <Field label="Female" htmlFor="participantsFemale" error={fields.participantsFemale?.[0]}>
            <Input
              id="participantsFemale"
              name="participantsFemale"
              type="number"
              min={0}
              inputMode="numeric"
              value={participantsFemale}
              onChange={(e) => setParticipantsFemale(e.target.value)}
              invalid={Boolean(fields.participantsFemale)}
            />
          </Field>
          <Field label="Children" htmlFor="participantsChildren" error={fields.participantsChildren?.[0]}>
            <Input
              id="participantsChildren"
              name="participantsChildren"
              type="number"
              min={0}
              inputMode="numeric"
              value={participantsChildren}
              onChange={(e) => setParticipantsChildren(e.target.value)}
              invalid={Boolean(fields.participantsChildren)}
            />
          </Field>
          <Field
            label="Participants with disability"
            htmlFor="participantsDisability"
            error={fields.participantsDisability?.[0]}
          >
            <Input
              id="participantsDisability"
              name="participantsDisability"
              type="number"
              min={0}
              inputMode="numeric"
              value={participantsDisability}
              onChange={(e) => setParticipantsDisability(e.target.value)}
              invalid={Boolean(fields.participantsDisability)}
            />
          </Field>
        </div>
      </fieldset>

      <Field label="Summary" htmlFor="summary" error={fields.summary?.[0]}>
        <Textarea
          id="summary"
          name="summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          invalid={Boolean(fields.summary)}
          className="min-h-[120px]"
          required
          maxLength={10000}
        />
      </Field>

      <Field label="Achievements" htmlFor="achievements" error={fields.achievements?.[0]}>
        <Textarea
          id="achievements"
          name="achievements"
          value={achievements}
          onChange={(e) => setAchievements(e.target.value)}
          invalid={Boolean(fields.achievements)}
          maxLength={5000}
        />
      </Field>

      <Field label="Challenges" htmlFor="challenges" error={fields.challenges?.[0]}>
        <Textarea
          id="challenges"
          name="challenges"
          value={challenges}
          onChange={(e) => setChallenges(e.target.value)}
          invalid={Boolean(fields.challenges)}
          maxLength={5000}
        />
      </Field>

      <Field label="Lessons learned" htmlFor="lessonsLearned" error={fields.lessonsLearned?.[0]}>
        <Textarea
          id="lessonsLearned"
          name="lessonsLearned"
          value={lessonsLearned}
          onChange={(e) => setLessonsLearned(e.target.value)}
          invalid={Boolean(fields.lessonsLearned)}
          maxLength={5000}
        />
      </Field>

      <Field label="Next steps" htmlFor="nextSteps" error={fields.nextSteps?.[0]}>
        <Textarea
          id="nextSteps"
          name="nextSteps"
          value={nextSteps}
          onChange={(e) => setNextSteps(e.target.value)}
          invalid={Boolean(fields.nextSteps)}
          maxLength={5000}
        />
      </Field>

      {evidenceOptions.length > 0 && (
        <fieldset className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
          <legend className="px-1 text-sm font-medium text-slate-700 dark:text-slate-200">
            Attach evidence (optional)
          </legend>
          <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
            Link files already in this project&apos;s evidence library.
          </p>
          <div className="grid max-h-56 gap-2 overflow-y-auto">
            {evidenceOptions.map((e) => (
              <label key={e.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selectedEvidence.includes(e.id)}
                  onChange={() => toggleEvidence(e.id)}
                />
                <span>{e.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {actionState.error && (
        <p role="alert" className="text-sm font-medium text-danger-700 dark:text-danger-400">
          {actionState.error}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" pending={actionState.busy}>
          Submit activity
        </Button>
      </div>
    </form>
  );
}
