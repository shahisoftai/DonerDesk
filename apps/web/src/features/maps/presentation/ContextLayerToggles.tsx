"use client";

import { IMAGERY_KEY, type ContextToggle } from "../domain/scene/context-layers";
import { useMapText } from "./useMapText";

/** Switches for the context layers the organisation offers (Phase 49.6). Off by default; context is never a result. */
export function ContextLayerToggles({ offered, on, onToggle }: { offered: readonly ContextToggle[]; on: ReadonlySet<ContextToggle>; onToggle: (key: ContextToggle) => void }) {
  const { t } = useMapText();
  if (offered.length === 0) return null;
  return (
    <fieldset className="space-y-1 text-sm">
      <legend className="font-medium">{t("maps.context.title")}</legend>
      {offered.map((key) => (
        <label key={key} className="flex items-center gap-2">
          <input type="checkbox" checked={on.has(key)} onChange={() => onToggle(key)} />
          {t(key === IMAGERY_KEY ? "maps.context.imagery" : `maps.context.${key}`)}
        </label>
      ))}
      <p className="text-xs text-slate-500">{t("maps.context.note")}</p>
    </fieldset>
  );
}
