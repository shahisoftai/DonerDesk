"use client";

import { useMemo, useState } from "react";
import { blocksInReadingOrder, definitionFor, type BlockInstance, type CanvasPage, type Selection } from "@donordesk/domain/contexts/canvas/index.js";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { blockLabelKey } from "../domain/canvas-copy";

interface Props {
  page: CanvasPage;
  selection: Selection;
  onSelect: (id: string, how: { shift?: boolean; mod?: boolean }) => void;
  onToggle: (id: string, flag: "locked" | "hidden") => void;
}

/** The page's blocks as a list in reading order, held blocks under their container: pick, search, lock and hide without touching the page. */
export function LayersPanel({ page, selection, onSelect, onToggle }: Props) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const name = (b: BlockInstance): string => {
    const title = (b.props as { title?: string; text?: string } | undefined)?.title ?? (b.props as { text?: string } | undefined)?.text;
    return `${t(blockLabelKey(b.kind as never))}${title ? `: ${String(title).slice(0, 40)}` : ""}`;
  };
  const rows = useMemo(() => {
    const top = blocksInReadingOrder(page.blocks.filter((b) => !b.container));
    return top.flatMap((b) => [{ b, depth: 0, parent: undefined as BlockInstance | undefined }, ...blocksInReadingOrder(page.blocks.filter((h) => h.container?.id === b.id)).map((h) => ({ b: h, depth: 1, parent: b }))]);
  }, [page.blocks]);
  const wanted = text.trim().toLowerCase();
  const shown = wanted ? rows.filter((r) => name(r.b).toLowerCase().includes(wanted)) : rows;
  const chosen = new Set(selection.ids);
  const BTN = "rounded px-1.5 py-0.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-800";

  return (
    <section aria-label={t("editor.layers.title")} className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700" data-testid="layers">
      <h3 className="text-sm font-semibold">{t("editor.layers.title")}</h3>
      <input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder={t("editor.layers.search")} aria-label={t("editor.layers.search")} className="w-full rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900" />
      {rows.length === 0 && <p className="text-xs text-slate-500">{t("editor.layers.empty")}</p>}
      <ul className="max-h-64 space-y-0.5 overflow-auto">
        {shown.map(({ b, depth, parent }) => (
          <li key={b.id} data-layer={b.id} className={`flex items-center justify-between gap-1 rounded ${chosen.has(b.id) ? "bg-brand-50 dark:bg-slate-800" : ""}`} style={{ paddingInlineStart: depth * 14 }}>
            <button type="button" aria-pressed={chosen.has(b.id)} onClick={(e) => onSelect(b.id, { shift: e.shiftKey, mod: e.ctrlKey || e.metaKey })} className={`min-w-0 flex-1 truncate px-1.5 py-1 text-start text-sm ${b.style?.hidden ? "opacity-50" : ""}`} title={parent ? t("editor.layers.inside", { name: name(parent) }) : undefined}>
              {name(b)}{definitionFor(b.kind) ? "" : " ?"}
            </button>
            <button type="button" className={BTN} aria-label={`${t("editor.layers.toggleLock")}: ${name(b)}`} aria-pressed={b.style?.locked === true} onClick={() => onToggle(b.id, "locked")} title={t("editor.layers.locked")}>{b.style?.locked ? "🔒" : "🔓"}</button>
            <button type="button" className={BTN} aria-label={`${t("editor.layers.toggleHide")}: ${name(b)}`} aria-pressed={b.style?.hidden === true} onClick={() => onToggle(b.id, "hidden")} title={t("editor.layers.hidden")}>{b.style?.hidden ? "◌" : "●"}</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
