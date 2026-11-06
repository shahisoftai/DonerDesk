/**
 * Dashboard templates (Phase 34.0): a ready-made dashboard for a sector. A template names indicator ROLES ("people with basic
 * water access"), never a project's indicator ids; applying it maps each role to one of the project's own indicators, and
 * the person confirms or changes the match. A template is always a DRAFT: nobody has signed it off as the right dashboard for a
 * sector, so every template, built-in or an organisation's own, can be copied and edited with the tools below.
 * Pure: no storage, no clock; every edit returns a new template and never changes the one it was given.
 */
import { CHART_MEASURES, type ChartMeasure } from "../reporting/data-sheet.js";
import { DATA_CHART_TEMPLATES, type DataChartTemplate } from "../reporting/data-charts.js";
import { CHART_KINDS, validateChartSpec, type ChartKind, type ChartSpecV2 } from "../reporting/chart-spec-v2.js";
import { GRID_COLUMNS, MAX_WIDGETS, WIDGET_MAX_H, WIDGET_MIN_H, WIDGET_MIN_W, moveWidget, removeWidget, resizeWidget, settleLayout } from "./dashboard.js";

export type SectorKey =
  | "WASH" | "HEALTH" | "NUTRITION" | "EDUCATION" | "FOOD_SECURITY" | "AGRICULTURE" | "PROTECTION" | "SHELTER"
  | "GOVERNANCE" | "ECONOMIC_DEVELOPMENT" | "CLIMATE" | "HUMANITARIAN";

export const TEMPLATE_SECTORS: Record<SectorKey, { label: string }> = {
  WASH: { label: "Water, sanitation and hygiene" },
  HEALTH: { label: "Health" },
  NUTRITION: { label: "Nutrition" },
  EDUCATION: { label: "Education" },
  FOOD_SECURITY: { label: "Food security and livelihoods" },
  AGRICULTURE: { label: "Agriculture" },
  PROTECTION: { label: "Protection and gender-based violence" },
  SHELTER: { label: "Shelter and camp management" },
  GOVERNANCE: { label: "Governance and civil society" },
  ECONOMIC_DEVELOPMENT: { label: "Economic development" },
  CLIMATE: { label: "Climate and resilience" },
  HUMANITARIAN: { label: "Humanitarian response (several sectors)" },
};
export const TEMPLATE_SECTOR_ORDER = Object.keys(TEMPLATE_SECTORS) as SectorKey[];

export type TemplateAudience = "PROGRAMME" | "DONOR" | "FIELD" | "EXECUTIVE";
export const TEMPLATE_AUDIENCES: readonly TemplateAudience[] = ["PROGRAMME", "DONOR", "FIELD", "EXECUTIVE"];

/** What kind of indicator suits a role; the suggestion never matches a role to an indicator of another kind. */
export type RoleIndicatorType = "COUNT" | "PERCENTAGE" | "RATIO" | "CURRENCY" | "ANY";

export interface IndicatorRole {
  /** Lower-case words and underscores; the key a template's widgets point at. */
  key: string;
  label: string;
  /** One sentence for the person mapping it: what to choose. */
  hint: string;
  /** Words an indicator's code or name is likely to contain (lower case). */
  keywords: string[];
  types: RoleIndicatorType[];
  required: boolean;
}

export type TemplateWidgetKind = "CHART" | "TEXT";

export interface TemplateWidget {
  id: string;
  kind: TemplateWidgetKind;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** CHART: what to draw, by role. */
  chart?: { kind: ChartKind; template: DataChartTemplate; roleKeys: string[]; measure: ChartMeasure; showTarget: boolean } | undefined;
  /** TEXT: a short note (plain text). */
  text?: string | undefined;
}

export interface DashboardTemplate {
  id: string;
  sector: SectorKey;
  title: string;
  description: string;
  audience: TemplateAudience;
  /** Always a draft: no template is signed off, so none is ever locked. */
  status: "DRAFT";
  origin: "BUILT_IN" | "ORGANISATION";
  /** The template this one was copied from, when it was. */
  basedOn?: string | undefined;
  /** Counts every saved edit. */
  revision: number;
  roles: IndicatorRole[];
  widgets: TemplateWidget[];
}

export const MAX_TEMPLATE_ROLES = 30;
const ROLE_KEY = /^[a-z][a-z0-9_]{1,39}$/;

export interface TemplateProblem { code: string; subject: string; message: string }

