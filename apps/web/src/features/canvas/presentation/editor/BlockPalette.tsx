"use client";

import { BLOCK_FAMILIES, BLOCK_KINDS, definitionFor, type BlockFamily } from "@donordesk/domain/contexts/canvas/index.js";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { blockLabelKey, familyLabelKey } from "../../domain/canvas-copy";

/** Every kind of block, grouped, each one click to add. Names come from the four-language catalogue. */
export function BlockPalette({ onAdd }: { onAdd: (kind: string) => void }) {
  const { t } = useI18n();
  const byFamily = (family: BlockFamily) => BLOCK_KINDS.filter((k) => definitionFor(k)?.family === family);
  return (
    <nav aria-label="Add a block" className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700" data-testid="palette">
      <h3 className="text-sm font-semibold">Add a block</h3>
      {BLOCK_FAMILIES.map((family) => {
        const kinds = byFamily(family);
        if (kinds.length === 0) return null;
        return (
          <section key={family} aria-label={t(familyLabelKey(family))}>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t(familyLabelKey(family))}</h4>
            <div className="flex flex-wrap gap-1">
              {kinds.map((kind) => <button key={kind} type="button" data-kind={kind} onClick={() => onAdd(kind)} className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800">{t(blockLabelKey(kind))}</button>)}
            </div>
          </section>
        );
      })}
    </nav>
  );
}
