"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createActivityAction } from "@/lib/actions/activities";
import { isOfflineFailure } from "@/lib/shared/connectivity";
import type { AppError } from "@/lib/shared/app-error";
import { useOutbox } from "@/features/offline/presentation/OutboxProvider";
import { activityEntry } from "@/features/offline/domain/activity-outbox";
import { uploadEvidenceAction } from "@/lib/actions/evidence";
import { useActionState } from "@/lib/client/action-state";
import { useToast } from "@/components/feedback/Toast";
import { validateParticipantBreakdown } from "@/lib/shared/participants";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormSummary } from "@/components/ui/FormSummary";
import { recordParticipantHints } from "@donordesk/domain/contexts/logframe/participants-consistency.js";
import { suggestPlanLinks, WORKPLAN_COPY, type LinkCandidate } from "@donordesk/domain/contexts/workplan/index.js";
import { LogframeItemSelect } from "@/features/logframe/presentation/LogframeItemSelect";
import { periodContainingDate } from "@/lib/shared/option-labels";
import { FileCapture } from "@/features/evidence/presentation/FileCapture";
import { DayChips } from "@/features/record/presentation/DayChips";
import { PeriodOpenCard } from "@/features/record/presentation/PeriodOpenCard";
import { useNetworkServices } from "@/features/record/composition";
import type { PeriodOpener } from "@/features/record/ports/record-services";
import { localPlainDay } from "@/features/record/domain/record-day";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { applyNarrativeProposal, type NarrativeProposal } from "@/features/activities/domain/apply-narrative-proposal";
import { ActivityNarrativeAssist } from "./ActivityNarrativeAssist";
import { createActivityDraftStore, type ActivityDraft } from "@/features/activities/domain/activity-draft";
import { InlineAlert } from "@/components/feedback/InlineAlert";
import { formatDateTime } from "@/lib/shared/dates";
import { createFileSettingsMemory } from "@/features/activities/domain/file-settings-memory";
import { activityEvidenceFormData, applyBatchSettings, defaultFileSettings, defaultIndicatorForActivity, failedUploads, type FileSettings, type FileUploadOutcome } from "@/features/activities/domain/activity-evidence";
import type { OutlineSource } from "@/features/logframe/domain/logframe-outline";

type PeriodOption = { id: string; label: string; reportType: string; startDate: string; endDate: string };
type EvidenceOption = { id: string; label: string };

