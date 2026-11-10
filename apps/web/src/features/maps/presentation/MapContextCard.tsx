"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { saveMapContextAction } from "@/lib/actions/map-context";
import type { MapContextDto } from "@/lib/server/schemas-map-context";
import { useMapText } from "./useMapText";

const KEYS = ["POPULATION", "HEALTH_FACILITIES", "SETTLEMENTS"] as const;

/**
 * An administrator chooses which context layers the organisation's maps offer, and may add the organisation's own imagery (Phase 49.6).
 * Imagery is the one map feature that calls an outside service, so the card says so before it is set; it is off by default.
 */
export function MapContextCard({ initial }: { initial: MapContextDto }) {
  const { t } = useMapText();
  const [layers, setLayers] = useState<string[]>(initial.layers);
  const [url, setUrl] = useState(initial.imageryUrl ?? "");
  const [credit, setCredit] = useState(initial.imageryCredit ?? "");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setBusy(true); setNote(null);
    try {
      const r = await saveMapContextAction({ layers, imageryUrl: url.trim() || null, imageryCredit: credit.trim() || null });
      setNote(r.ok ? { ok: true, text: t("maps.context.saved") } : { ok: false, text: r.error.message });
    } finally { setBusy(false); }
  }

  return (
    <section className="card mt-6 space-y-3" aria-labelledby="map-context-title">
      <h2 id="map-context-title" className="text-sm font-semibold">{t("maps.context.settingsTitle")}</h2>
      <p className="text-sm text-slate-600 dark:text-slate-300">{t("maps.context.settingsIntro")}</p>
      <fieldset className="space-y-1 text-sm">
        {KEYS.map((key) => (
          <label key={key} className="flex items-center gap-2">
            <input type="checkbox" checked={layers.includes(key)} disabled={busy} onChange={() => setLayers((l) => (l.includes(key) ? l.filter((x) => x !== key) : [...l, key]))} />
            {t(`maps.context.${key}`)}
          </label>
        ))}
      </fieldset>
      <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-100">{t("maps.context.imageryWarning")}</p>
      <Field label={t("maps.context.imageryUrl")}><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/{z}/{x}/{y}.jpg" /></Field>
      <Field label={t("maps.context.imageryCredit")}><Input value={credit} onChange={(e) => setCredit(e.target.value)} /></Field>
      <Button onClick={() => void save()} pending={busy} disabled={busy}>{t("maps.context.save")}</Button>
      {note && <p role="status" className={`text-sm ${note.ok ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}>{note.text}</p>}
    </section>
  );
}
