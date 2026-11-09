"use client";

import { ageOf } from "@donordesk/domain/contexts/visual-data/index.js";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";

const KEY = { seconds: "studio.live.updatedSeconds", minutes: "studio.live.updatedMinutes", hours: "studio.live.updatedHours", days: "studio.live.updatedDays" } as const;

/** "Updated 2 min ago" under a block; a frozen copy or a file passes no `asOf` and shows nothing. */
export function FreshnessStamp({ asOf, now }: { asOf: string | undefined; now: Date }) {
  const { t } = useI18n();
  if (!asOf) return null;
  const age = ageOf(asOf, now);
  return <p className="text-xs text-slate-500" data-testid="freshness">{t(KEY[age.unit], { value: age.value })}</p>;
}
