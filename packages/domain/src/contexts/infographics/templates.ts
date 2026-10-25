/**
 * The template registry (Phase 31): six professional compositions, each an ordered list of slots —
 * never a blank page, never a hand-drawn image. A template works with incomplete data by rule:
 * every section kind has a "not yet reported" state, so a planning-stage project still produces a
 * useful overview and nothing is ever invented to fill a slot.
 *
 * Adding a template is a new row here (and a copy-lint check for its label); nothing else changes.
 */
import type { InfographicConfig, InfographicSectionConfig } from "./composition.js";

export type InfographicTemplateId = "OVERVIEW" | "PROGRESS" | "RESULTS" | "BUDGET" | "THEMATIC" | "CLOSURE";

export const INFOGRAPHIC_TEMPLATE_IDS: readonly InfographicTemplateId[] = ["OVERVIEW", "PROGRESS", "RESULTS", "BUDGET", "THEMATIC", "CLOSURE"];

/** Bumped only when a template's default composition changes; saved designs pin the version they were made with. */
export const INFOGRAPHIC_TEMPLATE_VERSION = 1;

export interface InfographicTemplate {
  id: InfographicTemplateId;
  version: number;
  label: string;
  description: string;
  /** The composition a new design starts from; the user may hide, reorder and retune it. */
  sections: InfographicSectionConfig[];
}

const s = (kind: InfographicSectionConfig["kind"], rest: Partial<InfographicSectionConfig> = {}): InfographicSectionConfig => ({ kind, ...rest });

export const INFOGRAPHIC_TEMPLATES: Readonly<Record<InfographicTemplateId, InfographicTemplate>> = {
  OVERVIEW: {
    id: "OVERVIEW",
    version: INFOGRAPHIC_TEMPLATE_VERSION,
    label: "Project Overview",
    description: "Key figures, where we work, objective and key indicators — at any project stage.",
    sections: [
      s("KPIS", { size: "FULL" }),
      s("MAP", { title: "Where we work", size: "HALF" }),
      s("TEXT", { title: "Objective", size: "HALF" }),
      s("LOCATION_RESULTS", { title: "Key indicators by location", size: "FULL" }),
      s("ACTIVITIES_BY_LOCATION", { title: "Planned activities by output and location", size: "HALF" }),
      s("REACH", { title: "People reached", size: "HALF" }),
    ],
  },
  PROGRESS: {
    id: "PROGRESS",
    version: INFOGRAPHIC_TEMPLATE_VERSION,
    label: "Implementation Progress",
    description: "Activities and milestones this period, delivery status and progress by location.",
    sections: [
      s("KPIS", { size: "FULL" }),
      s("ACTIVITIES_BY_LOCATION", { title: "Progress by location", size: "FULL" }),
      s("CHART", {
        size: "HALF",
        chart: { template: "STATUS_DISTRIBUTION", indicatorIds: [], measure: "PERIOD", type: "PIE" },
      }),
      s("REACH", { title: "People reached this period", size: "HALF" }),
      s("TEXT", { title: "What happened this period", size: "FULL" }),
    ],
  },
  RESULTS: {
    id: "RESULTS",
    version: INFOGRAPHIC_TEMPLATE_VERSION,
    label: "Results & Impact",
    description: "Targets and actuals, trends over periods and results by location where supported.",
    sections: [
      s("KPIS", { size: "FULL" }),
      s("LOCATION_RESULTS", { title: "Target vs actual by location", size: "FULL" }),
      s("LOCATION_COMPARISON", { title: "Location comparison", size: "FULL" }),
      s("TEXT", { title: "Outcome statements", size: "FULL" }),
    ],
  },
  BUDGET: {
    id: "BUDGET",
    version: INFOGRAPHIC_TEMPLATE_VERSION,
    label: "Budget Utilization",
    description: "Approved budget, verified expenditure, balance and burn rate. Finance records only.",
    sections: [
      s("KPIS", { size: "FULL" }),
      s("CHART", {
        title: "Budget vs expenditure",
        size: "FULL",
        chart: { template: "FINANCE_BUDGET_VS_SPEND", indicatorIds: [], measure: "PERIOD", type: "BAR" },
      }),
      s("CHART", {
        title: "Burn rate over time",
        size: "HALF",
        chart: { template: "FINANCE_BURN_RATE", indicatorIds: [], measure: "PERIOD", type: "LINE" },
      }),
      s("TEXT", { title: "About these figures", size: "HALF" }),
    ],
  },
  THEMATIC: {
    id: "THEMATIC",
    version: INFOGRAPHIC_TEMPLATE_VERSION,
    label: "Thematic Snapshot",
    description: "One sector's indicators, reach breakdowns and coverage for the chosen period.",
    sections: [
      s("KPIS", { size: "FULL" }),
      s("REACH", { title: "Reach by sex & age", size: "HALF" }),
      s("MAP", { title: "Reach by location", size: "HALF" }),
      s("LOCATION_RESULTS", { title: "Sector indicators", size: "FULL" }),
    ],
  },
  CLOSURE: {
    id: "CLOSURE",
    version: INFOGRAPHIC_TEMPLATE_VERSION,
    label: "Project Closure",
    description: "Final achievements, coverage by location, expenditure summary and lessons.",
    sections: [
      s("KPIS", { size: "FULL" }),
      s("LOCATION_RESULTS", { title: "Final achievement by location", size: "FULL" }),
      s("TEXT", { title: "Lessons learned", size: "HALF" }),
      s("TEXT", { title: "Changes of plan", size: "HALF" }),
    ],
  },
};

export const INFOGRAPHIC_TEMPLATE_ORDER: readonly InfographicTemplateId[] = INFOGRAPHIC_TEMPLATE_IDS;

/** The heading a section shows when the officer did not author one — one label per slot kind. */
export const DEFAULT_SECTION_LABEL: Readonly<Record<InfographicSectionConfig["kind"], string>> = {
  KPIS: "Key figures",
  CHART: "Chart",
  LOCATION_RESULTS: "Results by location",
  LOCATION_COMPARISON: "Location comparison",
  REACH: "People reached",
  ACTIVITIES_BY_LOCATION: "Activities by location",
  MAP: "Where we work",
  TEXT: "Notes",
};

export function templateById(id: string): InfographicTemplate | undefined {
  return (INFOGRAPHIC_TEMPLATES as Readonly<Record<string, InfographicTemplate | undefined>>)[id];
}

/** The registry as a plain map, for `validateConfig`. */
export function knownTemplates(): Map<string, { version: number }> {
  return new Map(Object.entries(INFOGRAPHIC_TEMPLATES).map(([id, template]) => [id, { version: template.version }]));
}

/** A new design from a template: its defaults, plus the user's title. */
export function configFromTemplate(templateId: string, title?: string): InfographicConfig | undefined {
  const template = templateById(templateId);
  if (!template) return undefined;
  return {
    templateId: template.id,
    templateVersion: template.version,
    ...(title?.trim() ? { title: title.trim() } : {}),
    sections: template.sections.map((section) => ({ ...section, ...(section.chart ? { chart: { ...section.chart, indicatorIds: [...section.chart.indicatorIds] } } : {}) })),
  };
}
