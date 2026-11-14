"use client";

import Link from "next/link";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import type { DatasetListItem, KitView } from "../domain/types";

/** The datasets a person can see (§4.1): name, rows, kit and anything waiting for a decision, with one way to bring in a new table. */
export function DatasetList({ datasets, kits, canCreate, projectId }: { datasets: DatasetListItem[]; kits: KitView[]; canCreate: boolean; projectId?: string | undefined }) {
  const { t } = useI18n();
  const newHref = `/visuals/datasets/new${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`;
  return (
    <div className="space-y-4" data-testid="dataset-list">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300">{t("ds.list.intro")}</p>
        {canCreate && <Link href={newHref} className="rounded bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800">{t("ds.list.new")}</Link>}
      </div>
      {datasets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm dark:border-slate-600">
          <p className="font-medium">{t("ds.list.empty")}</p>
          <p className="mt-1 text-slate-500">{t("ds.list.emptyHint")}</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {datasets.map((d) => (
            <li key={d.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <Link href={`/visuals/datasets/${d.id}`} className="font-medium hover:underline">{d.name}</Link>
              <p className="mt-1 text-xs text-slate-500">{t("ds.list.rows", { rows: d.rowCount.toLocaleString(), columns: d.columns })}{d.scope === "ORGANISATION" ? ` · ${t("ds.list.org")}` : ""}</p>
              <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
                {d.kitKey && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-brand-900 dark:bg-brand-950 dark:text-brand-100">{kits.find((k) => k.key === d.kitKey)?.title ?? d.kitKey}</span>}
                {d.pending > 0 && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-900">{t("ds.list.pending", { n: d.pending })}</span>}
                {d.restricted && <span className="rounded-full bg-red-50 px-2 py-0.5 text-red-900">{t("ds.restricted")}</span>}
                {d.connector && <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">{d.connector}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{t("ds.kits.title")}</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {kits.map((k) => (
            <li key={k.key} className="rounded border border-slate-200 p-3 text-sm dark:border-slate-700">
              <p className="font-medium">{k.title} <span className="text-xs font-normal text-amber-700">{k.reviewState === "UNREVIEWED" ? t("ds.kit.unreviewed") : ""}</span></p>
              <p className="text-xs text-slate-500">{k.description}</p>
              <a className="mt-1 inline-block text-xs underline" href={`/api/dataset-kits/${k.key}/template`}>{t("ds.kit.template", { kit: k.title })}</a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
