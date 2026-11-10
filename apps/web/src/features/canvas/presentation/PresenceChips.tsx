"use client";

import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { initialsOf, orderPeers, type Peer } from "../domain/presence";

/** A chip for each person also on this canvas, with a word for what they are doing (editing or looking); nothing about what they change. */
export function PresenceChips({ peers }: { peers: ReadonlyArray<Peer> }) {
  const { t } = useI18n();
  const ordered = orderPeers(peers);
  if (ordered.length === 0) return null;
  return (
    <ul aria-label={t("canvas.ui.presenceHere")} className="flex items-center gap-1 print:hidden" data-testid="presence">
      {ordered.slice(0, 5).map((p) => (
        <li key={p.userId} title={`${p.name} · ${p.editing ? t("canvas.ui.presenceEditing") : t("canvas.ui.presenceViewing")}`}
          className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold ${p.editing ? "border-amber-500 bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100" : "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"}`}>
          <span aria-hidden="true">{initialsOf(p.name)}</span>
          <span className="sr-only">{p.name}, {p.editing ? t("canvas.ui.presenceEditing") : t("canvas.ui.presenceViewing")}</span>
        </li>
      ))}
      {ordered.length > 5 && <li className="text-xs text-slate-500">+{ordered.length - 5}</li>}
    </ul>
  );
}
