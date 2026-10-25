/**
 * What a saved infographic is (Phase 31): a composition, never a copy of project data. A config
 * names the template, the periods and indicators to show, the sections in their order, and the
 * words the user authored. Everything else — the figures — is read from project records at
 * generation time and snapshotted only in published exports.
 *
 * Validation is total: a config that names an unknown template, an unknown chart template, the
 * wrong number of indicators for that chart, or an oversized authored text is refused here, before
 * any renderer sees it.
 */
import { DomainError } from "../../core/domain-error.js";
import type { Result } from "../../core/result.js";
import { CHART_MEASURES, type ChartMeasure } from "../reporting/data-sheet.js";
import { CHART_TYPES, type ChartType } from "../reporting/chart-config.js";
import { DATA_CHART_TEMPLATES, type DataChartTemplate } from "../reporting/data-charts.js";

/** The slot kinds a template (and the Studio) can compose. Each maps to one renderer section. */
export type InfographicSectionKind =
  | "KPIS"
  | "CHART"
  | "LOCATION_RESULTS"
  | "LOCATION_COMPARISON"
  | "REACH"
  | "ACTIVITIES_BY_LOCATION"
  | "MAP"
  | "TEXT";

export const INFOGRAPHIC_SECTION_KINDS: readonly InfographicSectionKind[] = [
  "KPIS",
  "CHART",
  "LOCATION_RESULTS",
  "LOCATION_COMPARISON",
  "REACH",
  "ACTIVITIES_BY_LOCATION",
  "MAP",
  "TEXT",
];

/** The chart a CHART section draws: the Data Center's own spec, so preview and export agree. */
export interface InfographicChartSpec {
  template: DataChartTemplate;
  indicatorIds: string[];
  measure: ChartMeasure;
  type: ChartType;
  /** Draw the indicator's target as a reference line (over-time charts of one indicator). */
  showTarget?: boolean;
  title?: string;
}

export type SectionSize = "THIRD" | "HALF" | "FULL";

export interface InfographicSectionConfig {
  kind: InfographicSectionKind;
  /** Authored heading; absent = the section's default label. */
  title?: string;
  /** Authored body, TEXT sections only. */
  text?: string;
  /** CHART sections only. */
  chart?: InfographicChartSpec;
  /** Indicators a KPIS or LOCATION_RESULTS section covers (absent = the template's default set). */
  indicatorIds?: string[];
  /** Restrict to these location keys (absent/empty = all recorded locations). */
  locationKeys?: string[];
  size?: SectionSize;
  hidden?: boolean;
}

export interface InfographicConfig {
  templateId: string;
  templateVersion: number;
  /** Authored design title (the list page's name); absent = the template label. */
  title?: string;
  periodFromId?: string;
  periodToId?: string;
  locationKeys?: string[];
  branding?: boolean;
  sections: InfographicSectionConfig[];
}

export const MAX_TITLE_LENGTH = 120;
export const MAX_TEXT_LENGTH = 600;
export const MAX_SECTIONS = 24;
export const MAX_INDICATORS_PER_SECTION = 30;

const cleanText = (value: string | undefined, max: number): string | undefined => {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.length > max ? undefined : trimmed;
};

/**
 * Validates a config against the template registry the caller trusts. Returns the cleaned config
 * (trimmed texts, defaults applied) or one error naming the first problem.
 */
