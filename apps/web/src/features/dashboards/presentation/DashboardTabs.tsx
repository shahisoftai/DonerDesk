"use client";

import { useMemo, useState } from "react";
import { settleLayout, tabsOf, widgetsOnTab, type DashboardWidget } from "@donordesk/domain/contexts/dashboards/index.js";

/** The tab strip for a dashboard: the unnamed tab first (only when something is on it), then the named ones in reading order. */
export function useDashboardTabs(widgets: DashboardWidget[]) {
  const named = useMemo(() => tabsOf(widgets), [widgets]);
  const hasUnnamed = useMemo(() => widgetsOnTab(widgets, "").length > 0, [widgets]);
  const tabs = useMemo(() => (named.length === 0 ? [] : [...(hasUnnamed ? [""] : []), ...named]), [named, hasUnnamed]);
  const [chosen, setChosen] = useState<string | null>(null);
  const active = chosen !== null && tabs.includes(chosen) ? chosen : (tabs[0] ?? "");
  const visible = useMemo(() => (tabs.length === 0 ? widgets : settleLayout(widgetsOnTab(widgets, active))), [tabs, widgets, active]);
  return { tabs, active, setActive: setChosen, visible };
}

export function DashboardTabBar({ tabs, active, onSelect, overviewLabel }: { tabs: string[]; active: string; onSelect: (tab: string) => void; overviewLabel: string }) {
  if (tabs.length === 0) return null;
  return (
    <div role="tablist" className="flex flex-wrap gap-2 border-b border-slate-200 pb-2 dark:border-white/10" data-no-print>
      {tabs.map((tab) => (
        <button key={tab || "_"} role="tab" type="button" aria-selected={tab === active} onClick={() => onSelect(tab)}
          className={`rounded-lg px-3 py-1.5 text-sm ${tab === active ? "bg-brand-50 font-medium text-brand-800 dark:bg-white/10 dark:text-brand-200" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"}`}>{tab || overviewLabel}</button>
      ))}
    </div>
  );
}

/** Edit mode: name the tab each chart sits on. A name not used before makes a new tab; clearing it puts the chart on the first tab. */
export function TabAssigner({ widgets, titles, onChange }: { widgets: DashboardWidget[]; titles: Map<string, string>; onChange: (next: DashboardWidget[]) => void }) {
  const named = tabsOf(widgets);
  return (
    <details className="rounded-lg border border-slate-200 p-3 text-sm dark:border-white/10">
      <summary className="cursor-pointer font-medium">Tabs</summary>
      <p className="mt-2 text-xs text-slate-500">Give each chart a tab name to split the dashboard into tabs (up to 8). Charts with no name stay on the first tab.</p>
      <datalist id="dashboard-tab-names">{named.map((n) => <option key={n} value={n} />)}</datalist>
      <ul className="mt-2 space-y-2">
        {widgets.map((w, i) => (
          <li key={w.id} className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 flex-1 truncate">{titles.get(w.id) || (w.kind === "TEXT" ? (w.text ?? "Text").slice(0, 40) : `Chart ${i + 1}`)}</span>
            <input aria-label={`Tab for ${titles.get(w.id) || `chart ${i + 1}`}`} list="dashboard-tab-names" maxLength={40} defaultValue={w.tab ?? ""} placeholder="First tab"
              className="h-8 w-40 rounded border border-slate-300 bg-white px-2 dark:border-white/15 dark:bg-white/5"
              onBlur={(e) => { const v = e.target.value.trim().replace(/\s+/g, " "); if ((w.tab ?? "") !== v) onChange(widgets.map((x) => (x.id === w.id ? { ...x, tab: v || undefined } : x))); }} />
          </li>
        ))}
      </ul>
    </details>
  );
}
