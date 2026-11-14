"use client";

import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import type { LibraryReviewStatus } from "@donordesk/domain";

const TONE: Record<LibraryReviewStatus, string> = {
  UNREVIEWED: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  IN_REVIEW: "bg-brand-100 text-brand-900 dark:bg-brand-900/40 dark:text-brand-100",
  REVIEWED: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100",
  DEPRECATED: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100",
};

/** The review state in words, never a colour alone. */
export function ReviewBadge({ status }: { status: LibraryReviewStatus }) {
  const { t } = useI18n();
  return <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${TONE[status]}`}>{t(`lib.review.${status}` as never)}</span>;
}