export function validateConfig(
  input: InfographicConfig,
  knownTemplates: ReadonlyMap<string, { version: number }>,
): Result<InfographicConfig, DomainError> {
  const template = knownTemplates.get(input.templateId);
  if (!template) return { ok: false, error: DomainError.validation("Choose one of the offered templates") };
  if (input.templateVersion !== template.version) {
    return { ok: false, error: DomainError.validation("This design was made with another template version — recreate it or update the template version", { templateId: input.templateId, expected: template.version, got: input.templateVersion }) };
  }
  const title = cleanText(input.title, MAX_TITLE_LENGTH);
  if (input.title?.trim() && !title) return { ok: false, error: DomainError.validation(`Keep the title under ${MAX_TITLE_LENGTH} characters`) };
  if (!Array.isArray(input.sections) || input.sections.length === 0) {
    return { ok: false, error: DomainError.validation("A design needs at least one section") };
  }
  if (input.sections.length > MAX_SECTIONS) {
    return { ok: false, error: DomainError.validation(`A design holds at most ${MAX_SECTIONS} sections`) };
  }
  const sections: InfographicSectionConfig[] = [];
  for (const section of input.sections) {
    if (!INFOGRAPHIC_SECTION_KINDS.includes(section.kind)) {
      return { ok: false, error: DomainError.validation("This design has a section of an unknown kind") };
    }
    const sectionTitle = cleanText(section.title, MAX_TITLE_LENGTH);
    if (section.title?.trim() && !sectionTitle) return { ok: false, error: DomainError.validation(`Keep section titles under ${MAX_TITLE_LENGTH} characters`) };
    const text = cleanText(section.text, MAX_TEXT_LENGTH);
    if (section.text?.trim() && !text) return { ok: false, error: DomainError.validation(`Keep section text under ${MAX_TEXT_LENGTH} characters`) };
    // A TEXT section may start empty (template defaults do): the renderer shows its title and a blank panel.
    let chart: InfographicChartSpec | undefined;
    if (section.kind === "CHART") {
      if (!section.chart) return { ok: false, error: DomainError.validation("A chart section needs a chart") };
      const info = DATA_CHART_TEMPLATES[section.chart.template];
      if (!info) return { ok: false, error: DomainError.validation("This chart template is not offered") };
      if (!CHART_TYPES.includes(section.chart.type)) return { ok: false, error: DomainError.validation("This chart type is not offered") };
      if (!CHART_MEASURES.includes(section.chart.measure)) return { ok: false, error: DomainError.validation("This chart measure is not offered") };
      if (!info.types.includes(section.chart.type)) {
        return { ok: false, error: DomainError.validation(`A ${info.label} chart cannot be drawn as this chart type`) };
      }
      const ids = section.chart.indicatorIds ?? [];
      if (info.indicators === "none" && ids.length > 0) {
        return { ok: false, error: DomainError.validation(`A ${info.label} chart takes no indicators`) };
      }
      if (info.indicators === "one" && ids.length !== 1) {
        return { ok: false, error: DomainError.validation(`A ${info.label} chart needs exactly one indicator`) };
      }
      if (info.indicators === "many" && ids.length === 0) {
        return { ok: false, error: DomainError.validation(`A ${info.label} chart needs at least one indicator`) };
      }
      if (ids.length > MAX_INDICATORS_PER_SECTION) {
        return { ok: false, error: DomainError.validation(`A chart takes at most ${MAX_INDICATORS_PER_SECTION} indicators`) };
      }
      chart = {
        template: section.chart.template,
        indicatorIds: ids,
        measure: section.chart.measure,
        type: section.chart.type,
        ...(section.chart.showTarget ? { showTarget: true } : {}),
        ...(cleanText(section.chart.title, MAX_TITLE_LENGTH) ? { title: cleanText(section.chart.title, MAX_TITLE_LENGTH) } : {}),
      };
    }
    if (section.indicatorIds && section.indicatorIds.length > MAX_INDICATORS_PER_SECTION) {
      return { ok: false, error: DomainError.validation(`A section takes at most ${MAX_INDICATORS_PER_SECTION} indicators`) };
    }
    sections.push({
      kind: section.kind,
      ...(sectionTitle ? { title: sectionTitle } : {}),
      ...(text ? { text } : {}),
      ...(chart ? { chart } : {}),
      ...(section.indicatorIds?.length ? { indicatorIds: [...section.indicatorIds] } : {}),
      ...(section.locationKeys?.length ? { locationKeys: [...section.locationKeys] } : {}),
      ...(section.size ? { size: section.size } : {}),
      ...(section.hidden ? { hidden: true } : {}),
    });
  }
  return {
    ok: true,
    value: {
      templateId: input.templateId,
      templateVersion: input.templateVersion,
      ...(title ? { title } : {}),
      ...(input.periodFromId ? { periodFromId: input.periodFromId } : {}),
      ...(input.periodToId ? { periodToId: input.periodToId } : {}),
      ...(input.locationKeys?.length ? { locationKeys: [...input.locationKeys] } : {}),
      ...(input.branding ? { branding: true } : {}),
      sections,
    },
  };
}
