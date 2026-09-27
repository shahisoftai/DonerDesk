"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";

/**
 * Shown in the document area before a draft exists (Report Editor U9): what
 * the AI will write from — indicator values, story answers, evidence — with
 * the gaps called out, links to fill them, and one Generate button.
 */
export function GenerateLaunchCard({
  indicatorCount,
  unverifiedIndicatorCount,
  storyAnswered,
  evidenceCount,
  inputsHref,
  canGenerate,
  starting,
  onGenerate,
}: {
  indicatorCount: number;
  unverifiedIndicatorCount: number;
  storyAnswered: number;
  evidenceCount: number;
  inputsHref: string;
  canGenerate: boolean;
  starting: boolean;
  onGenerate: () => void;
}) {
  const verified = Math.max(0, indicatorCount - unverifiedIndicatorCount);
  const rows: Array<{ label: string; value: string; ok: boolean; gap?: string; tab: string; action: string }> = [
    {
      label: "Indicator values",
      value: indicatorCount === 0 ? "None entered" : `${verified} of ${indicatorCount} verified`,
      ok: indicatorCount > 0 && unverifiedIndicatorCount === 0,
      gap: indicatorCount === 0 ? "Reports need this period's indicator figures." : unverifiedIndicatorCount > 0 ? "Unverified figures will be marked in the report." : undefined,
      tab: "indicators",
      action: indicatorCount === 0 ? "Enter data" : "Review data",
    },
    {
      label: "Story answers",
      value: `${storyAnswered} of 5 answered`,
      ok: storyAnswered > 0,
      gap: storyAnswered === 0 ? "Reports read better when you explain challenges and changes." : undefined,
      tab: "story",
      action: storyAnswered === 0 ? "Answer now" : "Edit story",
    },
    {
      label: "Evidence",
      value: `${evidenceCount} file${evidenceCount === 1 ? "" : "s"}`,
      ok: evidenceCount > 0,
      gap: evidenceCount === 0 ? "Without evidence the AI cannot back up what it writes." : undefined,
      tab: "import",
      action: evidenceCount === 0 ? "Add evidence" : "Add more",
    },
  ];

  return (
    <div className="mx-auto max-w-xl py-6">
      <h2 className="text-xl font-semibold">Ready to write this report</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        The AI writes each section from your indicator data, evidence and story, then checks every figure against the evidence.
      </p>
      <ul className="mt-5 divide-y divide-slate-200 rounded-xl border border-slate-200 dark:divide-white/10 dark:border-white/10">
        {rows.map((row) => (
          <li key={row.label} className="flex items-start gap-3 p-4">
            <span aria-hidden="true" className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${row.ok ? "bg-success-600" : "bg-warning-500"}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {row.label} <span className="font-normal text-slate-500 dark:text-slate-400">· {row.value}</span>
                <span className="sr-only">{row.ok ? " (ready)" : " (needs attention)"}</span>
              </p>
              {row.gap && <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{row.gap}</p>}
            </div>
            <Link href={`${inputsHref}?tab=${row.tab}`} className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
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
