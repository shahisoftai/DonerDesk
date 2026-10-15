"use client";

import { useState } from "react";
import type { DataSheetResponse } from "@/lib/server/schemas";
import { DataSheetTable } from "./DataSheetTable";
import { FinanceSheetTable } from "./FinanceSheetTable";
import { DataChartBuilder } from "./DataChartBuilder";
import { AddToReportPanel } from "./AddToReportPanel";
import { DataSheetImport } from "./DataSheetImport";

type Tab = "sheet" | "charts" | "finance" | "import";

export function DataCenter({ projectId, sheet, canEdit, canEditReports }: { projectId: string; sheet: DataSheetResponse; canEdit: boolean; canEditReports: boolean }) {
  const [tab, setTab] = useState<Tab>("sheet");
  const tabs: Array<[Tab, string]> = [
    ["sheet", "Indicator data"],
    ["charts", "Charts"],
    ...(sheet.financeEnabled ? ([["finance", "Finance"]] as Array<[Tab, string]>) : []),
    ...(canEdit ? ([["import", "Import / export"]] as Array<[Tab, string]>) : []),
  ];
  return (
    <div className="animate-fade-in">
      <header>
        <h2 className="text-xl font-semibold tracking-tight">Data Center</h2>
        <p className="mt-1 text-sm text-slate-500">Every indicator value{sheet.financeEnabled ? " and finance figure" : ""} of this project, across all reporting periods, in one place. Chart any combination of them.</p>
      </header>
      <div className="mt-4 flex gap-1 border-b border-slate-200 dark:border-white/10" role="tablist" aria-label="Data Center sections">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab === id ? "border-brand-600 text-brand-700 dark:text-brand-300" : "border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-300"}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="mt-5">
        {tab === "sheet" && <DataSheetTable projectId={projectId} sheet={sheet} canEdit={canEdit} />}
        {tab === "charts" && (
          <DataChartBuilder
            sheet={sheet}
            footer={({ spec, result }) => (
              <AddToReportPanel projectId={projectId} sheet={sheet} spec={spec} canAdd={canEditReports} {...(result.ok ? {} : { disabledReason: "This chart cannot be drawn yet, so it cannot be added." })} />
            )}
          />
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
