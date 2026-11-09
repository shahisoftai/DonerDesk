"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { getVisualCatalogueAction } from "@/lib/actions/visual-data";
import type { CatalogueView } from "@/lib/server/schemas-visual-data";

export interface PickedField { source: string; field: string; role: "DIMENSION" | "MEASURE" }

/**
 * The Studio's Data panel: every source and field a visual can use, searchable by plain words. A field that no reader fills yet is
 * shown as "not available yet" and cannot be picked; a source the person's role cannot open says so. Picking a field hands it to the
 * canvas (drag or click); the panel decides nothing about the chart.
 */
export function DataPanel({ onPick }: { onPick: (field: PickedField) => void }) {
  const { t } = useI18n();
  const [catalogue, setCatalogue] = useState<CatalogueView | null>(null);
  const [text, setText] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      void getVisualCatalogueAction(text.trim() || undefined).then((r) => { if (!live) return; if (r.ok) { setCatalogue(r.value); setFailed(false); } else setFailed(true); });
    }, text ? 250 : 0);
    return () => { live = false; clearTimeout(timer); };
  }, [text]);

  const hits = useMemo(() => new Set((catalogue?.hits ?? []).map((h) => `${h.source}.${h.field}`)), [catalogue]);
  const searching = text.trim().length > 0;

  return (
    <section aria-label={t("studio.data.title")} className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700" data-testid="data-panel">
      <h3 className="text-sm font-semibold">{t("studio.data.title")}</h3>
      <input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder={t("studio.data.search")} aria-label={t("studio.data.search")} className="w-full rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900" />
      {failed && <p role="status" className="text-xs text-slate-500">{t("studio.live.offline")}</p>}
      {searching && catalogue && hits.size === 0 && <p role="status" className="text-xs text-slate-500">{t("studio.data.empty")}</p>}
      <ul className="space-y-2">
        {catalogue?.sources.map((source) => {
          const fields = searching ? source.fields.filter((f) => hits.has(`${source.id}.${f.id}`)) : source.fields;
          if (fields.length === 0) return null;
          const open = source.allowed && source.connected;
          return (
            <li key={source.id} data-source={source.id}>
              <details open={searching || undefined}>
                <summary className="cursor-pointer text-sm font-medium">{source.label}{!source.connected && <span className="ms-2 text-xs font-normal text-slate-500">{t("studio.data.notConnected")}</span>}{source.connected && !source.allowed && <span className="ms-2 text-xs font-normal text-slate-500">{t("studio.data.noAccess")}</span>}</summary>
                <p className="mt-1 text-xs text-slate-500">{t("studio.data.perRow", { grain: source.grain })} · {source.guest ? t("studio.data.guestOk") : t("studio.data.guestNo")}</p>
                <ul className="mt-1 space-y-1">
                  {fields.map((f) => {
                    const pickable = open && f.available;
                    return (
                      <li key={f.id}>
                        <button type="button" disabled={!pickable} onClick={() => onPick({ source: source.id, field: f.id, role: f.role })} title={f.meaning}
                          className="flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-start text-xs hover:bg-slate-50 disabled:opacity-50 dark:hover:bg-slate-800" data-field={`${source.id}.${f.id}`}>
                          <span>{f.label}</span>
                          <span className="text-slate-500">{f.available ? (f.role === "MEASURE" ? t("studio.data.measure") : t("studio.data.dimension")) : t("studio.data.fieldComing")}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </details>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
