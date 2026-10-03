"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import type { ReportInputRow } from "../../application/report-inputs";

/**
 * Shown in the document area before a draft exists (Report Editor U9): what
 * the AI will write from — indicator values, story answers, evidence — with
 * the gaps called out, links to fill them, and one Generate button.
 */
export function GenerateLaunchCard({
  rows,
  canGenerate,
  starting,
  onGenerate,
}: {
  rows: ReportInputRow[];
  canGenerate: boolean;
  starting: boolean;
  onGenerate: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl py-6">
      <h2 className="text-xl font-semibold">Ready to write this report</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        The AI writes each section from your report inputs, then checks every figure against the evidence.
      </p>
      <ul className="mt-5 divide-y divide-slate-200 rounded-xl border border-slate-200 dark:divide-white/10 dark:border-white/10">
        {rows.map((row) => (
          <li key={row.key} className="flex items-start gap-3 p-4">
            <span aria-hidden="true" className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${row.ok ? "bg-success-600" : "bg-warning-500"}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {row.label} <span className="font-normal text-slate-500 dark:text-slate-400">· {row.value}</span>
                <span className="sr-only">{row.ok ? " (ready)" : " (needs attention)"}</span>
              </p>
              {row.gap && <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{row.gap}</p>}
            </div>
            <Link href={row.href} className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
              {row.action}
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-6">
        {canGenerate ? (
          <Button onClick={onGenerate} pending={starting}>
            Generate report
          </Button>
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-300">Ask a report writer or programme manager to generate the draft.</p>
        )}
      </div>
    </div>
  );
}
