"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { EDIT_TABS, type EditTab } from "../domain/drawer-state";

interface Props {
  tab: EditTab;
  onTab: (tab: EditTab) => void;
  /** Nothing selected: the page and canvas settings take the whole drawer. */
  selectedCount: number;
  pageSettings: ReactNode;
  build: ReactNode;
  data: ReactNode;
  format: ReactNode;
  interactions: ReactNode;
  /** Align, distribute, group: shown above the tabs when several blocks are selected. */
  multiActions?: ReactNode;
}

/**
 * The Edit drawer's contents (Phase 50.1): Build, Data, Format and Interactions for what is selected; the page's own settings when
 * nothing is. With several blocks selected only Format applies (it shows what they share). Tabs follow the ARIA tabs pattern.
 */
export function EditDrawer({ tab, onTab, selectedCount, pageSettings, build, data, format, interactions, multiActions }: Props) {
  const { t } = useI18n();
  if (selectedCount === 0) return <div data-testid="edit-drawer" className="space-y-3"><h3 className="text-sm font-semibold">{t("drawer.pageSettings")}</h3>{pageSettings}</div>;
  const tabs: readonly EditTab[] = selectedCount > 1 ? ["FORMAT"] : EDIT_TABS;
  const current = tabs.includes(tab) ? tab : tabs[0]!;
  const body = { BUILD: build, DATA: data, FORMAT: format, INTERACTIONS: interactions }[current];
  return (
    <div data-testid="edit-drawer" className="space-y-3">
      {selectedCount > 1 && <p className="text-xs font-medium">{t("drawer.selectedCount", { count: selectedCount })}</p>}
      {selectedCount > 1 && multiActions}
      <div role="tablist" aria-label={t("drawer.edit")} className="flex gap-1 border-b border-slate-200 dark:border-slate-700"
        onKeyDown={(e) => { const i = tabs.indexOf(current); const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0; if (step) { e.preventDefault(); const rtl = document.dir === "rtl" ? -1 : 1; onTab(tabs[(i + step * rtl + tabs.length) % tabs.length]!); } }}>
        {tabs.map((k) => (
          <button key={k} type="button" role="tab" id={`edit-tab-${k}`} aria-selected={k === current} aria-controls="edit-tab-panel" tabIndex={k === current ? 0 : -1} data-tab={k} onClick={() => onTab(k)}
            className={`-mb-px min-h-9 border-b-2 px-2 text-xs ${k === current ? "border-brand-600 font-semibold" : "border-transparent text-slate-600 hover:border-slate-300 dark:text-slate-300"}`}>{t(`tab.${k}` as never)}</button>
        ))}
      </div>
      <div role="tabpanel" id="edit-tab-panel" aria-labelledby={`edit-tab-${current}`}>{body}</div>
    </div>
  );
}