function NewActivityFormInner({
  onQueued,
  projectId,
  reportingPeriods,
  evidenceOptions,
  logframeItems = [],
  indicators = [],
  initialLogframeActivityId,
  earlierRecords = [],
  plannedActivities = [],
  userId = "",
  initialPlannedActivityId,
  embedded = false,
  onSaved,
  places = [],
  onPeriodsChanged,
  canOpenPeriod = false,
  periodOpener: periodOpenerProp,
  today: todayProp,
}: {
  projectId: string;
  reportingPeriods: PeriodOption[];
  evidenceOptions: EvidenceOption[];
  /** The project's logframe, so a record can point at the Activity it delivers. */
  logframeItems?: OutlineSource[];
  /** The project's indicators: a file can be marked as proof of one (preselected when the activity has exactly one). */
  indicators?: Array<{ id: string; label: string; logframeItemId?: string | null }>;
  /** Opened from "Add activity" on a logframe node: that node is already chosen. */
  initialLogframeActivityId?: string;
  /** Earlier records the new one can start from (title, place and node are copied; numbers and text are not). */
  earlierRecords?: Array<{ id: string; title: string; location?: string | undefined; logframeActivityId?: string | undefined }>;
  /** The project's planned activities (work plan). The picker is shown only when there are some. */
  plannedActivities?: Array<LinkCandidate & { title: string; location?: string | undefined }>;
  userId?: string;
  /** Opened from a planned activity ("Add completed activity"): that activity is already chosen. */
  initialPlannedActivityId?: string;
  /** Called when the finished form was kept on this device because there was no connection. */
  onQueued: (title: string) => void;
  /** Inside the Record sheet: no card around the form, and a finished save is reported up instead of leaving the page. */
  embedded?: boolean;
  onSaved?: ((info: { title: string; queued: boolean }) => void) | undefined;
  /** Place names the project knows, offered as the person types a place. */
  places?: string[];
  /** A manager opened a reporting period from here: the host reloads the periods. */
  onPeriodsChanged?: (() => void) | undefined;
  canOpenPeriod?: boolean;
  /** What to do when the day lands in no period; the Record sheet passes its own (offline it answers "not now"), the page uses the server's. */
  periodOpener?: PeriodOpener | undefined;
  /** Today as a plain day. Defaults to the phone's own calendar day. */
  today?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const actionState = useActionState();
  const outbox = useOutbox();
  const { t } = useI18n();
  const networkServices = useNetworkServices();
  const periodOpener = periodOpenerProp ?? networkServices.periods;
  const today = useMemo(() => todayProp ?? localPlainDay(new Date()), [todayProp]);

  // The form starts on today and the period follows the day; a day no period covers is never given to whichever period is listed first.
  const [reportingPeriodId, setReportingPeriodId] = useState(() => periodContainingDate(reportingPeriods, todayProp ?? localPlainDay(new Date())) ?? "");
  const [dateTouched, setDateTouched] = useState(false);
  const [periodChosenByUser, setPeriodChosenByUser] = useState(false);
  const [changingPeriod, setChangingPeriod] = useState(false);
  const [activityTitle, setActivityTitle] = useState("");
  const [activityDate, setActivityDate] = useState(() => todayProp ?? localPlainDay(new Date()));
  // Optional last day, for a record that covers a span (a whole month of outreach clinics) instead of one day.
  const [activityEndDate, setActivityEndDate] = useState("");
  const [location, setLocation] = useState("");
  const [participantsTotal, setParticipantsTotal] = useState("");
  const [participantsMale, setParticipantsMale] = useState("");
  const [participantsFemale, setParticipantsFemale] = useState("");
  const [participantsChildren, setParticipantsChildren] = useState("");
  const [participantsDisability, setParticipantsDisability] = useState("");
  const [logframeActivityId, setLogframeActivityId] = useState(initialLogframeActivityId && logframeItems.some((i) => i.id === initialLogframeActivityId) ? initialLogframeActivityId : "");
  const [plannedActivityId, setPlannedActivityId] = useState(initialPlannedActivityId && plannedActivities.some((p) => p.id === initialPlannedActivityId) ? initialPlannedActivityId : "");
  const [summary, setSummary] = useState("");
  const [achievements, setAchievements] = useState("");
  const [challenges, setChallenges] = useState("");
  const [lessonsLearned, setLessonsLearned] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [selectedEvidence, setSelectedEvidence] = useState<string[]>([]);
  const [localErrors, setLocalErrors] = useState<Record<string, string[]>>({});
  // Files dropped on the form are uploaded against the new activity, which they inherit their period from.
  const [files, setFiles] = useState<File[]>([]);
  const [fileSettings, setFileSettings] = useState<Record<string, FileSettings>>({});
  const [createdActivityId, setCreatedActivityId] = useState<string | null>(null);
  const [uploadedNames, setUploadedNames] = useState<string[]>([]);
  const [uploadFailures, setUploadFailures] = useState<FileUploadOutcome[]>([]);
  const [uploading, setUploading] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // What this person chose last time for how sensitive their files are (browser-local, optional).
  const [memory] = useState(() => createFileSettingsMemory(typeof window === "undefined" ? null : window.localStorage));
  const [remembered, setRemembered] = useState<ReturnType<typeof memory.load>>({});
  useEffect(() => setRemembered(memory.load()), [memory]);

  // Typed text survives a reload or a lost connection; it is offered back, never applied silently.
  const drafts = useMemo(() => createActivityDraftStore(typeof window === "undefined" ? null : window.localStorage, projectId), [projectId]);
  const [pendingDraft, setPendingDraft] = useState<{ value: ActivityDraft; savedAt: number } | null | undefined>(undefined);
  useEffect(() => setPendingDraft(drafts.load()), [drafts]);
  const currentDraft: ActivityDraft = {
    activityTitle, activityDate, activityEndDate, location, participantsTotal, participantsMale, participantsFemale,
    participantsChildren, participantsDisability, logframeActivityId, summary, achievements, challenges, lessonsLearned, nextSteps,
  };
  const draftKey = JSON.stringify(currentDraft);
  useEffect(() => {
    // pendingDraft === null: nothing to offer or already decided, so what is typed now is the draft.
    if (pendingDraft !== null || createdActivityId) return;
    drafts.save(JSON.parse(draftKey) as ActivityDraft);
  }, [draftKey, pendingDraft, createdActivityId, drafts]);
  useEffect(() => {
    if (createdActivityId) drafts.clear();
  }, [createdActivityId, drafts]);

  /** Puts what the person's own words stated into the empty fields; the period follows a newly filled date. */
  function applyProposal(proposal: NarrativeProposal) {
    // The date starts on today; words that state another day may still fill it until the person has chosen one themselves.
    const { next, filled, kept } = applyNarrativeProposal({ ...currentDraft, activityDate: dateTouched ? activityDate : "" }, proposal);
    setActivityTitle(next.activityTitle);
    if (next.activityDate !== "") setActivityDate(next.activityDate);
    setActivityEndDate(next.activityEndDate);
    setLocation(next.location);
    setParticipantsTotal(next.participantsTotal);
    setParticipantsMale(next.participantsMale);
    setParticipantsFemale(next.participantsFemale);
    setParticipantsChildren(next.participantsChildren);
    setParticipantsDisability(next.participantsDisability);
    setSummary(next.summary);
    setAchievements(next.achievements);
    setChallenges(next.challenges);
    setLessonsLearned(next.lessonsLearned);
    setNextSteps(next.nextSteps);
    if (filled.includes("activityDate") && !periodChosenByUser) {
      setReportingPeriodId(periodContainingDate(reportingPeriods, next.activityDate) ?? "");
    }
    return { filled, kept };
  }

  function resumeDraft(d: ActivityDraft) {
    setActivityTitle(d.activityTitle);
    setActivityDate(d.activityDate);
    setActivityEndDate(d.activityEndDate);
    setLocation(d.location);
    setParticipantsTotal(d.participantsTotal);
    setParticipantsMale(d.participantsMale);
    setParticipantsFemale(d.participantsFemale);
    setParticipantsChildren(d.participantsChildren);
    setParticipantsDisability(d.participantsDisability);
    if (logframeItems.some((i) => i.id === d.logframeActivityId)) setLogframeActivityId(d.logframeActivityId);
    setSummary(d.summary);
    setAchievements(d.achievements);
    setChallenges(d.challenges);
    setLessonsLearned(d.lessonsLearned);
    setNextSteps(d.nextSteps);
    setReportingPeriodId(d.activityDate ? periodContainingDate(reportingPeriods, d.activityDate) ?? "" : "");
    setPendingDraft(null);
  }

  const fields = actionState.fields ?? localErrors;

  // Derive, don't ask: once the date is known the period is stated, not asked, unless the user opens it.
  const dateInsidePeriodId = activityDate ? periodContainingDate(reportingPeriods, activityDate) : undefined;
  const periodIsDerived = Boolean(dateInsidePeriodId) && dateInsidePeriodId === reportingPeriodId && !changingPeriod && !fields.reportingPeriodId;

  const planSuggestions = useMemo(() => {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(activityDate) ? activityDate : new Date().toISOString().slice(0, 10);
    const picked = plannedActivities.find((p) => p.id === plannedActivityId);
    const found = suggestPlanLinks({ userId, date, ...(logframeActivityId ? { logframeActivityId } : {}), ...(activityTitle.trim() ? { title: activityTitle } : {}) }, plannedActivities);
    // A chosen activity always stays in the list, even when the dates suggest others.
    return picked && !found.some((f) => f.id === picked.id) ? [{ id: picked.id, reasons: [] as string[] }, ...found].slice(0, 3) : found;
  }, [plannedActivities, plannedActivityId, activityDate, logframeActivityId, activityTitle, userId]);

  /** Choosing a planned activity fills what is empty (title, place, logframe activity); it never overwrites what was typed. */
  function choosePlanned(id: string) {
    setPlannedActivityId(id);
    const plan = plannedActivities.find((p) => p.id === id);
    if (!plan) return;
    if (!activityTitle.trim()) setActivityTitle(plan.title);
    if (!location.trim() && plan.location) setLocation(plan.location);
    if (!logframeActivityId && plan.logframeActivityId && logframeItems.some((i) => i.id === plan.logframeActivityId)) setLogframeActivityId(plan.logframeActivityId);
  }

  const activityIndicator = defaultIndicatorForActivity(logframeActivityId, indicators);
  /** What was chosen for a file; a file nobody touched gets the suggestion for its name and the activity's own indicator. */
  function settingsFor(file: File): FileSettings {
    return fileSettings[file.name] ?? defaultFileSettings(file, activityIndicator, remembered);
  }
  function setSettings(file: File, patch: Partial<FileSettings>) {
    setFileSettings((prev) => ({ ...prev, [file.name]: { ...settingsFor(file), ...patch } }));
    if (patch.confidentialityLevel) {
      memory.save({ confidentialityLevel: patch.confidentialityLevel });
      setRemembered({ confidentialityLevel: patch.confidentialityLevel });
    }
  }

  /** Starts from an earlier record: what repeats (title, place, node) is copied; counts and narrative stay blank to be entered. */
  function startFrom(recordId: string) {
    const record = earlierRecords.find((r) => r.id === recordId);
    if (!record) return;
    setActivityTitle(record.title);
    setLocation(record.location ?? "");
    setLogframeActivityId(record.logframeActivityId ?? "");
    setParticipantsTotal("");
    setParticipantsMale("");
    setParticipantsFemale("");
    setParticipantsChildren("");
    setParticipantsDisability("");
  }

  const addProofFiles = (added: File[]) =>
    setFiles((prev) => [...prev, ...added.filter((f) => f.size > 0 && !prev.some((p) => p.name === f.name))]);

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
    if (activityEndDate && activityDate && activityEndDate < activityDate) {
      setLocalErrors({ activityEndDate: ["The end date cannot be before the activity date."] });
      return;
    }
    if (!reportingPeriodId) {
      setLocalErrors({ reportingPeriodId: ["Choose the reporting period this record belongs to. If none covers the date, create the period first."] });
      return;
    }
    const endDateValue = activityEndDate ? new Date(activityEndDate).toISOString() : undefined;
    // A retry after a failed upload must not create the activity a second time.
    let activityId = createdActivityId;
    if (!activityId) {
      const input = {
        projectId,
        reportingPeriodId,
        activityTitle,
        activityDate: dateValue ?? new Date().toISOString(),
        ...(endDateValue ? { activityEndDate: endDateValue } : {}),
        location: location || undefined,
        logframeActivityId: logframeActivityId || undefined,
        plannedActivityId: plannedActivityId || undefined,
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
      };
      const attempt: { key: string; error?: AppError } = { key: "" };
      const created = await actionState.runCreate(
        (idempotencyKey) => createActivityAction(input, { idempotencyKey }),
        (error, idempotencyKey) => {
          attempt.error = error;
          attempt.key = idempotencyKey;
        },
      );
      if (!created) {
        // No connection: keep the finished form (photos included) on this device and let the outbox send it later.
        if (outbox.supported && isOfflineFailure(attempt.error)) {
          await outbox.enqueue(
            activityEntry({
              id: attempt.key,
              title: activityTitle,
              now: Date.now(),
              payload: {
                projectId,
                reportingPeriodId,
                ...(dateValue ? { activityDate: dateValue } : {}),
                ...(location ? { location } : {}),
                create: input,
                files: files.map((f) => ({ name: f.name, type: f.type, blob: f, settings: settingsFor(f) })),
              },
            }),
          );
          drafts.clear();
          // No navigation: with no connection the next page cannot load. The wrapper (or the sheet) confirms in place.
          onQueued(activityTitle);
        }
        return;
      }
      activityId = created.id;
      setCreatedActivityId(created.id);
    }

    const remaining = files.filter((f) => !uploadedNames.includes(f.name));
    if (remaining.length > 0) {
      setUploading(true);
      const outcomes: FileUploadOutcome[] = [];
      for (const file of remaining) {
        const result = await uploadEvidenceAction(
          activityEvidenceFormData(
            file,
            { projectId, activityId, reportingPeriodId, activityDate: dateValue, location: location || undefined },
            settingsFor(file),
          ),
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
    if (onSaved) {
      // Inside the Record sheet the sheet confirms; nothing navigates.
      onSaved({ title: activityTitle, queued: false });
      return;
    }
    setLeaving(true);
    // Say it was saved and show where it is: the record is on the Completed tab, waiting for a reviewer.
    toast.push({ title: "Activity saved", description: "It is on the Completed tab, waiting to be accepted.", tone: "success" });
    router.push(`/projects/${projectId}/activities?view=completed`);
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

  // The periods can change while the form is open (a manager opened one): follow the day again unless the person chose a period.
  useEffect(() => {
    if (!periodChosenByUser) setReportingPeriodId(periodContainingDate(reportingPeriods, activityDate) ?? "");
  }, [reportingPeriods, activityDate, periodChosenByUser]);
  const periodCovers = dateInsidePeriodId !== undefined;
  const periodLabel = reportingPeriods.find((p) => p.id === reportingPeriodId)?.label;

  return (
    <form onSubmit={submit} className={embedded ? "grid gap-5" : "card mt-6 grid max-w-3xl gap-5"} noValidate>
      {pendingDraft && (
        <InlineAlert tone="info" title={`You have an unfinished activity from ${formatDateTime(new Date(pendingDraft.savedAt))}`}>
          <p>{pendingDraft.value.activityTitle ? `“${pendingDraft.value.activityTitle}”` : "Untitled activity"}. Continue where you left off?</p>
          <div className="mt-2 flex gap-2">
            <Button type="button" size="sm" onClick={() => resumeDraft(pendingDraft.value)}>Restore draft</Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => { drafts.clear(); setPendingDraft(null); }}>Start fresh</Button>
          </div>
        </InlineAlert>
      )}

      <ActivityNarrativeAssist onApply={applyProposal} />
      <FormSummary errors={fields} count={errorCount} />

      {/* The first screen: five things. Everything else waits under "Add detail". */}
      <Field label="Activity title" htmlFor="activityTitle" error={fields.activityTitle?.[0]}>
        <Input id="activityTitle" name="activityTitle" className="min-h-[52px] text-base" value={activityTitle} onChange={(e) => setActivityTitle(e.target.value)} invalid={Boolean(fields.activityTitle)} required maxLength={300} />
      </Field>

      <DayChips
        date={activityDate}
        today={today}
        label="Activity date"
        onChange={(d) => {
          setDateTouched(true);
          setActivityDate(d);
          // Derive, don't ask: the period that contains the day, unless the user already picked one.
          if (!periodChosenByUser) setReportingPeriodId(periodContainingDate(reportingPeriods, d) ?? "");
        }}
      />
      {fields.activityDate?.[0] && <p role="alert" className="-mt-3 text-xs font-medium text-danger-700 dark:text-danger-400">{fields.activityDate[0]}</p>}
      {periodIsDerived && periodLabel && (
        <p className="-mt-2 text-sm font-semibold text-success-700 dark:text-success-300" data-testid="derived-period">{t("record.value.countsToward", { period: periodLabel })}</p>
      )}
      {activityDate && !periodCovers && (
        <PeriodOpenCard projectId={projectId} date={activityDate} canOpen={canOpenPeriod} opener={periodOpener} savesAfter={false} onOpened={() => (onPeriodsChanged ? onPeriodsChanged() : router.refresh())} />
      )}

      <Field label="Location" htmlFor="location" error={fields.location?.[0]}>
        <Input id="location" name="location" className="min-h-[52px] text-base" list={places.length > 0 ? "activity-places" : undefined} value={location} onChange={(e) => setLocation(e.target.value)} invalid={Boolean(fields.location)} maxLength={200} />
        {places.length > 0 && <datalist id="activity-places">{places.map((p) => <option key={p} value={p} />)}</datalist>}
      </Field>

      <Field label="What happened?" htmlFor="summary" error={fields.summary?.[0]}>
        <Textarea dictate id="summary" name="summary" value={summary} onChange={(e) => setSummary(e.target.value)} invalid={Boolean(fields.summary)} className="min-h-[120px] text-base" required maxLength={10000} />
      </Field>

      <fieldset className="space-y-2" disabled={leaving}>
        <legend className="label">Photos and files (optional)</legend>
        <FileCapture
          files={files}
          onAdd={addProofFiles}
          onRemove={(name) => setFiles((prev) => prev.filter((p) => p.name !== name))}
          settingsFor={settingsFor}
          onSettings={setSettings}
          onApplyToAll={() => setFileSettings(applyBatchSettings(files, settingsFor, files[0]!))}
          indicators={indicators}
          locked={Boolean(createdActivityId)}
          uploadedNames={uploadedNames}
          failures={uploadFailures}
          uploading={uploading}
        />
      </fieldset>

      <details className="group rounded-2xl border border-slate-300 bg-white dark:border-white/15 dark:bg-slate-900/40" open={Boolean(participantErrorsOpen(fields))}>
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-4">
          <span><span className="font-bold">Add detail</span><span className="text-sm text-slate-600 dark:text-slate-300"> · who came, plan link, more about it</span></span>
          <span aria-hidden="true" className="transition group-open:rotate-90">▸</span>
        </summary>
        <div className="grid gap-5 border-t border-slate-200 p-4 dark:border-white/10">
          {earlierRecords.length > 0 && (
            <Field label="Start from an earlier record (optional)" htmlFor="start-from">
              <Select id="start-from" defaultValue="" onChange={(e) => startFrom(e.target.value)}>
                <option value="">Blank record</option>
                {earlierRecords.map((r) => <option key={r.id} value={r.id}>{r.title}{r.location ? ` (${r.location})` : ""}</option>)}
              </Select>
            </Field>
          )}

          <fieldset className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
            <legend className="px-1 text-sm font-medium text-slate-700 dark:text-slate-200">Who came (optional)</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              {([
                ["participantsTotal", "Total participants", participantsTotal, setParticipantsTotal],
                ["participantsMale", "Male", participantsMale, setParticipantsMale],
                ["participantsFemale", "Female", participantsFemale, setParticipantsFemale],
                ["participantsChildren", "Children", participantsChildren, setParticipantsChildren],
                ["participantsDisability", "Participants with disability", participantsDisability, setParticipantsDisability],
              ] as const).map(([name, label, value, set]) => (
                <Field key={name} label={label} htmlFor={name} error={fields[name]?.[0]}>
                  <Input id={name} name={name} type="number" min={0} inputMode="numeric" className="min-h-[52px] text-lg" value={value} onChange={(e) => set(e.target.value)} invalid={Boolean(fields[name])} />
                </Field>
              ))}
            </div>
            {participantHints.length > 0 && (
              <ul role="status" className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                {participantHints.map((h) => <li key={h.code}>{h.message}</li>)}
              </ul>
            )}
          </fieldset>

          {plannedActivities.length > 0 && (
            <fieldset className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
              <legend className="px-1 text-sm font-medium">{WORKPLAN_COPY.whichPlanned}</legend>
              {planSuggestions.map((sug) => {
                const plan = plannedActivities.find((p) => p.id === sug.id)!;
                return (
                  <label key={sug.id} className="flex min-h-11 items-start gap-2 py-1 text-sm">
                    <input type="radio" name="plannedActivity" className="mt-1 h-5 w-5" checked={plannedActivityId === sug.id} onChange={() => choosePlanned(sug.id)} />
                    <span>{plan.title}<span className="block text-xs text-slate-500">{sug.reasons.join(" · ")}</span></span>
                  </label>
                );
              })}
              <label className="flex min-h-11 items-center gap-2 py-1 text-sm">
                <input type="radio" name="plannedActivity" className="h-5 w-5" checked={plannedActivityId === ""} onChange={() => setPlannedActivityId("")} />
                {WORKPLAN_COPY.noneOfThese}
              </label>
            </fieldset>
          )}

          {logframeItems.some((i) => i.level === "ACTIVITY") && (
            <Field label="Logframe activity (optional)" htmlFor="logframeActivityId" error={fields.logframeActivityId?.[0]} hint="The planned activity this record delivers. The logframe then shows what has been delivered, and the output is filled in for you.">
              <LogframeItemSelect id="logframeActivityId" items={logframeItems} value={logframeActivityId} onChange={setLogframeActivityId} selectableLevels={["ACTIVITY"]} emptyLabel="Not linked to a planned activity" />
            </Field>
          )}

          <Field label="Through (optional)" htmlFor="activityEndDate" error={fields.activityEndDate?.[0]} hint="Leave empty if it happened on one day. For monthly totals (clinics held, women reached) pick the last day of the month.">
            <div id="activityEndDate-group" className="flex gap-2">
              <Input id="activityEndDate" name="activityEndDate" type="date" value={activityEndDate} min={activityDate || undefined} onChange={(e) => setActivityEndDate(e.target.value)} invalid={Boolean(fields.activityEndDate)} />
              <Button type="button" variant="secondary" size="touch" disabled={!activityDate} onClick={() => {
                // Last day of the month of the activity date.
                const [y, m] = activityDate.split("-").map(Number);
                if (y && m) setActivityEndDate(new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10));
              }}>End of month</Button>
            </div>
          </Field>

          {(!periodIsDerived || changingPeriod) && (
            <Field label="Reporting period" htmlFor="reportingPeriodId" error={fields.reportingPeriodId?.[0]} hint={activityDate && !dateInsidePeriodId ? "No reporting period contains this date yet. Open it above, or choose the period this record belongs to." : undefined}>
              <Select id="reportingPeriodId" name="reportingPeriodId" value={reportingPeriodId} onChange={(e) => { setPeriodChosenByUser(true); setReportingPeriodId(e.target.value); }} invalid={Boolean(fields.reportingPeriodId)} required>
                <option value="">Choose a reporting period…</option>
                {reportingPeriods.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </Select>
            </Field>
          )}
          {periodIsDerived && !changingPeriod && (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Reporting period: <strong className="font-medium">{periodLabel}</strong> (from the activity date){" "}
              <button type="button" className="min-h-11 text-brand-700 underline dark:text-brand-300" onClick={() => setChangingPeriod(true)}>Change</button>
            </p>
          )}

          <details className="rounded-xl border border-slate-200 dark:border-white/10">
            <summary className="flex min-h-12 cursor-pointer list-none items-center px-3 text-sm font-semibold">More about it (optional)</summary>
            <div className="grid gap-4 border-t border-slate-200 p-3 dark:border-white/10">
              {([
                ["achievements", "Achievements", achievements, setAchievements],
                ["challenges", "Challenges", challenges, setChallenges],
                ["lessonsLearned", "Lessons learned", lessonsLearned, setLessonsLearned],
                ["nextSteps", "Next steps", nextSteps, setNextSteps],
              ] as const).map(([name, label, value, set]) => (
                <Field key={name} label={label} htmlFor={name} error={fields[name]?.[0]}>
                  <Textarea dictate id={name} name={name} value={value} onChange={(e) => set(e.target.value)} invalid={Boolean(fields[name])} maxLength={5000} />
                </Field>
              ))}
            </div>
          </details>

          {evidenceOptions.length > 0 && (
            <fieldset className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
              <legend className="px-1 text-sm font-medium text-slate-700 dark:text-slate-200">Attach evidence (optional)</legend>
              <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">Link files already in this project&apos;s evidence library.</p>
              <div className="grid max-h-56 gap-2 overflow-y-auto">
                {evidenceOptions.map((e) => (
                  <label key={e.id} className="flex min-h-11 items-center gap-2 text-sm">
                    <Checkbox checked={selectedEvidence.includes(e.id)} onChange={() => toggleEvidence(e.id)} />
                    <span>{e.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </div>
      </details>

      {actionState.error && <p role="alert" className="text-sm font-medium text-danger-700 dark:text-danger-400">{actionState.error}</p>}

      <div className="sticky bottom-0 -mx-4 flex justify-end gap-3 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-slate-900/95">
        {uploadFailures.length > 0 ? (
          <Button type="button" variant="secondary" className="min-h-[52px]" disabled={leaving || uploading} onClick={() => {
            if (onSaved) { onSaved({ title: activityTitle, queued: false }); return; }
            setLeaving(true);
            router.push(`/projects/${projectId}/activities?view=completed`);
            router.refresh();
          }}>Finish without these files</Button>
        ) : !embedded ? (
          <Button type="button" variant="secondary" className="min-h-[52px]" disabled={Boolean(createdActivityId)} onClick={() => router.back()}>Cancel</Button>
        ) : null}
        <Button type="submit" className="min-h-[52px] flex-1 text-base sm:flex-none" pending={actionState.busy || uploading} disabled={leaving}>
          {uploadFailures.length > 0 ? "Retry failed uploads" : embedded ? t("record.value.save") : "Submit activity"}
        </Button>
      </div>
    </form>
  );
}

/** Opens "Add detail" by itself when a problem sits inside it, so an error is never hidden behind a closed panel. */
function participantErrorsOpen(fields: Record<string, string[]>): boolean {
  return ["participantsTotal", "participantsMale", "participantsFemale", "participantsChildren", "participantsDisability", "activityEndDate", "reportingPeriodId", "logframeActivityId"].some((k) => (fields[k]?.length ?? 0) > 0);
}

type NewActivityFormProps = Omit<Parameters<typeof NewActivityFormInner>[0], "onQueued">;

/**
 * The new-activity form. When it was finished without a connection, the record is kept on this device (the outbox sends
 * it later) and this confirms that in place, because the next page could not be loaded offline either.
 */
export function NewActivityForm(props: NewActivityFormProps) {
  const [session, setSession] = useState(0);
  const [queuedTitle, setQueuedTitle] = useState<string | null>(null);
  // Inside the Record sheet the sheet itself confirms a record kept on the phone.
  if (props.embedded) return <NewActivityFormInner key={session} {...props} onQueued={(title) => props.onSaved?.({ title, queued: true })} />;
  if (queuedTitle !== null) {
    return (
      <div className="card mt-6 max-w-3xl space-y-3" role="status">
        <h2 className="text-base font-semibold">Saved on this device</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          &ldquo;{queuedTitle || "Your activity"}&rdquo; will be sent as soon as you are back online. You can leave this page; the status shows at the bottom of the screen.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => {
              setQueuedTitle(null);
              setSession((n) => n + 1);
            }}
          >
            Record another activity
          </Button>
          <a className="btn-secondary" href={`/projects/${props.projectId}/activities`}>Back to activities</a>
        </div>
      </div>
    );
  }
  return <NewActivityFormInner key={session} {...props} onQueued={setQueuedTitle} />;
}
