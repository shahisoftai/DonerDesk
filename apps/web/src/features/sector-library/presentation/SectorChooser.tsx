"use client";

import { useEffect, useState } from "react";
import type { LibrarySectorId } from "@donordesk/domain";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import type { SectorSummary } from "../domain/library-dto";
import type { LibraryBrowser } from "../ports/library-port";

/**
 * The Start slide's sector choice: one main sector (the one the project is filed under) and any number of others it also works in.
 * Choosing offers the sector's indicators and suggested results on the next slides; nothing is filled in by choosing.
 */
export function SectorChooser({ browser, value, onChange, disabled }: { browser: LibraryBrowser; value: readonly string[]; onChange: (ids: LibrarySectorId[]) => void; disabled?: boolean }) {
  const { t } = useI18n();
  const [sectors, setSectors] = useState<SectorSummary[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    void browser.sectors().then((r) => { if (!alive) return; if (r.ok) setSectors(r.value); else setFailed(true); });
    return () => { alive = false; };
  }, [browser]);
  const main = sectors.filter((s) => !s.attached);
  const [first, ...rest] = value as LibrarySectorId[];
  const setMain = (id: string) => onChange(id ? [id as LibrarySectorId, ...rest.filter((x) => x !== id)] : []);
  const toggleOther = (id: LibrarySectorId) => onChange([first as LibrarySectorId, ...(rest.includes(id) ? rest.filter((x) => x !== id) : [...rest, id])]);
  if (failed) return <p role="alert" className="text-sm text-danger-600">{t("lib.error")}</p>;
  return (
    <div className="space-y-3" data-testid="sector-chooser">
      <label className="block text-sm">
        <span className="mb-1 block font-medium">{t("lib.start.sector")}</span>
        <select className="input w-full" value={first ?? ""} disabled={disabled} onChange={(e) => setMain(e.target.value)} data-testid="sector-main">
          <option value="" disabled>{t("lib.start.choose")}</option>
          {(["HUMANITARIAN", "DEVELOPMENT"] as const).map((g) => (
            <optgroup key={g} label={t(`lib.group.${g}` as never)}>
              {main.filter((s) => s.group === g).map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </optgroup>
          ))}
        </select>
      </label>
      {first ? (
        <fieldset className="text-sm">
          <legend className="mb-1 font-medium">{t("lib.start.also")}</legend>
          <div className="grid max-h-48 gap-x-4 gap-y-0.5 overflow-y-auto sm:grid-cols-2">
            {main.filter((s) => s.id !== first).map((s) => (
              <label key={s.id} className="flex items-center gap-2"><input type="checkbox" disabled={disabled} checked={rest.includes(s.id)} onChange={() => toggleOther(s.id)} data-testid={`sector-also-${s.id}`} />{s.label}</label>
            ))}
          </div>
        </fieldset>
      ) : <p className="text-xs text-slate-500 dark:text-slate-400">{t("lib.start.noSectors")}</p>}
      <p className="text-xs text-slate-500 dark:text-slate-400">{t("lib.start.packNote")}</p>
    </div>
  );
}
