"use client";

import Link from "next/link";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { uiLabel } from "@/features/i18n/domain/ui-labels";

/**
 * Persistent link to the DonorDesk help center (Feature 22 Phase 4). This is
 * the support/documentation entry point — separate from the guided product
 * tour, which lives in the dashboard's "Setup and storage" section.
 */
export function AcademyHeaderButton() {
  const { t } = useI18n();
  return (
    <Link
      href="/support"
      className="hidden items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:border-brand-400 hover:text-brand-700 sm:flex dark:border-white/15 dark:text-slate-300"
    >
      {uiLabel("Academy", t)}
    </Link>
  );
}
