"use client";

import type { FrameworkDocumentView } from "@/lib/server/schemas";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";

/** Draws a framework document and nothing else: the lens and the donor's words are already in the data. */
export function FrameworkTable({ document }: { document: FrameworkDocumentView }) {
  const { t } = useI18n();
  if (document.rows.length === 0) {
    return <p className="card text-sm text-slate-600 dark:text-slate-300">{t("framework.empty")}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <caption className="sr-only">{document.title}</caption>
        <thead>
          <tr>
            {document.columns.map((c) => <th key={c.key} scope="col" className="border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-white/10 dark:text-slate-300">{t(`framework.col.${c.key}`)}</th>)}
          </tr>
        </thead>
        <tbody>
          {document.rows.map((row, index) => (
            <tr key={index} className={row.kind === "RESULT" ? "bg-slate-50 font-medium dark:bg-white/5" : ""}>
              {document.columns.map((c) => {
                if (c.owner !== row.kind) return <td key={c.key} className="border-b border-slate-100 dark:border-white/5" />;
                const value = row.cells[c.key];
                const indent = row.kind === "RESULT" && c.key === "title" ? { paddingInlineStart: `${row.depth * 1.25 + 0.75}rem` } : undefined;
                return (
                  <td key={c.key} style={indent} className="border-b border-slate-100 px-3 py-2 align-top dark:border-white/5">
                    {value ?? <span aria-label={t("framework.notSet")} className="text-slate-400">—</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
