"use client";

import { FILTER_DIMENSION_DEFS, placeOptionsUnder, type CrossFilter, type FilterBarOptions, type FilterChoices, type FilterControl, type FilterDimension } from "@donordesk/domain/contexts/canvas/index.js";

import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { FilterDropdown, type Option } from "./FilterDropdown";

/** What a filter bar block holds (the domain's `FilterBarProps`). */
export interface FilterBarProps { dimensions: FilterDimension[]; controls?: FilterControl[] | undefined; options?: FilterBarOptions | undefined }

interface Props {
  bar: FilterBarProps | null;
  choices: FilterChoices;
  filters: CrossFilter;
  tone: { strip: string; ink: string; on: string };
  onChange: (f: CrossFilter) => void;
  onClear: () => void;
}

const DEFAULT_DIMS: readonly FilterDimension[] = ["PERIOD", "PLACE", "STATUS"];

/**
 * The filter bar (Phase 50.3): one slicer per dimension the bar names, styled as the author chose. Places can be offered level by level
 * (provinces, then districts inside the chosen ones). What is chosen narrows every block that follows that filter; nothing is saved
 * into the canvas.
 */
export function FilterPane({ bar, choices, filters, tone, onChange, onClear }: Props) {
  const { t } = useI18n();
  const dims = (bar?.dimensions ?? DEFAULT_DIMS).filter((d) => d !== "DRAFTS" && d !== "PROJECT" && d !== "SECTOR" && d !== "FUNDING_SOURCE");
  const control = (d: FilterDimension) => bar?.controls?.find((c) => c.dimension === d);
  const slicer = (key: string, d: FilterDimension, label: string, options: readonly Option[], chosen: readonly string[], set: (keys: string[]) => void) => {
    const c = control(d);
    return <FilterDropdown key={key} label={label} options={options} chosen={chosen} multi={(c?.multi ?? true) && FILTER_DIMENSION_DEFS[d].multi} search={c?.search ?? true} selectedFirst={c?.selectedFirst ?? false} style={c?.style ?? "DROPDOWN"} tone={tone} onChange={set} />;
  };
  const out: React.ReactNode[] = [];
  for (const d of dims) {
    const label = control(d)?.label || t(`filter.${d}` as never);
    if (d === "PERIOD" && choices.periods.length) out.push(slicer(d, d, label, choices.periods.map((p) => ({ key: p.id, label: p.label })), filters.periodId ? [filters.periodId] : [], (k) => onChange({ ...filters, periodId: k[0] ?? "" })));
    else if (d === "STATUS" && choices.statuses.length) out.push(slicer(d, d, label, choices.statuses.map((s) => ({ key: s, label: s })), filters.status ? [filters.status] : [], (k) => onChange({ ...filters, status: k[0] ?? "" })));
    else if (d === "DONOR" && choices.donors?.length) out.push(slicer(d, d, label, choices.donors.map((s) => ({ key: s, label: s })), filters.donors ?? [], (k) => onChange({ ...filters, donors: k })));
    else if (d === "PARTNER" && choices.partners?.length) out.push(slicer(d, d, label, choices.partners.map((s) => ({ key: s, label: s })), filters.partners ?? [], (k) => onChange({ ...filters, partners: k })));
    else if (d === "PLACE") {
      const levels = control("PLACE")?.levels;
      const tree = choices.placeTree ?? [];
      if (levels?.length && tree.length) {
        // One slicer per level, top first; a lower level offers only places inside the higher choice, and the lowest choice made is the filter.
        let upper: string[] = [];
        levels.forEach((lvl, i) => {
          const atLevel = tree.filter((p) => p.level === lvl);
          const offered = placeOptionsUnder(atLevel, tree, upper);
          const chosenHere = filters.places.filter((k) => atLevel.some((p) => p.key === k));
          const names = [t("filter.PLACE"), ...["Province", "District", "Sub-district", "Site"]];
          out.push(slicer(`PLACE-${lvl}`, "PLACE", i === 0 ? label : names[Math.min(names.length - 1, i + 1)]!, offered.map((p) => ({ key: p.key, label: p.label })), chosenHere, (k) => {
            const keepAbove = filters.places.filter((x) => tree.some((p) => p.key === x && p.level < lvl));
            onChange({ ...filters, places: [...keepAbove, ...k] });
          }));
          if (chosenHere.length) upper = chosenHere;
        });
      } else if (choices.places.length) out.push(slicer(d, d, label, choices.places.map((p) => ({ key: p.key, label: p.label })), filters.places, (k) => onChange({ ...filters, places: k })));
    }
  }
  if (out.length === 0) return null;
  return (
    <section id="canvas-filter-pane" aria-label={t("canvas.ui.filtersOpen")} className="flex flex-wrap items-end gap-2 print:hidden" data-testid="canvas-filters">
      {out}
      {(bar?.options?.clearAll ?? true) && <button type="button" onClick={onClear} className="min-h-8 rounded border border-slate-300 px-2 text-xs hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800">{t("filter.clearAll")}</button>}
    </section>
  );
}
