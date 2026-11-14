"use client";

import { useMemo, useState } from "react";
import { BLOCK_FAMILIES, BLOCK_KINDS, definitionFor } from "@donordesk/domain/contexts/canvas/index.js";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { blockLabelKey, familyLabelKey } from "../../domain/canvas-copy";
import { STARTER_SETS } from "../domain/starters";

export const BLOCK_DRAG_TYPE = "application/x-donordesk-block";
const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

interface Props { recent: readonly string[]; onAdd: (kind: string) => void; onStarter: (id: string) => void }

/** The Add drawer's contents (Phase 50.1): search, recently used, starter sets, then every block by family. A block is added with a click or Enter, or dragged onto the canvas. */
export function AddDrawer({ recent, onAdd, onStarter }: Props) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const q = fold(query.trim());
  const matches = (kind: string) => !q || fold(t(blockLabelKey(kind as never))).includes(q) || kind.toLowerCase().includes(q);
  const groups = useMemo(() => BLOCK_FAMILIES.map((family) => ({ family, kinds: BLOCK_KINDS.filter((k) => definitionFor(k)?.family === family) })), []);
  const tile = (kind: string, keyPrefix = "") => (
    <li key={keyPrefix + kind}>
      <button type="button" draggable data-kind={kind} onClick={() => onAdd(kind)}
        onDragStart={(e) => { e.dataTransfer.setData(BLOCK_DRAG_TYPE, kind); e.dataTransfer.effectAllowed = "copy"; }}
        className="flex min-h-11 w-full items-center rounded border border-slate-200 px-2 py-1.5 text-start text-xs hover:border-brand-400 hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:hover:bg-slate-800">
        {t(blockLabelKey(kind as never))}
      </button>
    </li>
  );
  const shownGroups = groups.map((g) => ({ ...g, kinds: g.kinds.filter(matches) })).filter((g) => g.kinds.length > 0);
  const shownRecent = recent.filter(matches).slice(0, 6);
  return (
    <div className="space-y-4" data-testid="add-drawer">
      <input type="search" aria-label={t("drawer.searchBlocks")} placeholder={t("drawer.searchBlocks")} value={query} onChange={(e) => setQuery(e.target.value)} className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900" />
      <p className="text-xs text-slate-500">{t("drawer.dragHint")}</p>
      {shownRecent.length > 0 && <section aria-label={t("drawer.recent")}><h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("drawer.recent")}</h3><ul className="grid grid-cols-2 gap-1">{shownRecent.map((k) => tile(k, "r-"))}</ul></section>}
      {!q && (
        <section aria-label={t("drawer.starters")}>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("drawer.starters")}</h3>
          <ul className="grid grid-cols-1 gap-1">{STARTER_SETS.map((s) => <li key={s.id}><button type="button" data-starter={s.id} onClick={() => onStarter(s.id)} className="min-h-11 w-full rounded border border-dashed border-slate-300 px-2 py-1.5 text-start text-xs hover:border-brand-400 hover:bg-brand-50 dark:border-slate-600 dark:hover:bg-slate-800">{t(s.labelKey as never)}</button></li>)}</ul>
        </section>
      )}
      {shownGroups.map((g) => (
        <section key={g.family} aria-label={t(familyLabelKey(g.family))}>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t(familyLabelKey(g.family))}</h3>
          <ul className="grid grid-cols-2 gap-1">{g.kinds.map((k) => tile(k))}</ul>
        </section>
      ))}
      {shownGroups.length === 0 && shownRecent.length === 0 && <p className="text-sm text-slate-500">{t("drawer.noMatch")}</p>}
    </div>
  );
}
