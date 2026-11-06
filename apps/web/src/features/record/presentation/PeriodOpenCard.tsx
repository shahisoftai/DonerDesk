"use client";

import { useEffect, useState } from "react";
import type { PeriodProposal } from "@donordesk/domain/contexts/reporting/period-for-date-proposal.js";
import type { PeriodOpener } from "../ports/record-services";
import { formatDate } from "@/lib/shared/dates";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";

/**
 * Shown when the chosen day falls in no reporting period. It says what is missing, in words, and offers the one next step: a manager
 * opens the period the project's own schedule calls for (the same rule as the period form), anyone else asks the project manager
 * through an ordinary request. With no connection it shows nothing, and the note above it already says the day has nowhere to count.
 */
export function PeriodOpenCard({ projectId, date, canOpen, opener, onOpened, savesAfter = true }: { projectId: string; date: string; canOpen: boolean; opener: PeriodOpener; onOpened: () => void; /** The form saves what was typed once the period is open (the number form does); otherwise the button only opens it. */ savesAfter?: boolean }) {
  const { t } = useI18n();
  const [proposal, setProposal] = useState<PeriodProposal | "unknown" | null>(null);
  const [busy, setBusy] = useState<"open" | "ask" | null>(null);
  const [asked, setAsked] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setProposal(null);
    setAsked(false);
    setProblem(null);
    void opener.proposal(projectId, date).then((p) => { if (alive) setProposal(p ?? "unknown"); }).catch(() => { if (alive) setProposal("unknown"); });
    return () => { alive = false; };
  }, [opener, projectId, date]);

  async function open() {
    setBusy("open");
    setProblem(null);
    const r = await opener.open(projectId, date);
    setBusy(null);
    if (r.ok) onOpened();
    else setProblem(r.message);
  }

  async function ask() {
    setBusy("ask");
    setProblem(null);
    const r = await opener.ask(projectId, date);
    setBusy(null);
    if (r.ok) setAsked(true);
    else setProblem(t("record.period.askFailed", { reason: r.message }));
  }

  if (proposal === null || proposal === "unknown") return null;
  if (proposal.kind === "COVERED") return null;

  const refusal = proposal.kind === "NONE"
    ? ({ NO_CADENCE: "record.period.noCadence", NOT_NEXT_IN_CHAIN: "record.period.noCadence", BEFORE_PROJECT: "record.period.outsideProject", AFTER_PROJECT: "record.period.outsideProject", CLOSED_PROJECT: "record.period.closedProject", BAD_DATE: null } as const)[proposal.reason]
    : null;

  return (
    <section aria-label={t("record.period.missingTitle")} className="space-y-3 rounded-2xl border border-warning-500/40 bg-warning-50/80 p-4 text-warning-900 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-100">
      <h3 className="text-base font-bold">{t("record.period.missingTitle")}</h3>
      {proposal.kind === "NONE" ? (
        refusal && <p className="text-sm leading-snug">{t(refusal)}</p>
      ) : (
        <>
          <p className="text-sm leading-snug">{t("record.period.missingBody", { date: formatDate(date) })}</p>
          {asked ? (
            <p role="status" className="text-sm font-medium">{t("record.period.asked")}</p>
          ) : canOpen ? (
            <>
              <p className="text-sm leading-snug">{t("record.period.managerBody")}</p>
              <p className="text-sm font-semibold">{t("record.period.willOpen", { dates: `${formatDate(proposal.target.startDate)} – ${formatDate(proposal.target.endDate)}` })}</p>
              <button type="button" className="btn-primary min-h-[52px] w-full text-base" disabled={busy !== null} onClick={() => void open()}>{busy === "open" ? t("record.period.opening") : savesAfter ? t("record.period.openAndSave") : t("record.period.open")}</button>
            </>
          ) : (
            <button type="button" className="btn-primary min-h-[52px] w-full text-base" disabled={busy !== null} onClick={() => void ask()}>{t("record.period.ask")}</button>
          )}
        </>
      )}
      {problem && <p role="alert" className="text-sm font-medium text-danger-700 dark:text-danger-300">{problem}</p>}
    </section>
  );
}
