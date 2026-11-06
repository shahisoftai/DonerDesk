"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { summarise } from "@/features/offline/domain/outbox";
import { useOutbox } from "@/features/offline/presentation/OutboxProvider";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { useRecordSheet } from "@/features/record/presentation/RecordHost";
import { cn } from "@/components/ui/cn";

const icon = (d: string) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;

const TAB = "relative flex min-h-14 w-20 flex-col items-center justify-center gap-0.5 text-xs font-semibold";

/**
 * The phone's bottom bar (Phase 44): Today, a raised Record button, Waiting (with a count) and More. Only on a phone-sized screen and
 * only where the person's home is the field home. It tells the page that it is there, so a floating banner can sit above it.
 */
export function PhoneTabBar() {
  const { t } = useI18n();
  const pathname = usePathname();
  const record = useRecordSheet();
  const { entries } = useOutbox();
  const pending = summarise(entries).waiting + summarise(entries).needsAttention;

  useEffect(() => {
    document.documentElement.dataset.phoneBar = "1";
    return () => { delete document.documentElement.dataset.phoneBar; };
  }, []);

  const on = (href: string) => (href === "/dashboard" ? pathname === "/dashboard" : pathname === href || pathname.startsWith(`${href}/`));
  const tone = (active: boolean) => (active ? "text-brand-700 dark:text-brand-300" : "text-slate-600 dark:text-slate-300");

  return (
    <nav aria-label={t("record.nav.label")} className="fixed inset-x-0 bottom-0 z-40 flex h-[72px] items-center justify-around border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden dark:border-white/10 dark:bg-slate-900">
      <Link href="/dashboard" prefetch={false} aria-current={on("/dashboard") ? "page" : undefined} className={cn(TAB, tone(on("/dashboard")))}>
        {icon("M4 11 12 4l8 7v9h-5v-6H9v6H4z")}{t("record.nav.today")}
      </Link>
      <button type="button" aria-label={t("record.nav.record")} onClick={() => record.open()} className="-mt-7 grid h-[60px] w-[60px] place-items-center rounded-full border-4 border-slate-50 bg-brand-600 text-white shadow-lg dark:border-slate-900">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      </button>
      <Link href="/waiting" prefetch={false} aria-current={on("/waiting") ? "page" : undefined} className={cn(TAB, tone(on("/waiting")))}>
        {pending > 0 && <span className="absolute right-3 top-1 grid min-w-5 place-items-center rounded-full bg-brand-600 px-1 text-[11px] font-bold leading-5 text-white" aria-label={String(pending)}>{pending}</span>}
        {icon("M4 14v5h16v-5M12 4v10m0 0-4-4m4 4 4-4")}{t("record.nav.waiting")}
      </Link>
      <Link href="/more" prefetch={false} aria-current={on("/more") ? "page" : undefined} className={cn(TAB, tone(on("/more")))}>
        {icon("M4 7h16M4 12h16M4 17h16")}{t("record.nav.more")}
      </Link>
    </nav>
  );
}