/** Everything wrong with a template, as sentences. An empty list means it can be saved and applied. */
export function templateProblems(t: DashboardTemplate): TemplateProblem[] {
  const out: TemplateProblem[] = [];
  const add = (code: string, subject: string, message: string) => out.push({ code, subject, message });
  if (!t.title.trim()) add("TITLE_REQUIRED", "", "A template needs a title.");
  if (t.title.length > 120) add("TITLE_TOO_LONG", "", "A template's title is at most 120 characters.");
  if (t.description.length > 500) add("DESCRIPTION_TOO_LONG", "", "A template's description is at most 500 characters.");
  if (t.roles.length > MAX_TEMPLATE_ROLES) add("TOO_MANY_ROLES", "", `A template holds at most ${MAX_TEMPLATE_ROLES} indicator roles.`);
  if (t.widgets.length > MAX_WIDGETS) add("TOO_MANY_WIDGETS", "", `A template holds at most ${MAX_WIDGETS} charts.`);
  const roleKeys = new Set<string>();
  for (const r of t.roles) {
    if (!ROLE_KEY.test(r.key)) add("ROLE_KEY", r.key, "A role's key uses lower-case letters, digits and underscores, and starts with a letter.");
    if (roleKeys.has(r.key)) add("ROLE_DUPLICATE", r.key, "Two roles share a key.");
    roleKeys.add(r.key);
    if (!r.label.trim()) add("ROLE_LABEL", r.key, "A role needs a name.");
  }
  const widgetIds = new Set<string>();
  for (const w of t.widgets) {
    if (!w.id || widgetIds.has(w.id)) add("WIDGET_DUPLICATE", w.id, "Two charts share an id.");
    widgetIds.add(w.id);
    const cells = [w.x, w.y, w.w, w.h];
    if (!cells.every((n) => Number.isInteger(n)) || w.x < 0 || w.y < 0) add("WIDGET_POSITION", w.id, "A chart's position and size must be whole, non-negative cells.");
    else {
      if (w.w < WIDGET_MIN_W || w.h < WIDGET_MIN_H) add("WIDGET_SIZE", w.id, `A chart is at least ${WIDGET_MIN_W} wide and ${WIDGET_MIN_H} high.`);
      if (w.h > WIDGET_MAX_H) add("WIDGET_SIZE", w.id, `A chart is at most ${WIDGET_MAX_H} high.`);
      if (w.x + w.w > GRID_COLUMNS) add("WIDGET_POSITION", w.id, `A chart cannot go past column ${GRID_COLUMNS}.`);
    }
    if (w.title.length > 200) add("WIDGET_TITLE", w.id, "A chart's title is at most 200 characters.");
    if (w.kind === "TEXT") {
      if (!w.text?.trim()) add("TEXT_EMPTY", w.id, "A text block needs some text.");
      continue;
    }
    const c = w.chart;
    if (!c) { add("CHART_MISSING", w.id, "A chart widget needs its chart settings."); continue; }
    if (!DATA_CHART_TEMPLATES[c.template]) add("CHART_TEMPLATE", w.id, "The data this chart is drawn from is not known.");
    if (!CHART_KINDS[c.kind]) add("CHART_KIND", w.id, "This chart type is not offered.");
    if (!CHART_MEASURES.includes(c.measure)) add("CHART_MEASURE", w.id, "What to measure is not known.");
    for (const key of c.roleKeys) if (!roleKeys.has(key)) add("CHART_ROLE", w.id, `This chart uses a role that is not in the template (${key}).`);
    const info = DATA_CHART_TEMPLATES[c.template];
    if (info) {
      if (info.indicators === "one" && c.roleKeys.length !== 1) add("CHART_ROLE_COUNT", w.id, "Choose exactly one role for this chart.");
      if (info.indicators === "many" && c.roleKeys.length < 1) add("CHART_ROLE_COUNT", w.id, "Choose at least one role for this chart.");
      if (info.indicators === "none" && c.roleKeys.length !== 0) add("CHART_ROLE_COUNT", w.id, "This chart takes no indicators.");
    }
  }
  return out;
}

/* ---------- editing tools: every one returns a new template, or says why not ---------- */

export type TemplateEdit = { ok: true; template: DashboardTemplate } | { ok: false; reason: string };

const edited = (t: DashboardTemplate, patch: Partial<DashboardTemplate>): DashboardTemplate => ({ ...t, ...patch, status: "DRAFT", revision: t.revision + 1 });

