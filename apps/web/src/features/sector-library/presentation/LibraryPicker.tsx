"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LibrarySectorId } from "@donordesk/domain";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { useDonorLevelWord } from "@/features/logframe/presentation/FrameworkVocabularyProvider";
import type { LibraryFilters } from "../domain/library-dto";
import { EMPTY_FILTERS, hasUnreviewed, pruneSelection, selectRecommended, toggle, toggleGroup, toggleIn, withFilter, type Selection } from "../domain/picker-state";
import type { LibraryAdopter, LibraryBrowser, LibraryPage } from "../ports/library-port";
import { EntryRow } from "./EntryRow";
import { SectorList } from "./SectorList";

export interface PickerTarget { id: string; label: string }

export interface LibraryPickerProps {
  browser: LibraryBrowser;
  adopter: LibraryAdopter;
  /** The project the picker adds to; entries it already has are shown as adopted. */
  projectId?: string;
  /** Results the chosen indicators can sit under. Empty: each goes to the result at its own level. */
  targets: readonly PickerTarget[];
  /** How the chosen target is handed to the adopter (a logframe item id for a project, a code for the wizard). */
  targetKey: "logframeItemId" | "logframeCode";
  initialSectors?: readonly LibrarySectorId[];
  onChanged?: () => void;
}

const LEVELS = ["GOAL", "OUTCOME", "OUTPUT", "ACTIVITY"] as const;
const KINDS = ["COUNT", "RATE", "RATIO", "INDEX"] as const;

/**
 * The picker for the sector library, shared by the wizard and a project's Logframe page. It browses through a `LibraryBrowser` and
 * adds through a `LibraryAdopter`, so it knows nothing of either place. Nothing is added until the person chooses Add.
 */
