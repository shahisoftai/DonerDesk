"use client";

import { respondsTo, type BlockInstance, type BlockModel } from "@donordesk/domain/contexts/canvas/index.js";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";

interface Props { block: BlockInstance; model: BlockModel<unknown> | undefined; table: { headers: string[]; rows: string[][] } | undefined; projectName: string | undefined }

/**
 * The Data tab (Phase 50.1): which project the block reads, which filters change it, and the figures it shows right now (the same
 * table "View data" shows). It reads; nothing here changes the block.
 */
export function DataTab({ block, model, table, projectName }: Props) {
  const { t } = useI18n();
  const follows = respondsTo(block);
  return (
    <div className="space-y-4 text-sm" data-testid="data-tab">
      <section><h3 className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">{t("data.source")}</h3><p>{projectName ?? t("data.noProject")}</p></section>
      <section><h3 className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">{t("data.follows")}</h3>
        {follows.length === 0 ? <p className="text-slate-500">{t("data.followsNone")}</p> : <ul className="flex flex-wrap gap-1">{follows.map((d) => <li key={d} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">{t(`filter.${d}` as never)}</li>)}</ul>}
      </section>
      <section><h3 className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">{t("data.preview")}</h3>
        {table && table.rows.length > 0 ? (
          <div className="max-h-64 overflow-auto rounded border border-slate-200 dark:border-slate-700">
            <table className="w-full text-xs"><thead className="sticky top-0 bg-slate-50 dark:bg-slate-800"><tr>{table.headers.map((h, i) => <th key={i} scope="col" className="px-2 py-1 text-start font-medium">{h}</th>)}</tr></thead>
              <tbody>{table.rows.slice(0, 50).map((r, i) => <tr key={i} className="border-t border-slate-100 dark:border-slate-800">{r.map((c, j) => <td key={j} className="px-2 py-1 tabular-nums">{c === "" ? t("card.notReported") : c}</td>)}</tr>)}</tbody></table>
          </div>
        ) : model && model.state !== "ready" ? <p className="text-slate-500">{model.reason}</p> : <p className="text-slate-500">{t("data.previewEmpty")}</p>}
        {model?.state === "ready" && model.notes.length > 0 && <ul className="mt-1 text-xs text-amber-800 dark:text-amber-200">{model.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
      </section>
    </div>
  );
}
