"use client";

import type { SiteTableRow } from "../domain/table/map-table";
import { useMapText } from "./useMapText";

/** The sites map as a table: one row per place with what happens there and every open risk, so the dots are never the only way to read it. */
export function SitesTable({ rows }: { rows: readonly SiteTableRow[] }) {
  const { t } = useMapText();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-start text-sm" data-testid="sites-table">
        <caption className="pb-1 text-start text-xs text-slate-500">{t("maps.sites.caption")}</caption>
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-white/10">
            <th scope="col" className="py-1 pe-3 text-start font-medium">{t("maps.table.place")}</th>
            <th scope="col" className="py-1 pe-3 text-start font-medium">{t("maps.sites.where")}</th>
            <th scope="col" className="py-1 pe-3 text-start font-medium">{t("maps.sites.items")}</th>
            <th scope="col" className="py-1 text-start font-medium">{t("maps.sites.risks")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-slate-100 align-top dark:border-white/5">
              <th scope="row" className="py-1.5 pe-3 text-start font-medium">{row.name}</th>
              <td className="py-1.5 pe-3">{row.where}</td>
              <td className="py-1.5 pe-3"><ul>{row.items.map((i, k) => <li key={`${i.title}-${k}`}>{i.title} — {i.state}</li>)}</ul></td>
              <td className="py-1.5">{row.risks.length === 0 ? "" : <ul>{row.risks.map((r, k) => <li key={`${r}-${k}`}>{r}</li>)}</ul>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
