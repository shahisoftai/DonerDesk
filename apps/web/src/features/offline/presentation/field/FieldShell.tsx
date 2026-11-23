"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { buildToday, plainDateOf, weekGroups, type VisitTask, type WorkTask } from "../../domain/field-today";
import { summarise } from "../../domain/outbox";
import { useOutbox } from "../OutboxProvider";
import { FieldTabBar, type FieldTab } from "./FieldTabBar";
import { FormScreen } from "./FormScreen";
import { GetMyWorkCard } from "./GetMyWorkCard";
import { GreetingHeader } from "./GreetingHeader";
import { MeScreen } from "./MeScreen";
import { RecordScreen } from "./RecordScreen";
import { TodayScreen } from "./TodayScreen";
import { WaitingScreen } from "./WaitingScreen";
import { WeekScreen } from "./WeekScreen";
import { useFieldPacks } from "./useFieldPacks";

type Screen =
  | { kind: "tabs" }
  | { kind: "form"; projectId: string; formId: string; placeId?: string }
  | { kind: "record"; projectId?: string; plannedActivityId?: string };

/** The phone's own clock, kept fresh: the day changes at midnight and a person may leave the app open overnight. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", tick); };
  }, []);
  return now;
}

/**
 * The field app (Phase 64): Today, My week, Waiting and Me, as four large tabs; a form or a record opens full screen with one way back.
 * It shows only what is stored on this phone (the work downloaded earlier), so the page itself holds no private data and may be kept for
 * offline opening. Words come from the catalogue; what comes first is decided by `buildToday` (pure, tested).
 */
export function FieldShell({ userId, onUser }: { userId: string; onUser: (id: string) => void }) {
  const { t } = useI18n();
  const outbox = useOutbox();
  const { packs, busy, getWork } = useFieldPacks(userId, onUser, outbox.online);
  const [tab, setTab] = useState<FieldTab>("today");
  const [screen, setScreen] = useState<Screen>({ kind: "tabs" });
  const [toast, setToast] = useState<string | null>(null);
  const [refreshed, setRefreshed] = useState(false);
  const now = useNow();
  const today = plainDateOf(now);
  const { waiting, needsAttention } = summarise(outbox.entries);

  const hasWork = !!packs && packs.length > 0;
  const view = useMemo(() => (hasWork ? buildToday(packs, today) : null), [hasWork, packs, today]);
  const groups = useMemo(() => (view ? weekGroups(view, today) : []), [view, today]);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(null), 9000); return () => clearTimeout(id); }, [toast]);

  const packOf = (projectId: string) => packs?.find((p) => p.projectId === projectId);
  const startVisit = (v: VisitTask) => setScreen({ kind: "form", projectId: v.projectId, formId: v.formId, placeId: v.placeId });
  const record = (w?: WorkTask) => setScreen({ kind: "record", ...(w ? { projectId: w.projectId, plannedActivityId: w.id } : {}) });
  const back = () => setScreen({ kind: "tabs" });

  if (screen.kind === "form" && packOf(screen.projectId)) {
    const pack = packOf(screen.projectId)!;
    return (
      <main className="mx-auto max-w-xl px-4 pb-16 pt-3">
        <FormScreen pack={pack} formId={screen.formId} placeId={screen.placeId} onBack={back} onDone={(sentNow) => { setToast(sentNow ? t("fa.done.sent") : t("fa.done.saved")); setTab("today"); back(); }} />
      </main>
    );
  }
  if (screen.kind === "record" && packs) {
    return <main className="mx-auto max-w-xl px-4 pb-16 pt-3"><RecordScreen packs={packs} projectId={screen.projectId} plannedActivityId={screen.plannedActivityId} onBack={back} /></main>;
  }

  return (
    <>
      <main className="mx-auto max-w-xl px-4 pb-36 pt-4">
        {tab === "today" && (
          <>
            <GreetingHeader name={packs?.[0]?.userName ?? ""} today={today} now={now} view={view} online={outbox.online} waiting={waiting} attention={needsAttention} sending={outbox.sending} onSendNow={() => void outbox.sendNow()} />
            {toast && <p role="status" className="mt-4 rounded-2xl bg-success-50 p-4 text-base font-semibold text-success-900 dark:bg-success-500/15 dark:text-success-100">✓ {toast}</p>}
            {needsAttention > 0 && (
              <button type="button" onClick={() => setTab("waiting")} className="mt-4 flex min-h-[60px] w-full items-center justify-between rounded-2xl bg-warning-50 p-4 text-start text-base font-semibold text-warning-900 dark:bg-warning-500/15 dark:text-warning-100">
                <span>{t("fa.sync.attention", { count: needsAttention })}</span><span aria-hidden="true">›</span>
              </button>
            )}
            <div className="mt-5">
              {packs === null ? <p className="p-6 text-center text-slate-500">{t("common.loading")}</p>
                : !view ? <GetMyWorkCard busy={busy} online={outbox.online} supported={outbox.supported} onGet={getWork} />
                : <TodayScreen view={view} packs={packs} onStartVisit={startVisit} onRecord={record} onFillForm={(projectId, formId) => setScreen({ kind: "form", projectId, formId })} />}
            </div>
          </>
        )}
        {tab === "week" && <WeekScreen groups={groups} onStartVisit={startVisit} onRecord={record} />}
        {tab === "waiting" && <WaitingScreen />}
        {tab === "me" && packs && (
          <MeScreen name={packs[0]?.userName ?? ""} packs={packs} online={outbox.online} busy={busy} refreshed={refreshed} waiting={waiting} onRefresh={() => void getWork().then((r) => setRefreshed(r === "READY"))} />
        )}
      </main>
      {hasWork && <FieldTabBar tab={tab} onTab={setTab} waiting={waiting + needsAttention} />}
    </>
  );
}
