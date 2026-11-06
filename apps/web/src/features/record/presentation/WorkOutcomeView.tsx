"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PackPlanItem } from "@/features/offline/domain/offline-pack";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { Textarea } from "@/components/ui/Textarea";
import { Input } from "@/components/ui/Input";
import { formatDate } from "@/lib/shared/dates";
import { chooseWorkOutcome, type WorkChoice } from "../domain/work-outcome";
import { ActivityView } from "./ActivityView";
import { ConfirmationScreen } from "./ConfirmationScreen";
import { DayChips } from "./DayChips";
import type { KindViewProps } from "./KindView";

type Step = { kind: "choose" } | { kind: "quick" } | { kind: "full" } | { kind: "notHeld" };
type Done = { headline: string; detail: string; queued: boolean };

const OPTION = "flex min-h-[88px] w-full items-center gap-4 rounded-2xl border border-slate-300 bg-white px-4 text-start transition hover:border-brand-400 dark:border-white/15 dark:bg-slate-900/40";

/**
 * "What happened?" for a planned item: finished, some progress, or it did not happen. One question replaces Mark done, the progress
 * log's entry point and the activity form's start. `chooseWorkOutcome` (the domain rule) decides which existing action carries each
 * answer; this screen only asks and shows. A refusal is shown as it is.
 */
