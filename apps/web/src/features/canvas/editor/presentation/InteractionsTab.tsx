"use client";

import { canHighlight, effectOf, INTERACTION_EFFECTS, type BlockInstance, type Canvas, type InteractionEffect } from "@donordesk/domain/contexts/canvas/index.js";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";

interface Props { canvas: Canvas; source: BlockInstance; others: readonly BlockInstance[]; label: (b: BlockInstance) => string; onSet: (targetId: string, effect: InteractionEffect) => void }

/** The Interactions tab (Phase 50.4, Power BI's "edit interactions"): for each other block on the page, what a click in this one does to it. */
export function InteractionsTab({ canvas, source, others, label, onSet }: Props) {
  const { t } = useI18n();
  if (others.length === 0) return <p className="text-sm text-slate-500">{t("inter.none")}</p>;
  return (
    <div className="space-y-2" data-testid="interactions-tab">
      <p className="text-xs text-slate-500">{t("inter.intro")}</p>
      <ul className="space-y-1">
        {others.map((b) => {
          const now = effectOf(canvas, source.id, b.id);
          const highlight = canHighlight(b.kind, b.props);
          return (
            <li key={b.id} className="flex flex-wrap items-center gap-2 rounded bg-slate-50 px-2 py-1.5 dark:bg-slate-800">
              <span className="min-w-0 flex-1 truncate text-sm">{label(b)}</span>
              <div role="radiogroup" aria-label={label(b)} className="flex gap-1">
                {INTERACTION_EFFECTS.filter((e) => e !== "HIGHLIGHT" || highlight).map((e) => (
                  <button key={e} type="button" role="radio" aria-checked={now === e} data-effect={e} onClick={() => onSet(b.id, e)}
                    className={`min-h-8 rounded px-2 text-xs ${now === e ? "bg-sky-700 text-white" : "border border-slate-300 hover:bg-white dark:border-slate-600 dark:hover:bg-slate-700"}`}>{t(`inter.${e}` as never)}</button>
                ))}
              </div>
              {!highlight && <span className="w-full text-[11px] text-slate-500">{t("inter.cannotHighlight")}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
