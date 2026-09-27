"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";

/**
 * Shown in the document area before a draft exists: what the AI will write
 * from, what is missing, and one Generate button.
 */
export function GenerateLaunchCard({
  indicatorCount,
  unverifiedIndicatorCount,
  storyAnswered,
  indicatorsHref,
  canGenerate,
  starting,
  onGenerate,
  onOpenStory,
}: {
  indicatorCount: number;
  unverifiedIndicatorCount: number;
  storyAnswered: number;
  indicatorsHref: string;
  canGenerate: boolean;
  starting: boolean;
  onGenerate: () => void;
  onOpenStory: () => void;
}) {
  const verified = Math.max(0, indicatorCount - unverifiedIndicatorCount);
  const rows: Array<{ label: string; value: string; ok: boolean; gap?: string; action: React.ReactNode }> = [
    {
      label: "Indicator values",
      value: indicatorCount === 0 ? "None entered" : `${verified} of ${indicatorCount} verified`,
      ok: indicatorCount > 0 && unverifiedIndicatorCount === 0,
      gap: indicatorCount === 0 ? "Reports need this period's indicator figures." : unverifiedIndicatorCount > 0 ? "Unverified figures will be marked in the report." : undefined,
      action: (
        <Link href={indicatorsHref} className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
          {indicatorCount === 0 ? "Enter data" : "Review data"}
        </Link>
      ),
    },
    {
      label: "Story answers",
      value: `${storyAnswered} of 5 answered`,
      ok: storyAnswered > 0,
      gap: storyAnswered === 0 ? "Reports read better when you explain challenges and changes." : undefined,
      action: (
        <button type="button" onClick={onOpenStory} className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
          {storyAnswered === 0 ? "Answer now" : "Edit story"}
        </button>
      ),
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
            <span
              aria-hidden="true"
              className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${row.ok ? "bg-success-600" : "bg-warning-500"}`}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {row.label} <span className="font-normal text-slate-500 dark:text-slate-400">· {row.value}</span>
              </p>
              {row.gap && <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{row.gap}</p>}
            </div>
            {row.action}
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
