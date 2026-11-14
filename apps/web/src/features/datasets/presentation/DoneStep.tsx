"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { getDatasetAction, makeKitDashboardsAction } from "@/lib/actions/datasets";
import { createCanvasAction } from "@/lib/actions/canvas";
import { starterCanvas } from "../domain/starter-canvas";
import type { KitView } from "../domain/types";

/** Screen 7: what next. Make dashboards from the kit, build a chart, or use the figures for indicators. */
export function DoneStep({ datasetId, summary, kitKey, kits, refreshed }: { datasetId: string; summary: string; kitKey: string | undefined; kits: KitView[]; refreshed: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const kit = kits.find((k) => k.key === kitKey);
  async function make(): Promise<void> {
    setBusy(true); setError(null);
    const r = await makeKitDashboardsAction(datasetId, kitKey ? { kitKey } : {});
    setBusy(false);
    if (!r.ok) { setError(r.error.message); return; }
    router.push(`/visuals/${r.value.canvasId}${r.value.skipped.length ? `?notice=${encodeURIComponent(r.value.skipped.slice(0, 3).join(" "))}` : ""}`);
  }
  async function chart(): Promise<void> {
    setBusy(true); setError(null);
    const d = await getDatasetAction(datasetId);
    if (!d.ok || !d.value.current) { setBusy(false); setError(d.ok ? t("ds.done.noRows") : d.error.message); return; }
    const r = await createCanvasAction(starterCanvas(datasetId, d.value.name, d.value.current.columns, d.value.scope === "ORGANISATION" ? "ORGANISATION" : "PROJECT", d.value.projectId));
    setBusy(false);
    if (r.ok) router.push(`/visuals/${r.value.id}`); else setError(r.error.message);
  }
  return (
    <div className="space-y-4" data-testid="dataset-done">
      <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">{refreshed ? t("ds.done.refreshed", { summary }) : t("ds.done.saved", { summary })}</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {kit && <button type="button" disabled={busy} className="rounded bg-sky-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60" onClick={() => void make()} data-testid="make-kit-dashboards">{busy ? t("ds.done.making") : t("ds.done.kit", { kit: kit.title })}</button>}
        <button type="button" disabled={busy} onClick={() => void chart()} className="rounded border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600" data-testid="build-chart">{t("ds.done.chart")}</button>
        <Link href={`/visuals/datasets/${datasetId}?tab=links`} className="rounded border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600">{t("ds.done.indicators")}</Link>
        <Link href={`/visuals/datasets/${datasetId}`} className="px-3 py-1.5 text-sm underline">{t("ds.done.open")}</Link>
      </div>
    </div>
  );
}
