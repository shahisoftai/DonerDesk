"use client";

import { useState } from "react";
import type { DataSheetResponse } from "@/lib/server/schemas";
import { DataSheetTable } from "./DataSheetTable";
import { FinanceSheetTable } from "./FinanceSheetTable";
import { DataChartBuilder } from "./DataChartBuilder";
import { AddToReportPanel } from "./AddToReportPanel";
import { DataSheetImport } from "./DataSheetImport";
import { PlaceResultsView } from "./PlaceResultsView";
import { PLACE_RESULTS_COPY } from "@/features/places/domain/place-results-copy";
import { AddToDashboardPanel } from "@/features/dashboards/presentation/AddToDashboardPanel";

type Tab = "sheet" | "place" | "charts" | "finance" | "import";

export function DataCenter({ projectId, sheet, canEdit, canEditReports, canReopenReports = false }: { projectId: string; sheet: DataSheetResponse; canEdit: boolean; canEditReports: boolean; canReopenReports?: boolean }) {
  const [tab, setTab] = useState<Tab>("sheet");
  const tabs: Array<[Tab, string]> = [
    ["sheet", "Indicator data"],
    ["place", PLACE_RESULTS_COPY.tab],
    ["charts", "Quick chart"],
    ...(sheet.financeEnabled ? ([["finance", "Finance"]] as Array<[Tab, string]>) : []),
    ...(canEdit ? ([["import", "Import / export"]] as Array<[Tab, string]>) : []),
  ];
  return (
    <div className="animate-fade-in">
      <header>
        <h2 className="section-title text-lg">Data Center</h2>
        <p className="mt-1 text-sm text-slate-500">Every indicator value{sheet.financeEnabled ? " and finance figure" : ""} of this project, across all reporting periods, in one place. Chart any combination of them.</p>
      </header>
      <div className="mt-4 flex gap-1 border-b border-slate-200 dark:border-white/10" role="tablist" aria-label="Data Center sections">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab === id ? "border-brand-700 text-slate-950 dark:border-brand-300 dark:text-white" : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="mt-5">
        {tab === "sheet" && <DataSheetTable projectId={projectId} sheet={sheet} canEdit={canEdit} />}
        {tab === "place" && <PlaceResultsView projectId={projectId} />}
        {tab === "charts" && (
          <>
          {/* Plan F23: one place to design charts. This quick chart stays because it is the one that goes into a report section;
              every other chart is made in the Chart Studio. */}
          <p className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-2.5 text-sm text-slate-600 dark:bg-white/[0.04] dark:text-slate-300">
            <span>A quick chart for a report section or a dashboard. For every chart type and style, use the Chart Studio.</span>
            <a className="link-arrow" href={`/visuals/charts/${projectId}`}>Open the Chart Studio</a>
          </p>
          <DataChartBuilder
            sheet={sheet}
            footer={({ spec, result }) => (
              <>
              <AddToDashboardPanel projectId={projectId} spec={spec} {...(result.ok ? {} : { disabledReason: "This chart cannot be drawn yet, so it cannot be added." })} />
              <AddToReportPanel projectId={projectId} sheet={sheet} spec={spec} canAdd={canEditReports} canReopen={canReopenReports} {...(result.ok ? {} : { disabledReason: "This chart cannot be drawn yet, so it cannot be added." })} />
              </>
            )}
          />
          </>
        )}
        {tab === "finance" && <FinanceSheetTable projectId={projectId} sheet={sheet} />}
        {tab === "import" && (
          <div className="space-y-4">
            <section className="card">
              <h3 className="font-medium">Export</h3>
              <p className="mt-1 text-sm text-slate-500">The Excel file has the full list (one row per indicator per period, empty where nothing is recorded), a grid for each measure{sheet.financeEnabled ? " and the finance figures" : ""}.</p>
              <a className="btn-secondary mt-3 inline-flex" href={`/api/projects/${projectId}/data-sheet/export`}>Download Excel (.xlsx)</a>
            </section>
            <DataSheetImport projectId={projectId} />
          </div>
        )}
      </div>
    </div>
  );
}
