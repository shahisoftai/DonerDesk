"use client";

import Link from "next/link";
import type { DataSheetResponse } from "@/lib/server/schemas";
import { Badge } from "@/components/data/Badge";
import { Button } from "@/components/ui/Button";
import { FINANCE_SHEET_HEADERS, financeSheetRows, toCsv } from "@donordesk/domain/contexts/reporting/data-sheet.js";
import { downloadTextFile } from "./download";

const th = "whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500";

const money = (v: string): string => {
  const n = Number.parseFloat(v.replace(/,/g, ""));
  return Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : v;
};

export function FinanceSheetTable({ projectId, sheet }: { projectId: string; sheet: DataSheetResponse }) {
  const periods = new Map(sheet.periods.map((p) => [p.id, p]));
  if (sheet.finance.length === 0) {
    return <p className="card text-sm text-slate-500">No finance figures are recorded yet. They are entered per reporting period, on its Inputs page.</p>;
  }
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">Expenditure is to date. Figures marked “Not verified” have not been checked and do not reach a report writer.</p>
        <Button variant="secondary" size="sm" onClick={() => downloadTextFile("finance-by-period.csv", toCsv([[...FINANCE_SHEET_HEADERS], ...financeSheetRows(sheet)]))}>Download CSV</Button>
      </div>
      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-white/5">
            <tr>
              <th className={th}>Period</th>
              <th className={th}>Currency</th>
              <th className={`${th} text-right`}>Budget</th>
              <th className={`${th} text-right`}>Expenditure</th>
              <th className={`${th} text-right`}>Committed</th>
              <th className={`${th} text-right`}>Balance</th>
              <th className={`${th} text-right`}>Burn rate</th>
              <th className={th}>Status</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {sheet.finance.map((f) => {
              const p = periods.get(f.periodId);
              return (
                <tr key={f.periodId}>
                  <td className="whitespace-nowrap px-3 py-2">{p?.label ?? ""}</td>
                  <td className="px-3 py-2">{f.currency}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(f.budget)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(f.expenditure)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{f.committed ? money(f.committed) : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(f.balance)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{f.burnRatePercent ? `${f.burnRatePercent}%` : "—"}</td>
                  <td className="px-3 py-2"><Badge tone={f.verified ? "success" : "warning"}>{f.verified ? "Verified" : "Not verified"}</Badge></td>
                  <td className="px-3 py-2">{p && !p.locked ? <Link className="text-xs text-brand-600 hover:underline" href={`/projects/${projectId}/reports/${p.id}/inputs?tab=finance`}>Edit</Link> : null}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