/** Checks the result of an edit as a whole, so no tool can leave a template that cannot be applied. */
const checked = (next: DashboardTemplate): TemplateEdit => {
  const problems = templateProblems(next);
  return problems.length > 0 ? { ok: false, reason: problems[0]!.message } : { ok: true, template: next };
};

/** A copy to edit. A built-in template is never changed in place: the copy is the organisation's own. */
export function copyTemplate(t: DashboardTemplate, input: { id: string; title?: string }): DashboardTemplate {
  return {
    ...t,
    id: input.id,
    title: input.title?.trim() || `${t.title} (copy)`,
    status: "DRAFT",
    origin: "ORGANISATION",
    basedOn: t.id,
    revision: 1,
    roles: t.roles.map((r) => ({ ...r, keywords: [...r.keywords], types: [...r.types] })),
    widgets: t.widgets.map((w) => ({ ...w, ...(w.chart ? { chart: { ...w.chart, roleKeys: [...w.chart.roleKeys] } } : {}) })),
  };
}

export function updateTemplateDetails(t: DashboardTemplate, patch: Partial<Pick<DashboardTemplate, "title" | "description" | "sector" | "audience">>): TemplateEdit {
  return checked(edited(t, patch));
}

export function addTemplateRole(t: DashboardTemplate, role: IndicatorRole): TemplateEdit {
  if (t.roles.some((r) => r.key === role.key)) return { ok: false, reason: "A role with this key already exists." };
  return checked(edited(t, { roles: [...t.roles, role] }));
}

/** A role's key never changes (charts point at it); everything else about it can. */
export function updateTemplateRole(t: DashboardTemplate, key: string, patch: Partial<Omit<IndicatorRole, "key">>): TemplateEdit {
  if (!t.roles.some((r) => r.key === key)) return { ok: false, reason: "This role is not in the template." };
  return checked(edited(t, { roles: t.roles.map((r) => (r.key === key ? { ...r, ...patch } : r)) }));
}

/** Removing a role that charts use is refused, naming them: nothing disappears from a dashboard without a person choosing it. */
export function removeTemplateRole(t: DashboardTemplate, key: string): TemplateEdit {
  if (!t.roles.some((r) => r.key === key)) return { ok: false, reason: "This role is not in the template." };
  const users = t.widgets.filter((w) => w.chart?.roleKeys.includes(key));
  if (users.length > 0) return { ok: false, reason: `Charts still use this role: ${users.map((w) => w.title || w.id).join(", ")}. Change or remove them first.` };
  return checked(edited(t, { roles: t.roles.filter((r) => r.key !== key) }));
}

export function addTemplateWidget(t: DashboardTemplate, widget: Omit<TemplateWidget, "x" | "y" | "w" | "h"> & Partial<Pick<TemplateWidget, "w" | "h">>): TemplateEdit {
  if (t.widgets.length >= MAX_WIDGETS) return { ok: false, reason: `A template holds at most ${MAX_WIDGETS} charts.` };
  if (t.widgets.some((w) => w.id === widget.id)) return { ok: false, reason: "A chart with this id already exists." };
  const bottom = t.widgets.reduce((max, w) => Math.max(max, w.y + w.h), 0);
  const placed = { ...widget, x: 0, y: bottom, w: widget.w ?? 6, h: widget.h ?? 4 };
  const widgets = settleLayout([...t.widgets, placed]);
  return checked(edited(t, { widgets }));
}

export function updateTemplateWidget(t: DashboardTemplate, id: string, patch: Partial<Pick<TemplateWidget, "title" | "chart" | "text">>): TemplateEdit {
  if (!t.widgets.some((w) => w.id === id)) return { ok: false, reason: "This chart is not in the template." };
  return checked(edited(t, { widgets: t.widgets.map((w) => (w.id === id ? { ...w, ...patch } : w)) }));
}

export function moveTemplateWidget(t: DashboardTemplate, id: string, x: number, y: number): TemplateEdit {
  if (!t.widgets.some((w) => w.id === id)) return { ok: false, reason: "This chart is not in the template." };
  return checked(edited(t, { widgets: moveWidget(t.widgets, id, x, y) }));
}

export function resizeTemplateWidget(t: DashboardTemplate, id: string, w: number, h: number): TemplateEdit {
  if (!t.widgets.some((x) => x.id === id)) return { ok: false, reason: "This chart is not in the template." };
  return checked(edited(t, { widgets: resizeWidget(t.widgets, id, w, h) }));
}

export function removeTemplateWidget(t: DashboardTemplate, id: string): TemplateEdit {
  if (!t.widgets.some((w) => w.id === id)) return { ok: false, reason: "This chart is not in the template." };
  return checked(edited(t, { widgets: removeWidget(t.widgets, id) }));
}

