import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { getTranslator } from "@/lib/server/locale";
import { BookmarkListSchema } from "@/lib/server/schemas-bookmarks";
import { RemoveBookmarkButton } from "./RemoveBookmarkButton";

/** The person's bookmarks, on their Home. Hidden when they have none (the header star is how one is made). */
export async function BookmarksPanel() {
  const ctx = await requireSession();
  const [{ t }, r] = [await getTranslator(), await gatewayRequest("/v1/bookmarks", BookmarkListSchema, ctx.token)];
  if (!r.ok || r.value.bookmarks.length === 0) return null;
  return (
    <section aria-label={t("bookmarks.title")} className="min-w-0">
      <h2 className="text-sm font-medium">{t("bookmarks.title")}</h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {r.value.bookmarks.map((b) => (
          <li key={b.id} className="flex items-center gap-1 rounded-lg border border-slate-200/70 bg-white px-3 py-1.5 text-sm dark:border-white/10 dark:bg-white/[0.03]">
            <Link href={b.href} className="font-medium text-brand-700 hover:underline dark:text-brand-300">{b.title}</Link>
            <RemoveBookmarkButton id={b.id} title={b.title} />
          </li>
        ))}
      </ul>
    </section>
  );
}
