"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import type { PackEntryPlace, PackIndicator, PackIndicatorPlace, PackPlanItem } from "@/features/offline/domain/offline-pack";
import { dateLanding, type QuickPeriod } from "@/features/reporting/domain/quick-entry-view";
import { PLACE_FIRST_PREFS_KEY, cellProblem, changedCells, parsePlacePrefs, placeFirstAgenda, type SplitRow } from "../domain/place-first";
import { DayChips } from "./DayChips";
import type { KindViewProps } from "./KindView";
import { PlaceCellRow } from "./PlaceCellRow";
import { PlacePickerList } from "./PlacePickerList";
import { WorkOutcomeView } from "./WorkOutcomeView";

type Loaded = { places: PackEntryPlace[]; indicatorPlaces: PackIndicatorPlace[]; indicators: PackIndicator[]; periods: QuickPeriod[]; plan: PackPlanItem[] };

function rememberedPlace(projectId: string): string | undefined {
  try { return parsePlacePrefs(window.localStorage.getItem(PLACE_FIRST_PREFS_KEY))[projectId]; } catch { return undefined; }
}
function rememberPlace(projectId: string, placeId: string) {
  try {
    const prefs = parsePlacePrefs(window.localStorage.getItem(PLACE_FIRST_PREFS_KEY));
    window.localStorage.setItem(PLACE_FIRST_PREFS_KEY, JSON.stringify({ ...prefs, [projectId]: placeId }));
  } catch { /* remembered for this visit only */ }
}

/**
 * Place-first entry (Phase 57): choose a place once and a day (the period follows from it), then fill everything due there — the
 * person's planned work at that place and every figure measured there. Reads through the lookup and writes through the place sink, so it
 * is the same online and with no signal. The total of each indicator is never typed: the server adds up the places.
 */
