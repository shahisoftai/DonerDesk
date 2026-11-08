"use client";

import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import type { LibrarySectorId } from "@donordesk/domain";
import type { SectorSummary } from "../domain/library-dto";

const GROUP_ORDER: SectorSummary["group"][] = ["HUMANITARIAN", "DEVELOPMENT", "ATTACHED"];

/** The sectors with how many indicators each offers; any number can be ticked. */
export function SectorList({ sectors, chosen, onToggle }: { sectors: readonly SectorSummary[]; chosen: readonly LibrarySectorId[]; onToggle: (id: LibrarySectorId) => void }) {
  const { t } = useI18n();
  return (
    <nav aria-label={t("lib.sectors")} className="space-y-3 text-sm">
      {GROUP_ORDER.map((group) => {
        const rows = sectors.filter((s) => s.group === group);
        if (rows.length === 0) return null;
        return (
          <div key={group}>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t(`lib.group.${group}` as never)}</p>
            <ul className="space-y-0.5">
              {rows.map((s) => (
                <li key={s.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-slate-100 dark:hover:bg-slate-800">
                    <input type="checkbox" checked={chosen.includes(s.id)} onChange={() => onToggle(s.id)} data-testid={`library-sector-${s.id}`} />
                    <span className="flex-1">{s.label}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{s.count}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
