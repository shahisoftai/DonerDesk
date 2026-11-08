"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { LibrarySectorId } from "@donordesk/domain";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { applyLibraryUpdateAction, libraryUpdatesAction } from "@/lib/actions/sector-library";
import type { IndicatorUpdateStatus } from "../domain/library-dto";
import { libraryBrowser, projectAdopter } from "../composition";
import { LibraryPicker, type PickerTarget } from "./LibraryPicker";

const FIELD_OF: Record<string, string> = { name: "name", unit: "unit", frequency: "frequency", meansOfVerification: "meansOfVerification", direction: "direction", aggregation: "aggregation" };

/** Differences between a copied indicator and the library entry it came from. Applying carries over only the fields the person ticks; "Keep mine" only notes that the change was seen. */
function UpdatesList({ items, onDone }: { items: readonly IndicatorUpdateStatus[]; onDone: () => void }) {
  const { t } = useI18n();
  const [ticked, setTicked] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const act = async (indicatorId: string, fields: string[]) => {
    const r = await applyLibraryUpdateAction(indicatorId, fields);
    if (!r.ok) { setError(r.error.message); return; }
    setError(null);
    onDone();
  };
  const pending = items.filter((i) => i.update.state !== "CURRENT");
  if (pending.length === 0) return <p className="text-sm text-slate-600 dark:text-slate-300" data-testid="library-updates-none">{t("lib.update.none")}</p>;
  return (
    <ul className="space-y-3" data-testid="library-updates">
      {pending.map((i) => (
        <li key={i.indicatorId} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-white/10">
          <p className="font-medium"><span className="me-2 font-mono text-xs">{i.code}</span>{i.name}</p>
          {i.update.state === "CHANGED" ? (
            <>
              <p className="text-xs text-slate-600 dark:text-slate-300">{t("lib.update.changed")}</p>
              <ul className="mt-1 space-y-1">
                {i.update.changes.map((c) => {
                  const applyable = c.field in FIELD_OF;
                  return (
                    <li key={c.field} className="flex flex-wrap items-center gap-2 text-xs">
                      {applyable ? <input type="checkbox" checked={(ticked[i.indicatorId] ?? []).includes(c.field)} onChange={() => setTicked((s) => { const cur = s[i.indicatorId] ?? []; return { ...s, [i.indicatorId]: cur.includes(c.field) ? cur.filter((x) => x !== c.field) : [...cur, c.field] }; })} aria-label={c.label} /> : null}
                      <span className="font-medium">{c.label}:</span><span className="line-through opacity-70">{c.from}</span><span aria-hidden>→</span><span>{c.to}</span>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-2 flex gap-2">
                <button type="button" className="btn text-xs" onClick={() => void act(i.indicatorId, ticked[i.indicatorId] ?? [])} disabled={(ticked[i.indicatorId] ?? []).length === 0}>{t("lib.update.apply")}</button>
                <button type="button" className="btn-secondary text-xs" onClick={() => void act(i.indicatorId, [])}>{t("lib.update.seen")}</button>
              </div>
            </>
          ) : i.update.state === "REPLACED" ? <p className="text-xs">{t("lib.update.replaced")}</p> : <p className="text-xs">{t("lib.update.removed")}</p>}
        </li>
      ))}
      {error ? <li role="alert" className="text-sm text-danger-600">{error}</li> : null}
    </ul>
  );
}

/**
 * "Add from library" on a project's Logframe page: the shared picker, put on this project, plus the library updates for what the project
 * already copied. Adding goes through the ordinary indicator handler, so every check applies; the page is refreshed after.
 */
export function ProjectLibraryPanel({ projectId, targets, projectSector }: { projectId: string; targets: readonly PickerTarget[]; projectSector: LibrarySectorId[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [updates, setUpdates] = useState<IndicatorUpdateStatus[]>([]);
  const adopter = useMemo(() => projectAdopter(projectId), [projectId]);
  const reload = () => { void libraryUpdatesAction(projectId).then((r) => { if (r.ok) setUpdates(r.value); }); };
  useEffect(reload, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps
  const waiting = updates.filter((u) => u.update.state !== "CURRENT").length;
  return (
    <section className="mt-4 space-y-3" data-testid="project-library">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-secondary text-xs" aria-expanded={open} onClick={() => setOpen((o) => !o)} data-testid="project-library-toggle">{open ? t("lib.close") : t("lib.choose")}</button>
        {waiting > 0 ? <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-100" data-testid="library-updates-count">{t("lib.update.title")}: {waiting}</span> : null}
      </div>
      {open ? (
        <div className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
          <LibraryPicker browser={libraryBrowser} adopter={adopter} projectId={projectId} targets={targets} targetKey="logframeItemId" initialSectors={projectSector} onChanged={() => { router.refresh(); reload(); }} />
        </div>
      ) : null}
      {waiting > 0 ? (
        <div className="rounded-xl border border-amber-300 p-3 dark:border-amber-500/40">
          <h3 className="mb-2 text-sm font-semibold">{t("lib.update.title")}</h3>
          <UpdatesList items={updates} onDone={() => { router.refresh(); reload(); }} />
        </div>
      ) : null}
    </section>
  );
}
