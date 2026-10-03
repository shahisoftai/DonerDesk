"use client";

import Link from "next/link";
import type { ReportInputRow } from "../../application/report-inputs";

/**
 * What this report is written from (Report Editor P5): activities (activity /
 * situation reports), indicator values, story answers and evidence, each linking to its tab on the inputs page.
 * Replaces the input forms that used to live in the workspace.
 */
export function ReportInputsCard({ inputsHref, rows }: { inputsHref: string; rows: ReportInputRow[] }) {
  return (
    <section aria-labelledby="report-inputs-heading" className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
      <div className="flex items-baseline justify-between">
        <h2 id="report-inputs-heading" className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Report inputs
        </h2>
        <Link href={inputsHref} className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300">
          Edit
        </Link>
      </div>
      <ul className="mt-2 space-y-1.5">
        {rows.map((row) => (
          <li key={row.key}>
            <Link href={row.href} title={row.gap} className="flex items-center gap-2 rounded-md py-0.5 text-sm hover:text-brand-700 dark:hover:text-brand-300">
              <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${row.ok ? "bg-success-600" : "bg-warning-500"}`} />
              <span className="min-w-0 flex-1">{row.label}</span>
              <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{row.value}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
