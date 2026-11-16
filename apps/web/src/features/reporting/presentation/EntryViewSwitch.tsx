"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { PlaceSheetView } from "./PlaceSheetView";

const KEY = "donordesk-entry-view";
type View = "indicator" | "place";

/** "By indicator | By place" above the period's figures (Phase 57). The choice is remembered on this device. */
export function EntryViewSwitch({ projectId, periodId, canEdit, children }: { projectId: string; periodId: string; canEdit: boolean; children: ReactNode }) {
  const { t } = useI18n();
  const [view, setView] = useState<View>("indicator");
  useEffect(() => {
    try { if (window.localStorage.getItem(KEY) === "place") setView("place"); } catch { /* default view */ }
  }, []);
  function choose(next: View) {
    setView(next);
    try { window.localStorage.setItem(KEY, next); } catch { /* remembered for this visit only */ }
  }
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-xl border border-slate-300 p-1 dark:border-white/15" role="group">
        {(["indicator", "place"] as const).map((v) => (
          <button key={v} type="button" aria-pressed={view === v} onClick={() => choose(v)}
            className={`min-h-10 rounded-lg px-4 text-sm font-semibold ${view === v ? "bg-brand-600 text-white" : "text-slate-700 dark:text-slate-200"}`}>
            {t(`placeSheet.view.${v}`)}
          </button>
        ))}
      </div>
      {view === "indicator" ? children : <PlaceSheetView projectId={projectId} periodId={periodId} canEdit={canEdit} />}
    </div>
  );
}