export function PlaceFirstView(props: KindViewProps) {
  const { deps, projectId, today } = props;
  const { t } = useI18n();
  const router = useRouter();
  const [data, setData] = useState<Loaded | "missing" | "failed" | null>(null);
  const [place, setPlace] = useState<PackEntryPlace | null>(null);
  const [date, setDate] = useState(today);
  const [cells, setCells] = useState<Array<{ indicatorId: string; value: string; locked: boolean; lockReason?: string }> | "missing" | null>(null);
  const [typed, setTyped] = useState<Map<string, string>>(new Map());
  const [splits, setSplits] = useState<Map<string, SplitRow[]>>(new Map());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [planned, setPlanned] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([deps.lookup.placeEntry(projectId), deps.lookup.indicators(projectId), deps.lookup.periods(projectId), deps.lookup.plan(projectId)])
      .then(([entry, indicators, periods, plan]) => {
        if (!alive) return;
        if (!entry || !indicators || !periods) { setData("missing"); return; }
        const loaded = { ...entry, indicators, periods: periods.map((p) => ({ id: p.id, reportType: p.reportType, startDate: p.startDate, endDate: p.endDate, status: p.status })), plan: plan ?? [] };
        setData(loaded);
        const remembered = rememberedPlace(projectId);
        setPlace(loaded.places.find((p) => p.placeId === remembered) ?? (loaded.places.length === 1 ? loaded.places[0]! : null));
      })
      .catch(() => alive && setData("failed"));
    return () => { alive = false; };
  }, [deps.lookup, projectId]);

  const periods = data && typeof data === "object" ? data.periods : [];
  const landing = useMemo(() => dateLanding(date, periods), [date, periods]);
  const periodId = landing.kind === "FOUND" ? landing.periodId : null;

  const loadCells = useCallback(async () => {
    if (!place || !periodId) { setCells(null); return; }
    setCells(null);
    try { setCells((await deps.lookup.placeCells(projectId, periodId, place.placeId)) ?? "missing"); } catch { setCells("missing"); }
  }, [deps.lookup, projectId, periodId, place]);

  useEffect(() => { void loadCells(); setTyped(new Map()); setSplits(new Map()); }, [loadCells]);

  if (data === null) return <p className="text-sm text-slate-600 dark:text-slate-300">{t("record.sheet.loading")}</p>;
  if (data === "missing") return <p className="text-sm text-slate-600 dark:text-slate-300">{t("placeEntry.notOnPhone")}</p>;
  if (data === "failed") return <p role="alert" className="text-sm text-slate-700 dark:text-slate-200">{t("record.sheet.loadFailed")}</p>;
  if (data.places.length === 0) return <p className="text-sm text-slate-600 dark:text-slate-300">{t("placeEntry.noPlaces")}</p>;
  if (planned) return <><button type="button" className="mb-3 inline-flex min-h-11 items-center text-sm font-semibold text-brand-700 dark:text-brand-300" onClick={() => setPlanned(null)}>‹ {place?.name}</button><WorkOutcomeView {...props} plannedActivityId={planned} /></>;
  if (!place) return <PlacePickerList places={data.places} recent={rememberedPlace(projectId)} onChoose={(p) => { setPlace(p); rememberPlace(projectId, p.placeId); }} />;

  const period = periods.find((p) => p.id === periodId);
  const agenda = period && Array.isArray(cells)
    ? placeFirstAgenda({ place, period, places: data.places, indicators: data.indicators, indicatorPlaces: data.indicatorPlaces, cells, plan: data.plan })
    : null;
  const toSend = agenda ? changedCells(agenda.cells, typed, splits) : [];
  const blocked = agenda?.cells.some((c) => typed.has(c.indicatorId) && cellProblem(typed.get(c.indicatorId)!, c, splits.get(c.indicatorId)) !== null) ?? false;

  async function save() {
    if (!periodId || !place || toSend.length === 0) { setMessage({ text: t("placeEntry.nothingChanged"), error: false }); return; }
    setBusy(true); setMessage(null);
    const r = await deps.placeSink.saveCells({ projectId, periodId, title: place.name, cells: toSend.map((c) => ({ ...c, placeId: place.placeId })) });
    setBusy(false);
    if (!r.ok) { setMessage({ text: r.message, error: true }); return; }
    setMessage({ text: [r.value.queued ? t("placeEntry.queued") : t("placeEntry.saved", { place: place.name }), ...r.value.notices].join(" "), error: false });
    // Show what was saved (or kept on the phone) at once: the pack on a phone does not change by itself.
    const sent = new Map(toSend.map((c) => [c.indicatorId, c.value]));
    setCells((current) => (Array.isArray(current) ? current.map((c) => (sent.has(c.indicatorId) ? { ...c, value: sent.get(c.indicatorId)! } : c)) : current));
    setTyped(new Map()); setSplits(new Map());
    if (!r.value.queued && deps.lookup.source === "network") { deps.lookup.refresh(projectId); await loadCells(); router.refresh(); }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label">{t("placeEntry.place")}</p>
          <p className="text-lg font-bold">{place.name}</p>
          {place.path !== place.name && <p className="text-sm text-slate-600 dark:text-slate-300">{place.path}</p>}
        </div>
        <button type="button" className="btn-secondary btn-sm min-h-11" onClick={() => { setPlace(null); setMessage(null); }}>{t("placeEntry.changePlace")}</button>
      </div>
      <DayChips date={date} today={today} onChange={setDate} />
      {landing.kind !== "FOUND" ? <p role="alert" className="text-sm text-slate-700 dark:text-slate-200">{t("placeEntry.noPeriod")}</p> : (
        <p className="text-sm text-slate-600 dark:text-slate-300">{t("placeEntry.period")}: {landing.label}</p>
      )}
      {cells === "missing" && <p className="text-sm text-slate-600 dark:text-slate-300">{t(deps.lookup.source === "pack" ? "placeEntry.periodNotOnPhone" : "placeEntry.notOnPhone")}</p>}
      {periodId && cells === null && <p className="text-sm text-slate-600 dark:text-slate-300">{t("record.sheet.loading")}</p>}
      {agenda && (
        <>
          <section className="space-y-2">
            <h4 className="section-title">{t("placeEntry.activities")}</h4>
            {agenda.activities.length === 0 ? <p className="text-sm text-slate-600 dark:text-slate-300">{t("placeEntry.noActivities")}</p> : (
              <ul className="space-y-2">
                {agenda.activities.map((a) => (
                  <li key={a.id}>
                    <button type="button" className="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-xl border border-slate-300 px-4 text-start hover:border-brand-400 dark:border-white/15" onClick={() => setPlanned(a.id)}>
                      <span className="font-semibold">{a.title}</span>
                      <span className="text-sm text-brand-700 dark:text-brand-300">{t("placeEntry.whatHappened")}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h4 className="section-title">{t("placeEntry.figures")}</h4>
            {agenda.cells.length === 0 ? <p className="text-sm text-slate-600 dark:text-slate-300">{t("placeEntry.noFigures")}</p> : (
              <>
                <p className="text-xs text-slate-500">{t("placeEntry.emptyNotZero")}</p>
                <ul className="divide-y divide-slate-200 dark:divide-white/10">
                  {agenda.cells.map((c) => (
                    <PlaceCellRow key={c.indicatorId} cell={c} typed={typed.get(c.indicatorId) ?? c.stored} splits={splits.get(c.indicatorId) ?? []}
                      onType={(v) => setTyped((m) => new Map(m).set(c.indicatorId, v))}
                      onSplits={(rows) => setSplits((m) => new Map(m).set(c.indicatorId, rows))} />
                  ))}
                </ul>
              </>
            )}
          </section>
          {message && <p role={message.error ? "alert" : "status"} className={`text-sm ${message.error ? "text-red-700 dark:text-red-300" : "text-emerald-800 dark:text-emerald-300"}`}>{message.text}</p>}
          {agenda.cells.some((c) => !c.locked) && (
            <button type="button" className="btn-primary btn-touch w-full" disabled={busy || blocked} onClick={() => void save()}>{busy ? t("placeEntry.saving") : t("placeEntry.save")}</button>
          )}
        </>
      )}
    </div>
  );
}
