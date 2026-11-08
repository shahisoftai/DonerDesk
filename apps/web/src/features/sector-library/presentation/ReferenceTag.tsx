"use client";

import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import type { LibraryEntryView } from "../domain/library-dto";

/** The reference standard beside an indicator: a phrase to compare with, never the target. Says when its figure has not been checked against its source. */
export function ReferenceTag({ entry }: { entry: Pick<LibraryEntryView, "standardText" | "referenceStandard"> }) {
  const { t } = useI18n();
  if (!entry.standardText) return null;
  const verified = Boolean(entry.referenceStandard?.verified);
  return (
    <p className="text-xs text-slate-600 dark:text-slate-300" data-testid="reference-tag">
      <span className="font-medium">{t("lib.reference", { text: entry.standardText })}</span>
      {verified ? null : <span className="ms-1 text-amber-700 dark:text-amber-300">({t("lib.referenceUnverified")})</span>}
    </p>
  );
}
