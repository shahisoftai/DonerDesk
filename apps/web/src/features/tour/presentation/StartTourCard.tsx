"use client";

import { useStartOrResumeTour } from "./useStartOrResumeTour";
import { tourChrome } from "../domain/tour-copy";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";

/**
 * Product-tour tile for the dashboard's "Setup and storage" section
 * (Feature 22), styled to match its sibling "Workspace setup" / "Evidence
 * storage" link tiles. Creates (or reuses) the tenant's demo project, then
 * starts the tour and navigates to it.
 */
export function StartTourCard({ hasExistingDemoProject = false }: { hasExistingDemoProject?: boolean }) {
  const { startOrResumeTour, pending, error } = useStartOrResumeTour();
  const chrome = tourChrome(useI18n().locale);

  return (
    <button
      type="button"
      onClick={startOrResumeTour}
      disabled={pending}
      data-tour-id="start-tour-card"
      className="rounded-lg border border-slate-200/70 bg-white p-4 text-left transition hover:border-brand-400/40 disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.03]"
    >
      <div className="text-sm font-medium">
        {pending ? chrome.settingUp : hasExistingDemoProject ? chrome.resumeTitle : chrome.startTitle}
      </div>
      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {error ?? (hasExistingDemoProject ? chrome.resumeLine : chrome.startLine)}
      </div>
    </button>
  );
}
