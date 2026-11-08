"use client";

import type { ReferenceStandard } from "@donordesk/domain";
import { referenceVerdict } from "@donordesk/domain/contexts/sector-library/reference-verdict.js";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";

/**
 * Beside an indicator's target in the entry screens: the reference standard its library entry carried, and whether the recorded
 * figure meets it. It is separate from the target's light and never replaces it; a missing figure is "Not compared", never a failure.
 */
export function ReferenceVerdictLine({ text, standard, value, unit }: { text: string; standard: ReferenceStandard; value: string | null | undefined; unit?: string | undefined }) {
  const { t } = useI18n();
  const verdict = referenceVerdict(standard, value ?? null, unit ?? null);
  const label = verdict.state === "NOT_JUDGED" ? t("lib.verdict.none") : t(`lib.verdict.${verdict.state}` as never);
  const tone = verdict.state === "MEETS" ? "text-emerald-700 dark:text-emerald-300" : verdict.state === "NOT_JUDGED" ? "text-slate-500 dark:text-slate-400" : "text-amber-700 dark:text-amber-300";
  return (
    <span className="mt-1 block text-[11px] text-slate-600 dark:text-slate-300" data-testid="reference-verdict" title={t("lib.referenceNote")}>
      {t("lib.reference", { text })} · <span className={`font-medium ${tone}`}>{label}</span>
    </span>
  );
}
