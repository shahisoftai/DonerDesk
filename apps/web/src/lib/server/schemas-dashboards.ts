import { z } from "zod";

const SpecSchema = z.object({
  template: z.string(), indicatorIds: z.array(z.string()), measure: z.string(), type: z.string(),
  fromPeriodId: z.string().optional(), toPeriodId: z.string().optional(), showTarget: z.boolean(), title: z.string().optional(), colors: z.array(z.string()).optional(),
});
/** A widget draws the older chart settings, a Chart Studio chart (`version: 2`), or is a text block. */
export const WidgetSchema = z.object({
  id: z.string(), projectId: z.string(), kind: z.enum(["CHART", "TEXT", "REPORT", "KPI", "METRIC", "MAP", "PROJECT_LIST"]).optional(), projectList: z.record(z.unknown()).optional(), report: z.record(z.unknown()).optional(), kpi: z.record(z.unknown()).optional(), metric: z.record(z.unknown()).optional(), map: z.record(z.unknown()).optional(),
  spec: z.union([SpecSchema, z.object({ version: z.literal(2) }).passthrough()]).optional(), text: z.string().optional(), tab: z.string().optional(),
  x: z.number(), y: z.number(), w: z.number(), h: z.number(),
});

export const DashboardSummarySchema = z.object({
  id: z.string(), name: z.string(), scope: z.enum(["ORG", "PROJECT", "MINE"]), projectId: z.string().optional(), ownerId: z.string(),
  mine: z.boolean(), canEdit: z.boolean(), chartCount: z.number(), updatedAt: z.string(),
});
export type DashboardSummary = z.infer<typeof DashboardSummarySchema>;
export const DashboardListSchema = z.object({ dashboards: z.array(DashboardSummarySchema) });

export const DashboardSchema = DashboardSummarySchema.extend({ widgets: z.array(WidgetSchema) });
export type DashboardView = z.infer<typeof DashboardSchema>;

export const ChartDrawingSchema = z.object({
  widgetId: z.string(),
  chart: z.object({ option: z.record(z.unknown()), title: z.string(), notes: z.array(z.string()), unverified: z.number(), points: z.number(), maps: z.array(z.string()).optional(), regionNames: z.array(z.string()).optional() }).optional(),
  table: z.object({ title: z.string(), columns: z.array(z.string()), rows: z.array(z.array(z.string().nullable())), notes: z.array(z.string()) }).optional(),
  kpi: z.object({ title: z.string(), color: z.enum(["ORANGE", "GREEN", "GREY", "PURPLE", "BLUE", "RED"]).nullable().default(null), unit: z.string().nullable(), value: z.number().nullable(), periodLabel: z.string().nullable(), target: z.string().nullable(), percentOfTarget: z.number().nullable(), spark: z.array(z.object({ label: z.string(), value: z.number().nullable() })), change: z.object({ direction: z.enum(["UP", "DOWN", "FLAT"]), delta: z.number(), percent: z.number().nullable(), sincePeriod: z.string(), good: z.boolean().nullable() }).nullable().default(null), status: z.enum(["NO_DATA", "NOT_JUDGED", "TARGET_MET", "IN_PROGRESS"]).default("NOT_JUDGED"), unverified: z.boolean(), notes: z.array(z.string()) }).optional(),
  metric: z.object({ title: z.string(), color: z.enum(["ORANGE", "GREEN", "GREY", "PURPLE", "BLUE", "RED"]), value: z.number().nullable(), text: z.string(), unit: z.string(), note: z.string().nullable() }).optional(),
  map: z.object({ view: z.enum(["RESULTS", "ACTIVITIES"]), title: z.string(), projectId: z.string(), preloaded: z.record(z.unknown()).optional() }).optional(),
  text: z.string().optional(),
  unavailable: z.string().optional(),
});
export type ChartDrawing = z.infer<typeof ChartDrawingSchema>;
export const DashboardDataSchema = z.object({ charts: z.array(ChartDrawingSchema), periods: z.array(z.object({ projectId: z.string(), id: z.string(), label: z.string() })).default([]) });

export const DashboardLinkSchema = z.object({ id: z.string(), label: z.string(), expiresAt: z.string(), live: z.boolean(), revoked: z.boolean() });
export type DashboardLinkView = z.infer<typeof DashboardLinkSchema>;
export const DashboardLinkListSchema = z.object({ links: z.array(DashboardLinkSchema) });
export const DashboardLinkCreatedSchema = z.object({ id: z.string(), token: z.string(), expiresAt: z.string() });

export const SavedDashboardSchema = z.object({ id: z.string(), updatedAt: z.string() });
export const AddedChartSchema = z.object({ chartCount: z.number() });

export const PublicDashboardSchema = z.object({ name: z.string(), widgets: z.array(WidgetSchema), charts: z.array(ChartDrawingSchema) });

/* ---------- templates (Phase 34.3) ---------- */
export const TemplateSummarySchema = z.object({
  id: z.string(), title: z.string(), description: z.string(), sector: z.string(), sectorLabel: z.string(), audience: z.enum(["PROGRAMME", "DONOR", "FIELD", "EXECUTIVE"]),
  origin: z.enum(["BUILT_IN", "ORGANISATION"]), basedOn: z.string().optional(), revision: z.number(), chartCount: z.number(), roleCount: z.number(), updatedAt: z.string().optional(), canEdit: z.boolean(),
});
export type TemplateSummary = z.infer<typeof TemplateSummarySchema>;
export const TemplateListSchema = z.object({ templates: z.array(TemplateSummarySchema) });
/** The whole template; its shape is the domain's `DashboardTemplate`, checked by `templateProblems` on save. */
export const TemplateDetailSchema = z.object({ template: z.record(z.unknown()), updatedAt: z.string().optional(), canEdit: z.boolean() });
export const TemplateWrittenSchema = z.object({ id: z.string(), updatedAt: z.string(), revision: z.number() });
export const TemplateAppliedSchema = z.object({ dashboardId: z.string(), updatedAt: z.string(), chartsLeftOut: z.array(z.object({ title: z.string(), missingRoles: z.array(z.string()) })) });
export type TemplateApplied = z.infer<typeof TemplateAppliedSchema>;
