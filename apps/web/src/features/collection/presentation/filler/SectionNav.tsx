"use client";

import type { FillSection, SectionProgress } from "../../domain/filler-state";

/** The contents of a long form: each section with how much of it is answered and how many problems it holds. A section with problems says so in words, not only in colour. */
export function SectionNav({ sections, progress, current, onPick, t }: {
  sections: ReadonlyArray<FillSection>;
  progress: ReadonlyArray<SectionProgress>;
  current: number;
  onPick(index: number): void;
  t(key: string, params?: Record<string, string | number>): string;
}) {
  return (
    <nav aria-label={t("assess.section.contents")} className="max-h-[60vh] overflow-y-auto rounded-md border border-slate-200 p-2 dark:border-slate-700">
      <ol className="space-y-1">
        {sections.map((s, i) => {
          const p = progress[i]!;
          const done = p.asked > 0 && p.answered === p.asked;
          return (
            <li key={s.key}>
              <button type="button" aria-current={i === current ? "step" : undefined} onClick={() => onPick(i)}
                className={`flex min-h-[44px] w-full items-center justify-between gap-2 rounded px-2 py-1 text-start text-sm ${i === current ? "bg-brand-50 font-medium dark:bg-slate-800" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}>
                <span className="min-w-0 break-words">{s.title}</span>
                <span className="shrink-0 text-xs text-slate-500">
                  {p.problems > 0 ? <span className="text-danger-600">{t("assess.section.problems", { count: p.problems })}</span> : done ? t("assess.section.done") : t("assess.section.progress", { done: p.answered, total: p.asked })}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