/* ---------- applying a template to a project ---------- */

export interface ProjectIndicatorFacts {
  id: string;
  code: string;
  name: string;
  type: string;
  isRate: boolean;
}

const words = (s: string): string[] => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1);

const typeFits = (role: IndicatorRole, i: ProjectIndicatorFacts): boolean => {
  if (role.types.includes("ANY")) return true;
  return role.types.some((t) => (t === "PERCENTAGE" || t === "RATIO" ? i.isRate : t === "COUNT" ? !i.isRate && i.type !== "CURRENCY" : i.type === "CURRENCY"));
};

/**
 * Suggests which of the project's indicators answers each role: by words the code or name shares with the role's keywords,
 * among indicators of a fitting kind. One indicator answers at most one role; a role with no clear match stays null (never a
 * guess). The person always confirms or changes it.
 */
export function suggestRoleMapping(roles: ReadonlyArray<IndicatorRole>, indicators: ReadonlyArray<ProjectIndicatorFacts>): Record<string, string | null> {
  const scored: Array<{ role: string; indicator: string; code: string; score: number }> = [];
  for (const r of roles) {
    const keys = new Set(r.keywords.flatMap(words));
    for (const i of indicators) {
      if (!typeFits(r, i)) continue;
      const hay = new Set(words(`${i.code} ${i.name}`));
      let score = 0;
      for (const k of keys) if (hay.has(k)) score += 2;
      // A whole keyword phrase inside the name is a stronger sign than scattered words.
      for (const phrase of r.keywords) if (phrase.includes(" ") && i.name.toLowerCase().includes(phrase)) score += 2;
      if (score >= 2) scored.push({ role: r.key, indicator: i.id, code: i.code, score });
    }
  }
  scored.sort((a, b) => b.score - a.score || a.code.localeCompare(b.code) || a.role.localeCompare(b.role));
  const mapping: Record<string, string | null> = Object.fromEntries(roles.map((r) => [r.key, null]));
  const taken = new Set<string>();
  for (const s of scored) {
    if (mapping[s.role] !== null || taken.has(s.indicator)) continue;
    mapping[s.role] = s.indicator;
    taken.add(s.indicator);
  }
  return mapping;
}

export interface AppliedWidget {
  widget: TemplateWidget;
  /** READY: draw it. NEEDS_INDICATOR: say which role to choose; nothing is drawn and nothing is invented. */
  state: "READY" | "NEEDS_INDICATOR";
  spec?: ChartSpecV2;
  missingRoles: string[];
}

export interface AppliedTemplate {
  widgets: AppliedWidget[];
  /** Required roles with no indicator chosen. */
  unmappedRequired: string[];
}

/** Turns a template and a role mapping into charts for one project. Works with a partial mapping: a chart whose roles are unmapped says so. */
export function applyTemplate(t: DashboardTemplate, mapping: Readonly<Record<string, string | null | undefined>>): AppliedTemplate {
  const chosen = (key: string): string | null => mapping[key] ?? null;
  const widgets: AppliedWidget[] = t.widgets.map((widget) => {
    const c = widget.chart;
    if (widget.kind !== "CHART" || !c) return { widget, state: "READY", missingRoles: [] };
    const missing = c.roleKeys.filter((k) => chosen(k) === null);
    const ids = c.roleKeys.map(chosen).filter((id): id is string => id !== null);
    const info = DATA_CHART_TEMPLATES[c.template];
    const enough = info ? (info.indicators === "one" ? ids.length === 1 : info.indicators === "many" ? ids.length >= 1 : true) : false;
    if (!enough) return { widget, state: "NEEDS_INDICATOR", missingRoles: missing };
    const spec: ChartSpecV2 = {
      version: 2,
      kind: c.kind,
      dataset: { template: c.template, indicatorIds: ids, measure: c.measure, showTarget: c.showTarget, includeDraft: true },
      ...(widget.title ? { title: widget.title } : {}),
    };
    // A template that cannot be drawn as written is reported as needing a choice, never drawn wrongly.
    if (validateChartSpec(spec, { allowPlanned: true }).length > 0) return { widget, state: "NEEDS_INDICATOR", missingRoles: missing };
    return { widget, state: "READY", spec, missingRoles: missing };
  });
  const unmappedRequired = t.roles.filter((r) => r.required && chosen(r.key) === null).map((r) => r.key);
  return { widgets, unmappedRequired };
}
