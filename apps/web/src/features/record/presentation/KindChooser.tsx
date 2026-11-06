"use client";

import type { RecordKind, RecordKindKey } from "../domain/record-kinds";
import { RecordIconSvg } from "./RecordIconSvg";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";

/** The kinds a person may record, as big buttons. Plain words; the one used last carries a small "Last time" label. */
export function KindChooser({ kinds, last, onChoose }: { kinds: readonly RecordKind[]; last?: RecordKindKey | undefined; onChoose: (kind: RecordKind) => void }) {
  const { t } = useI18n();
  return (
    <ul className="-mx-4 divide-y divide-slate-200 dark:divide-white/10">
      {kinds.map((k) => (
        <li key={k.key}>
          <button type="button" onClick={() => onChoose(k)} className="flex min-h-[72px] w-full items-center gap-4 px-4 text-start transition hover:bg-slate-50 dark:hover:bg-white/5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-800 dark:bg-brand-400/10 dark:text-brand-200" aria-hidden="true">
              <RecordIconSvg icon={k.icon} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-bold">{t(k.labelKey)}</span>
              <span className="block text-sm text-slate-600 dark:text-slate-300">{t(k.hintKey)}</span>
            </span>
            {last === k.key && <span className="rounded-lg bg-brand-500/10 px-2 py-1 text-xs font-bold text-brand-800 dark:bg-brand-400/10 dark:text-brand-200">{t("record.sheet.lastTime")}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}