export function LibraryPicker({ browser, adopter, projectId, targets, targetKey, initialSectors = [], onChanged }: LibraryPickerProps) {
  const { t } = useI18n();
  const donorWord = useDonorLevelWord();
  const [filters, setFilters] = useState<LibraryFilters>({ ...EMPTY_FILTERS, sectors: [...initialSectors] });
  const [page, setPage] = useState<LibraryPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Selection>(new Set());
  const [target, setTarget] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  const load = useCallback(async (f: LibraryFilters) => {
    const mine = ++seq.current;
    setLoading(true);
    const r = await browser.browse(f, projectId);
    if (mine !== seq.current) return;
    setLoading(false);
    if (!r.ok) { setError(r.message); return; }
    setError(null);
    setPage(r.value);
    setSelected((s) => pruneSelection(s, r.value.groups.flatMap((g) => g.entries)));
  }, [browser, projectId]);

  // A typed search waits a moment after the last key; every other change asks at once.
  const first = useRef(true);
  useEffect(() => {
    const wait = first.current ? 0 : 250;
    first.current = false;
    const timer = setTimeout(() => void load(filters), wait);
    return () => clearTimeout(timer);
  }, [filters, load]);

  const entries = useMemo(() => page?.groups.flatMap((g) => g.entries) ?? [], [page]);

  const add = async () => {
    if (selected.size === 0) return;
    setBusy(true);
    const r = await adopter.adopt([...selected], target ? { [targetKey]: target } : {});
    setBusy(false);
    if (!r.ok) { setMessage(null); setError(r.message); return; }
    setError(null);
    setMessage([t("lib.added", { count: r.value.added }), r.value.skipped.length ? `${t("lib.skipped", { count: r.value.skipped.length })}: ${r.value.skipped.map((s) => s.reason).join(" ")}` : ""].filter(Boolean).join(". "));
    setSelected(new Set());
    onChanged?.();
    void load(filters);
  };

  const addSkeleton = async () => {
    if (!adopter.adoptSkeleton || filters.sectors.length === 0) return;
    setBusy(true);
    let total = 0;
    for (const sector of filters.sectors) {
      const r = await adopter.adoptSkeleton(sector);
      if (!r.ok) { setBusy(false); setError(r.message); return; }
      total += r.value.added;
    }
    setBusy(false);
    setError(null);
    setMessage(t("lib.skeletonDone", { count: total }));
    onChanged?.();
  };

  return (
    <section aria-label={t("lib.title")} className="grid gap-4 md:grid-cols-[14rem_1fr]" data-testid="library-picker">
      <aside className="max-h-[32rem] overflow-y-auto pe-2">
        {page ? <SectorList sectors={page.sectors} chosen={filters.sectors} onToggle={(id) => setFilters((f) => withFilter(f, "sectors", toggleIn(f.sectors, id)))} /> : null}
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{t("lib.attachedNote")}</p>
      </aside>

      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[14rem] flex-1 text-sm">
            <span className="mb-1 block font-medium">{t("lib.search")}</span>
            <input className="input w-full" type="search" value={filters.text} placeholder={t("lib.searchPlaceholder")} onChange={(e) => setFilters((f) => withFilter(f, "text", e.target.value))} data-testid="library-search" />
          </label>
          <fieldset className="flex flex-wrap gap-2 text-xs">
            <legend className="mb-1 text-sm font-medium">{t("lib.filter.level")}</legend>
            {LEVELS.map((l) => (
              <label key={l} className="flex items-center gap-1"><input type="checkbox" checked={filters.levels.includes(l)} onChange={() => setFilters((f) => withFilter(f, "levels", toggleIn(f.levels, l)))} />{donorWord(l) ?? t(`lib.level.${l}` as never)}</label>
            ))}
          </fieldset>
          <fieldset className="flex flex-wrap gap-2 text-xs">
            <legend className="mb-1 text-sm font-medium">{t("lib.filter.kind")}</legend>
            {KINDS.map((k) => (
              <label key={k} className="flex items-center gap-1"><input type="checkbox" checked={filters.kinds.includes(k)} onChange={() => setFilters((f) => withFilter(f, "kinds", toggleIn(f.kinds, k)))} />{t(`lib.kind.${k}` as never)}</label>
            ))}
          </fieldset>
          <div className="flex flex-wrap gap-3 text-xs">
            <label className="flex items-center gap-1"><input type="checkbox" checked={filters.recommendedOnly} onChange={(e) => setFilters((f) => withFilter(f, "recommendedOnly", e.target.checked))} />{t("lib.filter.recommended")}</label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={filters.withStandard} onChange={(e) => setFilters((f) => withFilter(f, "withStandard", e.target.checked))} />{t("lib.filter.standard")}</label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={filters.reviewedOnly} onChange={(e) => setFilters((f) => withFilter(f, "reviewedOnly", e.target.checked))} />{t("lib.filter.reviewed")}</label>
          </div>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300" role="status">
          {loading ? t("lib.loading") : page ? t("lib.total", { count: page.total }) : null}
          {entries.length > 0 && hasUnreviewed(entries) ? <span className="ms-2 text-amber-700 dark:text-amber-300">{t("lib.unreviewedNote")}</span> : null}
        </p>
        {error ? <p role="alert" className="text-sm text-danger-600">{error}</p> : null}
        {message ? <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300" data-testid="library-message">{message}</p> : null}

        <div className="max-h-[26rem] space-y-4 overflow-y-auto pe-1" data-testid="library-list">
          {page && page.groups.length === 0 && !loading ? <p className="text-sm text-slate-500">{t("lib.empty")}</p> : null}
          {page?.groups.map((g) => (
            <div key={g.group}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{g.group}</h3>
                <button type="button" className="text-xs text-brand-600 hover:underline dark:text-brand-400" onClick={() => setSelected((s) => toggleGroup(s, g.entries))}>
                  {g.entries.filter((e) => !e.adopted).every((e) => selected.has(e.id)) && g.entries.some((e) => !e.adopted) ? t("lib.clearSelection") : t("lib.selectGroup")}
                </button>
              </div>
              <ul>{g.entries.map((e) => <EntryRow key={e.id} entry={e} selected={selected.has(e.id)} onToggle={() => setSelected((s) => toggle(s, e.id))} />)}</ul>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-3 dark:border-slate-700">
          <span className="text-sm" data-testid="library-selected">{t("lib.selectedCount", { count: selected.size })}</span>
          <button type="button" className="btn-secondary text-xs" onClick={() => setSelected((s) => selectRecommended(s, entries))}>{t("lib.selectRecommended")}</button>
          <button type="button" className="btn-secondary text-xs" onClick={() => setSelected(new Set())} disabled={selected.size === 0}>{t("lib.clearSelection")}</button>
          {targets.length > 0 ? (
            <label className="flex items-center gap-2 text-sm">
              <span>{t("lib.addTo")}</span>
              <select className="input" value={target} onChange={(e) => setTarget(e.target.value)} data-testid="library-target">
                <option value="">{t("lib.putAuto")}</option>
                {targets.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
              </select>
            </label>
          ) : null}
          <button type="button" className="btn" onClick={() => void add()} disabled={busy || selected.size === 0} data-testid="library-add">{t("lib.addSelected", { count: selected.size })}</button>
          {adopter.adoptSkeleton && filters.sectors.length > 0 ? <button type="button" className="btn-secondary text-xs" onClick={() => void addSkeleton()} disabled={busy} data-testid="library-skeleton">{t("lib.skeleton")}</button> : null}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">{t("lib.referenceNote")}</p>
      </div>
    </section>
  );
}
