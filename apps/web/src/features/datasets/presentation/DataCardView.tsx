"use client";

import type { VisualTable } from "@donordesk/domain/contexts/visual-data/index.js";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";

/** Headline figures of a dataset (one row): each figure with its name. A gap reads "Not reported", never 0. */
export function DataCardView({ table }: { table: VisualTable }) {
  const { t } = useI18n();
  const row = table.rows[0] ?? {};
  const figures = table.columns.filter((c) => c.role !== "DIMENSION");
  return (
    <div className="flex h-full flex-wrap items-center gap-4">
      {figures.map((c) => {
        const v = row[c.id];
        return (
          <div key={c.id} className="min-w-24">
            <p className="text-2xl font-semibold tabular-nums">{typeof v === "number" ? `${v.toLocaleString(undefined, { maximumFractionDigits: 1 })}${c.type === "RATE" ? " %" : ""}` : <span className="text-base font-normal text-slate-400">{t("ds.notReported")}</span>}</p>
            <p className="text-xs text-slate-500">{c.label}</p>
          </div>
        );
      })}
    </div>
  );
}
