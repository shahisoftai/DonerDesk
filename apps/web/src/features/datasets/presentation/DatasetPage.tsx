"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { createCanvasAction } from "@/lib/actions/canvas";
import { deleteDatasetAction, makeKitDashboardsAction } from "@/lib/actions/datasets";
import { starterCanvas } from "../domain/starter-canvas";
import type { DatasetDetail, KitView } from "../domain/types";
import { DatasetOverview } from "./DatasetOverview";
import { DatasetVersions } from "./DatasetVersions";
import { DatasetLinks } from "./DatasetLinks";
import { DatasetSharing } from "./DatasetSharing";
import { DatasetConnector } from "./DatasetConnector";

const TABS = ["overview", "versions", "links", "sharing", "connector"] as const;
type Tab = (typeof TABS)[number];

/** One dataset (§4.1): its columns and figures, versions and refresh, indicator links, sharing and connector, and the ways to use it. */
export function DatasetPage({ dataset, kits, indicators, isAdmin, initialTab }: { dataset: DatasetDetail; kits: KitView[]; indicators: Array<{ id: string; code: string; name: string; type: string }>; isAdmin: boolean; initialTab?: string | undefined }) {
  const { t } = useI18n();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(TABS.includes(initialTab as Tab) ? (initialTab as Tab) : "overview");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const kit = kits.find((k) => k.key === dataset.kitKey);
  const refresh = () => router.refresh();
  async function dashboards(kitKey: string): Promise<void> {
    setBusy("kit");
    const r = await makeKitDashboardsAction(dataset.id, { kitKey });
    setBusy(null);
    if (!r.ok) { setNotice({ ok: false, text: r.error.message }); return; }
    router.push(`/visuals/${r.value.canvasId}${r.value.skipped.length ? `?notice=${encodeURIComponent(r.value.skipped.slice(0, 3).join(" "))}` : ""}`);
  }
  async function chart(): Promise<void> {
    if (!dataset.current) return;
    setBusy("chart");
    const r = await createCanvasAction(starterCanvas(dataset.id, dataset.name, dataset.current.columns, dataset.scope === "ORGANISATION" ? "ORGANISATION" : "PROJECT", dataset.projectId));
    setBusy(null);
    if (r.ok) router.push(`/visuals/${r.value.id}`); else setNotice({ ok: false, text: r.error.message });
  }
  async function remove(): Promise<void> {
    if (!window.confirm(t("ds.page.deleteConfirm", { name: dataset.name }))) return;
    const r = await deleteDatasetAction(dataset.id);
    if (r.ok) router.push("/visuals/datasets"); else setNotice({ ok: false, text: r.error.message });
  }
  return (
    <div className="space-y-4" data-testid="dataset-page">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{dataset.name}</h2>
          <p className="text-sm text-slate-500">{t("ds.list.rows", { rows: (dataset.current?.rowCount ?? 0).toLocaleString(), columns: dataset.columnCount })}{dataset.current ? ` · ${t("ds.page.version", { n: dataset.current.number })}` : ""}</p>
          {dataset.restricted && <p className="mt-1 rounded bg-red-50 px-2 py-1 text-sm text-red-900">{t("ds.page.restrictedBanner")}</p>}
          {kit && <p className="mt-1 text-xs text-slate-500">{kit.title}: {kit.reviewState === "UNREVIEWED" ? t("ds.kit.unreviewedLong", { source: kit.source }) : kit.source}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {kit && <button type="button" disabled={busy !== null} className="rounded bg-brand-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60" onClick={() => void dashboards(kit.key)} data-testid="make-kit-dashboards">{busy === "kit" ? t("ds.done.making") : t("ds.done.kit", { kit: kit.title })}</button>}
          {!kit && kits.length > 0 && dataset.current && (
            <select aria-label={t("ds.page.kitPick")} className="rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900" value="" onChange={(e) => e.target.value && void dashboards(e.target.value)}>
              <option value="">{t("ds.page.kitPick")}</option>{kits.map((k) => <option key={k.key} value={k.key}>{k.title}</option>)}
            </select>
          )}
          <button type="button" disabled={busy !== null || !dataset.current} className="rounded border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600" onClick={() => void chart()}>{t("ds.done.chart")}</button>
          <Link href={`/visuals/datasets/new?refresh=${dataset.id}`} className="rounded border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600" data-testid="refresh-dataset">{t("ds.page.addData")}</Link>
          {dataset.canManage && <button type="button" className="px-2 text-sm text-red-700 underline" onClick={() => void remove()}>{t("ds.page.delete")}</button>}
        </div>
      </div>
      {notice && <p role={notice.ok ? "status" : "alert"} className={`rounded px-3 py-2 text-sm ${notice.ok ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900"}`}>{notice.text}</p>}
      <nav role="tablist" className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-700">
        {TABS.filter((x) => x !== "connector" || dataset.canManage).map((x) => <button key={x} type="button" role="tab" aria-selected={tab === x} onClick={() => setTab(x)} className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === x ? "border-brand-700 font-medium" : "border-transparent text-slate-500"}`}>{t(`ds.tab.${x}`)}{x === "versions" && dataset.pending > 0 ? ` (${dataset.pending})` : ""}</button>)}
      </nav>
      {tab === "overview" && <DatasetOverview dataset={dataset} />}
      {tab === "versions" && <DatasetVersions dataset={dataset} onChanged={refresh} />}
      {tab === "links" && <DatasetLinks dataset={dataset} indicators={indicators} onChanged={refresh} />}
      {tab === "sharing" && <DatasetSharing dataset={dataset} isAdmin={isAdmin} onChanged={refresh} />}
      {tab === "connector" && <DatasetConnector dataset={dataset} onChanged={refresh} />}
    </div>
  );
}