export function WorkOutcomeView(props: KindViewProps & { plannedActivityId: string }) {
  const { deps, projectId, today, onClose, plannedActivityId, can } = props;
  const mayCancel = can("workplan.manage");
  const { t } = useI18n();
  const [plan, setPlan] = useState<PackPlanItem | null | undefined>(undefined);
  const [step, setStep] = useState<Step>({ kind: "choose" });
  const [done, setDone] = useState<Done | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finishedOn, setFinishedOn] = useState(today);
  const [people, setPeople] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const online = deps.online;

  useEffect(() => {
    let alive = true;
    deps.lookup.plan(projectId).then((items) => { if (alive) setPlan(items?.find((p) => p.id === plannedActivityId) ?? null); }).catch(() => { if (alive) setPlan(null); });
    return () => { alive = false; };
  }, [deps.lookup, projectId, plannedActivityId]);

  if (plan === undefined) return <p className="text-sm text-slate-600 dark:text-slate-300">{t("record.sheet.loading")}</p>;
  // A plan item this phone does not know about: record the work as a plain activity instead of blocking.
  if (plan === null) return <ActivityView {...props} />;

  const status = plan.status as "PLANNED" | "IN_PROGRESS" | "DONE" | "CANCELLED";
  const planPage = `/projects/${projectId}/activities/plan/${plan.id}`;
  const outcome = (choice: WorkChoice, extra: { hasDetail?: boolean; reason?: string } = {}) =>
    chooseWorkOutcome({ choice, planStatus: status, hasDetail: extra.hasDetail ?? false, online, mayCancel, ...(extra.reason !== undefined ? { reason: extra.reason } : {}) });

  async function quickFinish() {
    setBusy(true); setError(null);
    const r = await deps.workSink.completePlanned({ itemId: plan!.id, title: plan!.title, finishedOn, people, note });
    setBusy(false);
    if (!r.ok) { setError(r.message); return; }
    setDone({ headline: t("record.work.doneSaved"), detail: t("record.work.doneDetail", { title: plan!.title }), queued: false });
  }

  async function markDoneAfterActivity(info: { queued: boolean }) {
    // The activity is saved (or kept on the phone); marking the plan item done is the second step, dated to the day it was done.
    await deps.workSink.changeStatus({ itemId: plan!.id, title: plan!.title, action: "COMPLETE", completedOn: today });
    void info;
  }

  async function notHeld() {
    const decided = outcome("NOT_HELD", { reason });
    if (!decided.ok) { setError(decided.problem === "NEEDS_REASON" ? t("record.work.reasonNeeded") : t("record.work.notOpen")); return; }
    setBusy(true); setError(null);
    const r = await deps.workSink.changeStatus({ itemId: plan!.id, title: plan!.title, action: "CANCEL", reason: reason.trim() });
    setBusy(false);
    if (!r.ok) { setError(r.message); return; }
    setDone({ headline: t("record.work.cancelledSaved"), detail: r.value.queued ? t("record.work.keptDetail", { title: plan!.title }) : t("record.work.cancelledDetail", { title: plan!.title }), queued: r.value.queued });
  }

  if (done) {
    return <ConfirmationScreen queued={done.queued} headline={done.headline} detail={done.detail} anotherLabel={t("record.work.another")} onAnother={() => { setDone(null); setStep({ kind: "choose" }); setNote(""); setPeople(""); setReason(""); }} onDone={onClose} />;
  }

  const open = outcome("FINISHED").ok || (mayCancel && outcome("NOT_HELD", { reason: "x" }).ok);
  const header = (
    <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900/40">
      <p className="text-xs font-bold uppercase tracking-wide text-brand-700 dark:text-brand-300">{t("record.work.plannedLabel")}</p>
      <p className="mt-1 text-xl font-bold">{plan.title}</p>
      <p className="text-sm text-slate-600 dark:text-slate-300">{formatDate(plan.plannedStart)}{plan.location ? ` · ${plan.location}` : ""}</p>
    </div>
  );

  if (!open) return <>{header}<p className="text-sm text-slate-700 dark:text-slate-200">{t("record.work.notOpen")}</p></>;

  if (step.kind === "full") {
    return <>{header}<ActivityView {...props} afterSave={markDoneAfterActivity} /></>;
  }

  if (step.kind === "quick") {
    return (
      <>
        {header}
        <h3 className="mb-1 text-lg font-bold">{t("record.work.quickTitle")}</h3>
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">{t("record.work.quickHint")}</p>
        <div className="space-y-4">
          <DayChips date={finishedOn} today={today} onChange={setFinishedOn} />
          <div className="space-y-1"><label className="label" htmlFor="work-people">{t("record.work.people")}</label><Input id="work-people" inputMode="numeric" className="min-h-[52px] text-lg" value={people} onChange={(e) => setPeople(e.target.value)} /></div>
          <div className="space-y-1"><label className="label" htmlFor="work-note">{t("record.work.note")}</label><Textarea dictate id="work-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></div>
          {error && <p role="alert" className="text-sm font-medium text-danger-700 dark:text-danger-400">{error}</p>}
          <button type="button" className="btn-primary min-h-[52px] w-full text-base" disabled={busy} onClick={() => void quickFinish()}>{t("record.work.markDone")}</button>
          <button type="button" className="btn-secondary min-h-[48px] w-full" onClick={() => setStep({ kind: "full" })}>{t("record.work.addDetail")}</button>
        </div>
      </>
    );
  }

  if (step.kind === "notHeld") {
    return (
      <>
        {header}
        <h3 className="mb-3 text-lg font-bold">{t("record.work.notHeld")}</h3>
        <div className="space-y-4">
          <div className="space-y-1"><label className="label" htmlFor="work-reason">{t("record.work.reason")}</label><Textarea dictate id="work-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          {error && <p role="alert" className="text-sm font-medium text-danger-700 dark:text-danger-400">{error}</p>}
          <button type="button" className="btn-primary min-h-[52px] w-full text-base" disabled={busy} onClick={() => void notHeld()}>{t("record.work.cancelSave")}</button>
          <Link className="btn-secondary min-h-[48px] w-full" href={planPage} prefetch={false} onClick={onClose}>{t("record.work.moveInstead")}</Link>
        </div>
      </>
    );
  }

  const finishedFirst = online && outcome("FINISHED", { hasDetail: false }).ok && (outcome("FINISHED", { hasDetail: false }) as { ok: true; steps: Array<{ action: string }> }).steps[0]?.action === "COMPLETE_PLANNED";
  return (
    <>
      {header}
      <h3 className="mb-3 text-xl font-bold">{t("record.work.title")}</h3>
      <div className="space-y-3">
        <button type="button" className={OPTION} onClick={() => setStep({ kind: finishedFirst ? "quick" : "full" })}>
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-300" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg></span>
          <span><span className="block text-lg font-bold">{t("record.work.finished")}</span><span className="block text-sm text-slate-600 dark:text-slate-300">{t("record.work.finishedHint")}</span></span>
        </button>
        <Link className={OPTION} href={planPage} prefetch={false} onClick={onClose}>
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-200" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 18h4V12H4zM10 18h4V8h-4zM16 18h4V4h-4z" /></svg></span>
          <span><span className="block text-lg font-bold">{t("record.work.progress")}</span><span className="block text-sm text-slate-600 dark:text-slate-300">{t("record.work.progressHint")}</span></span>
        </Link>
        {mayCancel && <button type="button" className={OPTION} onClick={() => setStep({ kind: "notHeld" })}>
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-300" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg></span>
          <span><span className="block text-lg font-bold">{t("record.work.notHeld")}</span><span className="block text-sm text-slate-600 dark:text-slate-300">{t("record.work.notHeldHint")}</span></span>
        </button>}
      </div>
    </>
  );
}
