"use client";

import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import type { LibraryEntryView } from "../domain/library-dto";
import { canSelect } from "../domain/picker-state";
import { ReferenceTag } from "./ReferenceTag";
import { ReviewBadge } from "./ReviewBadge";

/** One indicator in the picker: a checkbox, its name, what it counts, and the words that say what kind it is and how far to trust it. */
export function EntryRow({ entry, selected, onToggle }: { entry: LibraryEntryView; selected: boolean; onToggle: () => void }) {
  const { t } = useI18n();
  const disabled = !canSelect(entry);
  return (
    <li className={`flex gap-3 border-t border-slate-200 py-2 dark:border-slate-700 ${disabled ? "opacity-60" : ""}`} data-testid={`library-entry-${entry.id}`}>
      <input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={selected} disabled={disabled} onChange={onToggle} aria-label={entry.name} />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
          <span className="me-2 font-mono text-xs text-slate-500 dark:text-slate-400">{entry.id}</span>
          {entry.name}
        </p>
        <p className="text-xs text-slate-600 dark:text-slate-300">{entry.definition}</p>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-700 dark:text-slate-200">
          <span className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">{t(`lib.kind.${entry.kind}` as never)}</span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">{t(`lib.level.${entry.level}` as never)}</span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">{entry.unit}</span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">{t(`lib.direction.${entry.direction}` as never)}</span>
          <ReviewBadge status={entry.review.status} />
          {entry.adopted ? <span className="rounded bg-brand-100 px-1.5 py-0.5 font-medium text-brand-900 dark:bg-brand-900/40 dark:text-brand-100">{t("lib.adopted")}</span> : null}
          {entry.origin === "ORGANISATION" ? <span className="rounded bg-violet-100 px-1.5 py-0.5 text-violet-900 dark:bg-violet-900/40 dark:text-violet-100">{t("lib.fromOrg")}</span> : null}
          {entry.reworded ? <span className="rounded bg-violet-100 px-1.5 py-0.5 text-violet-900 dark:bg-violet-900/40 dark:text-violet-100">{t("lib.reworded")}</span> : null}
        </div>
        <ReferenceTag entry={entry} />
      </div>
    </li>
  );
}
