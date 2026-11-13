"use client";

import { MAX_MARKER_INDICATORS, type MarkerKind, type MarkerResult } from "../domain/scene/place-markers";
import { useMapText } from "./useMapText";

/** The "small charts on places" choice inside More options (Phase 53.5): the kind, which indicators, and why a chart was refused. */
export function MarkerControls({ kind, onKind, ids, onIds, indicators, data }: {
  kind: MarkerKind; onKind: (k: MarkerKind) => void;
  ids: readonly string[]; onIds: (update: (ids: string[]) => string[]) => void;
  indicators: ReadonlyArray<{ id: string; code: string; name: string }>;
  data: MarkerResult | null;
}) {
  const { t } = useMapText();
  return (
    <fieldset className="space-y-1 text-sm" data-testid="marker-controls">
      <legend className="font-medium">{t("maps.markers.title")}</legend>
      <select className="input" aria-label={t("maps.markers.title")} value={kind} onChange={(e) => onKind(e.target.value as MarkerKind)}>
        {(["NONE", "BAR", "PIE"] as const).map((k) => <option key={k} value={k}>{t(`maps.markers.${k}` as never)}</option>)}
      </select>
      {kind !== "NONE" && indicators.map((i) => (
        <label key={i.id} className="flex items-center gap-1">
          <input type="checkbox" checked={ids.includes(i.id)} disabled={!ids.includes(i.id) && ids.length >= MAX_MARKER_INDICATORS} onChange={(e) => onIds((all) => (e.target.checked ? [...all, i.id] : all.filter((x) => x !== i.id)))} /> {i.code} {i.name}
        </label>
      ))}
      {data && !data.ok && <p role="status" className="text-xs text-slate-600">{t(`maps.markers.refusal.${data.refusal}` as never)}</p>}
      {data && data.ok && data.withoutFull > 0 && <p className="text-xs text-slate-600">{t("maps.markers.partial", { count: data.withoutFull })}</p>}
    </fieldset>
  );
}
