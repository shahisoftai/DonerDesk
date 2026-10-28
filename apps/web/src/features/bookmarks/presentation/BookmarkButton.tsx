"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { addBookmarkAction, listBookmarksAction, removeBookmarkAction } from "@/lib/actions/bookmarks";
import type { BookmarkView } from "@/lib/server/schemas-bookmarks";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";

/** Adds or removes a bookmark for the page being viewed. The list is read once; the page's own address is the key. */
export function BookmarkButton() {
  const { t } = useI18n();
  const path = usePathname() ?? "";
  const query = useSearchParams()?.toString() ?? "";
  const href = query ? `${path}?${query}` : path;
  const [list, setList] = useState<BookmarkView[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void listBookmarksAction().then((r) => { if (alive && r.ok) setList(r.value); });
    return () => { alive = false; };
  }, []);

  if (list === null || path === "/dashboard" || path === "") return null;
  const saved = list.find((b) => b.href === href);

  async function toggle() {
    setBusy(true); setNote(null);
    if (saved) {
      const r = await removeBookmarkAction(saved.id);
      if (r.ok) setList((l) => (l ?? []).filter((b) => b.id !== saved.id)); else setNote(t("bookmarks.failed"));
    } else {
      const title = (typeof document !== "undefined" ? document.title : "").split("|")[0]?.trim() || path;
      const r = await addBookmarkAction({ title, href });
      if (r.ok) setList((l) => [...(l ?? []), r.value]); else setNote(r.error.message || t("bookmarks.failed"));
    }
    setBusy(false);
  }

  return (
    <>
      <button type="button" onClick={toggle} disabled={busy} aria-pressed={!!saved} title={saved ? t("bookmarks.remove") : t("bookmarks.add")}
        className="hidden h-10 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-600 hover:border-brand-400 sm:flex dark:border-white/15 dark:bg-white/5 dark:text-slate-300">
        <span aria-hidden="true">{saved ? "★" : "☆"}</span> {saved ? t("bookmarks.saved") : t("bookmarks.add")}
      </button>
      {note && <span role="status" className="sr-only">{note}</span>}
    </>
  );
}
