import type { Metadata } from "next";
import Link from "next/link";
import { getTranslator } from "@/lib/server/locale";
import { LocaleSwitcher } from "@/features/i18n/presentation/LocaleSwitcher";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "More" };

const ROW = "flex min-h-[64px] items-center justify-between gap-3 border-b border-slate-200 px-1 py-3 text-base font-semibold dark:border-white/10";

/** The phone's fourth tab: the few things a field worker needs besides Today, Record and Waiting. Nothing else is listed on purpose. */
export default async function MorePage() {
  const { t } = await getTranslator();
  return (
    <div className="animate-fade-in max-w-xl">
      <h1 className="mb-2 text-2xl font-bold tracking-tight">{t("record.more.title")}</h1>
      <nav aria-label={t("record.more.title")}>
        {/* A plain anchor: only a document navigation is kept for offline opening. */}
        <a className={ROW} href="/field"><span><span className="block">{t("record.more.ready")}</span><span className="block text-sm font-normal text-slate-600 dark:text-slate-300">{t("record.more.readyHint")}</span></span><span aria-hidden="true">›</span></a>
        <Link className={ROW} href="/projects" prefetch={false}><span>{t("record.more.projects")}</span><span aria-hidden="true">›</span></Link>
        <Link className={ROW} href="/help" prefetch={false}><span>{t("record.more.help")}</span><span aria-hidden="true">›</span></Link>
        <div className={ROW}><span>{t("record.more.language")}</span><LocaleSwitcher /></div>
        <Link className={ROW} href="/logout" prefetch={false}><span>{t("record.more.signOut")}</span><span aria-hidden="true">›</span></Link>
      </nav>
    </div>
  );
}
