"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { admin1FileKey } from "@/features/maps/domain/boundaries/join";
import { geometryBounds } from "@/features/maps/domain/model/bounds";
import { currentOfflineMap, offlineMapSize, saveOfflineMap } from "../infrastructure/offline-maps";

const fold = (s: string): string => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

async function countryBox(country: string): Promise<[number, number, number, number] | null> {
  const { WORLD_GEO } = await import("@/features/workplan/domain/geo/world-geo");
  const hit = WORLD_GEO.features.find((f) => fold(String(f.properties.name)) === fold(country));
  const b = hit ? geometryBounds(hit.geometry) : null;
  return b ? [b[0], b[1], b[2], b[3]] : null;
}

const megabytes = (bytes: number): string => (bytes / 1048576).toFixed(bytes < 10 * 1048576 ? 1 : 0);

/**
 * "Keep the map for offline use" (Phase 49.4): the size is shown first and nothing large is downloaded until the person agrees. Only public
 * map data is kept (the street map cut to the country, and the country's province outlines); it is removed on sign-out.
 */
export function OfflineMapCard({ userId, projectId, country }: { userId: string; projectId: string; country: string }) {
  const { t } = useI18n();
  const [size, setSize] = useState<number | null | undefined>(undefined);
  const [box, setBox] = useState<[number, number, number, number] | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const kept = typeof window === "undefined" ? null : currentOfflineMap();

  useEffect(() => { setSize(undefined); setNote(null); }, [projectId]);

  async function check() {
    setBusy(true);
    try {
      const b = await countryBox(country);
      if (!b) { setNote(t("field.map.noCountry")); return; }
      setBox(b);
      setSize(await offlineMapSize(projectId, b));
    } finally { setBusy(false); }
  }

  async function keep() {
    if (!box) return;
    setBusy(true);
    try {
      const saved = await saveOfflineMap(userId, projectId, box, `/geo/ADM1/${encodeURIComponent(admin1FileKey(country))}.json`);
      setNote(saved ? t("field.map.kept", { size: megabytes(saved.bytes) }) : t("field.map.failed"));
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-2 rounded-md border border-slate-200 p-3 dark:border-slate-700">
      <p className="text-sm font-medium">{t("field.map.title")}</p>
      {kept?.projectId === projectId && <p className="text-xs text-slate-500">{t("field.map.already", { size: megabytes(kept.bytes) })}</p>}
      {size === undefined && <Button variant="secondary" size="sm" onClick={() => void check()} pending={busy} disabled={busy}>{t("field.map.check")}</Button>}
      {size === null && <p className="text-xs text-slate-500">{t("field.map.unavailable")}</p>}
      {typeof size === "number" && (
        <>
          <p className="text-xs text-slate-500">{t("field.map.size", { size: megabytes(size) })}</p>
          <Button size="sm" onClick={() => void keep()} pending={busy} disabled={busy}>{t("field.map.keep")}</Button>
        </>
      )}
      {note && <p role="status" className="text-xs text-slate-600 dark:text-slate-300">{note}</p>}
    </div>
  );
}
