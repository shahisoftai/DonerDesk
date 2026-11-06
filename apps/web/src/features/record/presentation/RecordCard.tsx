"use client";

import type { Capability } from "@/lib/shared/capabilities";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { availableKinds, type RecordKind } from "../domain/record-kinds";
import { RecordIconSvg } from "./RecordIconSvg";
import { useRecordSheet } from "./RecordHost";

/** The three things a person records most, as big one-tap buttons on Today. A form is reached from the chooser, not from here. */
const QUICK: ReadonlyArray<RecordKind["key"]> = ["NUMBER", "ACTIVITY", "FILE"];

export function RecordCard({ capabilities }: { capabilities: readonly Capability[] }) {
  const { t } = useI18n();
  const record = useRecordSheet();
  const kinds = availableKinds({ has: (c) => capabilities.includes(c), hasForms: false }).filter((k) => QUICK.includes(k.key));
  if (kinds.length === 0) return null;
  return (
    <section aria-label={t("record.sheet.title")} className="card">
      <h2 className="mb-3 text-lg font-bold">{t("record.sheet.chooseWhat")}</h2>
      <div className="grid grid-cols-3 gap-3">
        {kinds.map((k) => (
          <button key={k.key} type="button" onClick={() => record.open({ kind: k.key })} className="flex min-h-[96px] flex-col items-center justify-center gap-2 rounded-2xl border border-brand-500/30 bg-brand-500/10 px-1 text-center text-sm font-semibold text-brand-900 transition hover:border-brand-500 dark:border-brand-400/20 dark:bg-brand-400/10 dark:text-brand-100">
            <RecordIconSvg icon={k.icon} size={28} />
            {t(k.labelKey)}
          </button>
        ))}
      </div>
    </section>
  );
}
