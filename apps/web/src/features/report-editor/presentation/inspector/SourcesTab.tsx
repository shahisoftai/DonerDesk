"use client";

import Link from "next/link";

export type SourceRef = { type: string; id: string; label?: string };

const KIND_LABEL: Record<string, string> = {
  evidence: "Evidence file",
  indicator: "Indicator",
  indicator_update: "Indicator value",
  activity: "Activity",
  activity_update: "Activity update",
  story: "Story answer",
};

function kindLabel(type: string): string {
  return KIND_LABEL[type.toLowerCase()] ?? "Source";
}

/** What the AI used to write this section, by name (never raw ids). */
export function SourcesTab({ projectId, sources }: { projectId: string; sources: SourceRef[] }) {
  if (sources.length === 0) {
    return <p className="text-sm text-slate-600 dark:text-slate-300">No sources are linked to this section.</p>;
  }
  return (
    <>
      <p className="text-sm text-slate-600 dark:text-slate-300">What the AI used to write this section.</p>
      <ul className="space-y-2">
        {sources.map((s) => {
          const label = s.label?.trim() || kindLabel(s.type);
          const isEvidence = s.type.toLowerCase() === "evidence";
          return (
            <li key={`${s.type}-${s.id}`} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 dark:border-white/10">
              <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                  <path d="M14 3v5h5" />
                </svg>
              </span>
              <div className="min-w-0">
                {isEvidence ? (
                  <Link href={`/projects/${projectId}/evidence/${s.id}`} className="break-words text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
                    {label}
                  </Link>
                ) : (
                  <p className="break-words text-sm font-medium">{label}</p>
                )}
                <p className="text-xs text-slate-500 dark:text-slate-400">{kindLabel(s.type)}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
