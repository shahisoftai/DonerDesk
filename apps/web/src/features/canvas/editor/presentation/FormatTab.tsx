"use client";

import { useMemo, useState } from "react";
import { sharedCapabilities, type BlockFormat, type BlockInstance, type FormatCapability } from "@donordesk/domain/contexts/canvas/index.js";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { FORMAT_SECTIONS } from "../domain/format-sections";
import { matchSections } from "../domain/field-search";
import { SectionView } from "./SectionView";
import type { FormatContextProps } from "./FormatFieldWidget";

interface Props extends FormatContextProps { blocks: readonly BlockInstance[]; expandAll: boolean; onExpandAll: (v: boolean) => void; onSet: (capability: FormatCapability, settings: BlockFormat[FormatCapability] | undefined) => void }

/**
 * The Format tab (Phase 50.2): the sections every selected block offers, searchable, each one expanded or not. With several blocks
 * selected, a section shows the first block's settings and a change applies to all of them as one step.
 */
export function FormatTab({ blocks, expandAll, onExpandAll, onSet, ...ctx }: Props) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const caps = useMemo(() => sharedCapabilities(blocks), [blocks]);
  const sections = matchSections(caps.map((c) => FORMAT_SECTIONS[c]), query, (k) => t(k as never));
  const first = blocks[0];
  return (
    <div className="space-y-2" data-testid="format-tab">
      <div className="flex items-center gap-2">
        <input type="search" aria-label={t("drawer.searchFormat")} placeholder={t("drawer.searchFormat")} value={query} onChange={(e) => setQuery(e.target.value)} className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900" />
        <button type="button" className="whitespace-nowrap text-xs text-brand-700 underline" onClick={() => { onExpandAll(!expandAll); setOpen({}); }}>{expandAll ? t("drawer.collapseAll") : t("drawer.expandAll")}</button>
      </div>
      {blocks.length > 1 && <p className="text-xs text-slate-500">{t("drawer.sharedOnly")}</p>}
      {sections.length === 0 && <p className="text-sm text-slate-500">{t("drawer.noMatch")}</p>}
      {sections.map((s) => (
        <SectionView key={s.capability} section={s} settings={first?.format?.[s.capability]} open={query.trim() !== "" || (open[s.capability] ?? expandAll)} onToggle={(v) => setOpen((o) => ({ ...o, [s.capability]: v }))}
          onChange={(v) => onSet(s.capability, v as never)} {...ctx} />
      ))}
    </div>
  );
}
