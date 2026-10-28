"use client";

import { useRouter } from "next/navigation";
import { removeBookmarkAction } from "@/lib/actions/bookmarks";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";

export function RemoveBookmarkButton({ id, title }: { id: string; title: string }) {
  const { t } = useI18n();
  const router = useRouter();
  return (
    <button type="button" aria-label={t("bookmarks.removeNamed", { name: title })} className="px-1 text-slate-400 hover:text-danger-600"
      onClick={async () => { const r = await removeBookmarkAction(id); if (r.ok) router.refresh(); }}>×</button>
  );
}
