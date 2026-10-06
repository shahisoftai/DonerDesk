"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createActivityAction } from "@/lib/actions/activities";
import { uploadEvidenceAction } from "@/lib/actions/evidence";
import { useActionState } from "@/lib/client/action-state";
import { validateParticipantBreakdown } from "@/lib/shared/participants";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormSummary } from "@/components/ui/FormSummary";
import { recordParticipantHints } from "@donordesk/domain/contexts/logframe/participants-consistency.js";
import { LogframeItemSelect } from "@/features/logframe/presentation/LogframeItemSelect";
import { periodContainingDate } from "@/lib/shared/option-labels";
import { FileDropzone } from "@/components/editor/FileDropzone";
import { activityEvidenceFormData, failedUploads, type FileUploadOutcome } from "@/features/activities/domain/activity-evidence";
import type { OutlineSource } from "@/features/logframe/domain/logframe-outline";

type PeriodOption = { id: string; label: string; reportType: string; startDate: string; endDate: string };
type EvidenceOption = { id: string; label: string };

export function NewActivityForm({
  projectId,
  reportingPeriods,
  evidenceOptions,
  logframeItems = [],
}: {
  projectId: string;
  reportingPeriods: PeriodOption[];
  evidenceOptions: EvidenceOption[];
  /** The project's logframe, so a record can point at the Activity it delivers. */
  logframeItems?: OutlineSource[];
}) {
  const router = useRouter();
  const actionState = useActionState();

  const [reportingPeriodId, setReportingPeriodId] = useState(reportingPeriods[0]?.id ?? "");
  const [periodChosenByUser, setPeriodChosenByUser] = useState(false);
  const [activityTitle, setActivityTitle] = useState("");
  const [activityDate, setActivityDate] = useState("");
  const [location, setLocation] = useState("");
  const [participantsTotal, setParticipantsTotal] = useState("");
  const [participantsMale, setParticipantsMale] = useState("");
  const [participantsFemale, setParticipantsFemale] = useState("");
  const [participantsChildren, setParticipantsChildren] = useState("");
  const [participantsDisability, setParticipantsDisability] = useState("");
  const [logframeActivityId, setLogframeActivityId] = useState("");
  const [summary, setSummary] = useState("");
  const [achievements, setAchievements] = useState("");
  const [challenges, setChallenges] = useState("");
  const [lessonsLearned, setLessonsLearned] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [selectedEvidence, setSelectedEvidence] = useState<string[]>([]);
  const [localErrors, setLocalErrors] = useState<Record<string, string[]>>({});
  // Files dropped on the form are uploaded against the new activity, which they inherit their period from.
  const [files, setFiles] = useState<File[]>([]);
  const [createdActivityId, setCreatedActivityId] = useState<string | null>(null);
  const [uploadedNames, setUploadedNames] = useState<string[]>([]);
  const [uploadFailures, setUploadFailures] = useState<FileUploadOutcome[]>([]);
  const [uploading, setUploading] = useState(false);
  const [leaving, setLeaving] = useState(false);

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
    // A retry after a failed upload must not create the activity a second time.
    let activityId = createdActivityId;
    if (!activityId) {
      const created = await actionState.runCreate((idempotencyKey) =>
        createActivityAction({
          projectId,
          reportingPeriodId,
          activityTitle,
          activityDate: dateValue ?? new Date().toISOString(),
          location: location || undefined,
          logframeActivityId: logframeActivityId || undefined,
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
        }, { idempotencyKey }),
      );
      if (!created) return;
      activityId = created.id;
      setCreatedActivityId(created.id);
    }

    const remaining = files.filter((f) => !uploadedNames.includes(f.name));
    if (remaining.length > 0) {
      setUploading(true);
      const outcomes: FileUploadOutcome[] = [];
      for (const file of remaining) {
        const result = await uploadEvidenceAction(
          activityEvidenceFormData(file, {
            projectId,
            activityId,
            reportingPeriodId,
            activityDate: dateValue,
            location: location || undefined,
          }),
        );
        outcomes.push(result.ok ? { name: file.name, ok: true } : { name: file.name, ok: false, error: result.error.message });
      }
      setUploading(false);
      setUploadedNames((prev) => [...prev, ...outcomes.filter((o) => o.ok).map((o) => o.name)]);
      const failed = failedUploads(outcomes);
      setUploadFailures(failed);
      // The activity is saved either way; stay only when a file needs another try.
      if (failed.length > 0) return;
    }
    setLeaving(true);
    router.push(`/projects/${projectId}/activities`);
    router.refresh();
  }

  // Hints, never errors: the blocking rules (a part may not exceed the total) are validated on submit.
  const participantHints = recordParticipantHints({
    participantsTotal: participantsTotal ? Number(participantsTotal) : undefined,
    participantsMale: participantsMale ? Number(participantsMale) : undefined,
    participantsFemale: participantsFemale ? Number(participantsFemale) : undefined,
    participantsChildren: participantsChildren ? Number(participantsChildren) : undefined,
    participantsDisability: participantsDisability ? Number(participantsDisability) : undefined,
  }).filter((h) => h.code === "SEX_SPLIT_BELOW_TOTAL");

  const errorCount = Object.keys(fields).reduce((sum, key) => sum + (fields[key]?.length ?? 0), 0);

  return (
    <form onSubmit={submit} className="card mt-6 grid max-w-3xl gap-4" noValidate>
      <FormSummary errors={fields} count={errorCount} />

      <Field label="Reporting period" htmlFor="reportingPeriodId" error={fields.reportingPeriodId?.[0]}>
        <Select
          id="reportingPeriodId"
          name="reportingPeriodId"
          value={reportingPeriodId}
          onChange={(e) => {
            setPeriodChosenByUser(true);
            setReportingPeriodId(e.target.value);
          }}
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

      {logframeItems.some((i) => i.level === "ACTIVITY") && (
        <Field
          label="Logframe activity (optional)"
          htmlFor="logframeActivityId"
          error={fields.logframeActivityId?.[0]}
          hint="The planned activity this record delivers. The logframe then shows what has been delivered, and the output is filled in for you."
        >
          <LogframeItemSelect
            id="logframeActivityId"
            items={logframeItems}
            value={logframeActivityId}
            onChange={setLogframeActivityId}
            emptyLabel="Not linked to a planned activity"
          />
        </Field>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Activity date" htmlFor="activityDate" error={fields.activityDate?.[0]}>
          <Input
            id="activityDate"
            name="activityDate"
            type="date"
            value={activityDate}
            onChange={(e) => {
              setActivityDate(e.target.value);
              // Derive, don't ask: the period that contains the date, unless the user already picked one.
              const derived = periodChosenByUser ? undefined : periodContainingDate(reportingPeriods, e.target.value);
              if (derived) setReportingPeriodId(derived);
            }}
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
        {participantHints.length > 0 && (
          <ul role="status" className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
            {participantHints.map((h) => <li key={h.code}>{h.message}</li>)}
          </ul>
        )}
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

      <fieldset className="rounded-xl border border-slate-200 p-4 dark:border-white/10" disabled={leaving}>
        <legend className="px-1 text-sm font-medium text-slate-700 dark:text-slate-200">Upload evidence (optional)</legend>
        <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
          Files are saved with this activity and count for its reporting period. No separate linking step is needed.
        </p>
        <FileDropzone
          multiple
          label="Add evidence files"
          hint="Drop files here or choose them"
          onFiles={(added) => setFiles((prev) => [...prev, ...added.filter((f) => f.size > 0 && !prev.some((p) => p.name === f.name))])}
        />
        {files.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm" aria-label="Files to upload">
            {files.map((f) => {
              const failure = uploadFailures.find((o) => o.name === f.name);
              const done = uploadedNames.includes(f.name);
              return (
                <li key={f.name} className="flex items-center justify-between gap-2">
                  <span className="truncate">{f.name}</span>
                  <span className="shrink-0 text-xs">
                    {done ? "Uploaded" : failure ? <span className="text-danger-700 dark:text-danger-400">Failed: {failure.error}</span> : "Waiting"}
                    {!done && !uploading && !createdActivityId ? (
                      <button type="button" className="ml-2 underline" onClick={() => setFiles((prev) => prev.filter((p) => p.name !== f.name))}>
                        Remove
                      </button>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>

      {actionState.error && (
        <p role="alert" className="text-sm font-medium text-danger-700 dark:text-danger-400">
          {actionState.error}
        </p>
      )}

      <div className="flex justify-end gap-3">
        {uploadFailures.length > 0 ? (
          <Button
            type="button"
            variant="secondary"
            disabled={leaving || uploading}
            onClick={() => {
              setLeaving(true);
              router.push(`/projects/${projectId}/activities`);
              router.refresh();
            }}
          >
            Finish without these files
          </Button>
        ) : (
          <Button type="button" variant="secondary" disabled={Boolean(createdActivityId)} onClick={() => router.back()}>
            Cancel
          </Button>
        )}
        <Button type="submit" pending={actionState.busy || uploading} disabled={leaving}>
          {uploadFailures.length > 0 ? "Retry failed uploads" : "Submit activity"}
        </Button>
      </div>
    </form>
  );
}
