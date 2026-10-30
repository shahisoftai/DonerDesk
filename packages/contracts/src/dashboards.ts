import { z } from "zod";

const ChartSpecSchema = z.object({
  template: z.enum(["INDICATOR_OVER_TIME", "INDICATOR_VS_TARGET", "INDICATORS_PROGRESS", "INDICATORS_OVER_TIME", "STATUS_DISTRIBUTION", "FINANCE_BUDGET_VS_SPEND", "FINANCE_BURN_RATE"]),
  indicatorIds: z.array(z.string()).max(20),
  measure: z.enum(["PERIOD", "CUMULATIVE", "PERCENT_OF_TARGET"]),
  type: z.enum(["BAR", "LINE", "PIE", "AREA", "RADAR", "GAUGE"]),
  fromPeriodId: z.string().optional(),
  toPeriodId: z.string().optional(),
  showTarget: z.boolean(),
  title: z.string().max(200).optional(),
  colors: z.array(z.string()).max(12).optional(),
});

/** The Chart Studio's specification; its rules are `validateChartSpec`'s (domain), applied by the handlers. */
const ChartSpecV2WidgetSchema = z.object({ version: z.literal(2), kind: z.string().max(40), dataset: z.record(z.unknown()) }).passthrough();
const WidgetSpecSchema = z.union([ChartSpecV2WidgetSchema, ChartSpecSchema]);

export const ReportQuerySchema = z.object({
  indicatorIds: z.array(z.string().min(1)).min(1).max(30),
  fromPeriodId: z.string().optional(),
  toPeriodId: z.string().optional(),
  measure: z.enum(["PERIOD", "CUMULATIVE", "PERCENT_OF_TARGET"]),
  rows: z.enum(["INDICATOR", "PERIOD"]),
  includeDraft: z.boolean(),
  breakdown: z.enum(["SEX", "AGE_GROUP", "DISABILITY", "LOCATION", "OTHER"]).optional(),
});
export const MapWidgetSchema = z.object({ view: z.enum(["RESULTS", "ACTIVITIES"]), title: z.string().max(60).optional() });
export const MetricQuerySchema = z.object({
  metric: z.enum(["FIN_OBLIGATED", "FIN_RECEIVED", "FIN_SPENT", "FIN_REMAINING", "ACTIVITIES_TOTAL", "ACTIVITIES_IN_PROGRESS", "ACTIVITIES_DONE", "ACTIVITIES_LATE"]),
  color: z.enum(["ORANGE", "GREEN", "GREY", "PURPLE", "BLUE", "RED"]).optional(),
  currency: z.string().length(3).optional(),
  title: z.string().max(60).optional(),
});
export const KpiQuerySchema = z.object({ indicatorId: z.string().min(1), includeDraft: z.boolean(), toPeriodId: z.string().optional(), color: z.enum(["ORANGE", "GREEN", "GREY", "PURPLE", "BLUE", "RED"]).optional(), title: z.string().max(60).optional() });
export const DashboardWidgetSchema = z.object({
  id: z.string().min(1).max(64),
  projectId: z.string().min(1),
  kind: z.enum(["CHART", "TEXT", "REPORT", "KPI", "METRIC", "MAP"]).optional(),
  metric: MetricQuerySchema.optional(),
  map: MapWidgetSchema.optional(),
  kpi: KpiQuerySchema.optional(),
  spec: WidgetSpecSchema.optional(),
  report: ReportQuerySchema.optional(),
  text: z.string().max(2000).optional(),
  tab: z.string().max(40).optional(),
  x: z.number(), y: z.number(), w: z.number(), h: z.number(),
});

export const SaveDashboardSchema = z.object({
  name: z.string().trim().min(1).max(120),
  scope: z.enum(["ORG", "PROJECT", "MINE"]),
  projectId: z.string().optional(),
  widgets: z.array(DashboardWidgetSchema).max(24),
  /** The `updatedAt` the person was looking at; when someone else has saved since, the save is refused. */
  expectedUpdatedAt: z.string().max(40).optional(),
});
export type SaveDashboardInput = z.infer<typeof SaveDashboardSchema>;

export const AddDashboardWidgetSchema = z.object({ projectId: z.string().min(1), spec: WidgetSpecSchema.optional(), report: ReportQuerySchema.optional(), kpi: KpiQuerySchema.optional(), metric: MetricQuerySchema.optional(), map: MapWidgetSchema.optional(), title: z.string().trim().max(120).optional() }).refine((v) => (v.spec ? 1 : 0) + (v.report ? 1 : 0) + (v.kpi ? 1 : 0) + (v.metric ? 1 : 0) + (v.map ? 1 : 0) === 1, { message: "Add either a chart, a report, a KPI tile or a number tile." });
export type AddDashboardWidgetInput = z.infer<typeof AddDashboardWidgetSchema>;

export const CreateDashboardShareSchema = z.object({ label: z.string().trim().min(1).max(120), expiresInDays: z.number().int().min(1).max(180).default(30) });
export type CreateDashboardShareInput = z.infer<typeof CreateDashboardShareSchema>;

export const ListDashboardsQuerySchema = z.object({ projectId: z.string().optional() });

export const AskQuestionSchema = z.object({ question: z.string().trim().min(3).max(500) });
export type AskQuestionInput = z.infer<typeof AskQuestionSchema>;

/** Asking the data sheet for figures (Phase 34.0): several named queries, each against one project, answered in one call. */
export const DatasetQuerySchema = z.object({
  indicatorIds: z.array(z.string().min(1)).max(50),
  measure: z.enum(["PERIOD", "CUMULATIVE", "PERCENT_OF_TARGET"]),
  fromPeriodId: z.string().optional(),
  toPeriodId: z.string().optional(),
  includeDraft: z.boolean(),
  sources: z.array(z.enum(["PLAN", "ACTIVITY_DAYS", "BUDGET", "PLACES"])).max(4).optional(),
  placeLevel: z.number().int().min(0).max(4).optional(),
});

export const ResolveDatasetsSchema = z.object({
  requests: z.array(z.object({ key: z.string().min(1).max(64), projectId: z.string().min(1), query: DatasetQuerySchema })).min(1).max(24),
});
export type ResolveDatasetsInput = z.infer<typeof ResolveDatasetsSchema>;

/**
 * A saved chart (Phase 34.1). The specification is checked by the one validator, `validateChartSpec` (domain), in the handler; this
 * only says it is a v2 specification object, so the contract cannot drift from the rules.
 */
export const SavedChartSpecSchema = z.object({ version: z.literal(2), kind: z.string().max(40), dataset: z.record(z.unknown()) }).passthrough();

export const SaveChartSchema = z.object({
  name: z.string().trim().min(1).max(120),
  scope: z.enum(["MINE", "PROJECT"]),
  projectId: z.string().min(1),
  spec: SavedChartSpecSchema,
  /** The `updatedAt` the person was looking at; when someone else has saved since, the save is refused. */
  expectedUpdatedAt: z.string().max(40).optional(),
});
export type SaveChartInput = z.infer<typeof SaveChartSchema>;

export const ListChartsQuerySchema = z.object({ projectId: z.string().min(1) });

/**
 * A dashboard template (Phase 34.3). Its rules are `templateProblems`' (domain), applied by the handlers; this only says it is shaped
 * like one, so the contract cannot drift from them.
 */
export const DashboardTemplateBodySchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().max(500).default(""),
  sector: z.string().min(1).max(40),
  audience: z.enum(["PROGRAMME", "DONOR", "FIELD", "EXECUTIVE"]),
  roles: z.array(z.object({ key: z.string().max(40), label: z.string().max(120), hint: z.string().max(300), keywords: z.array(z.string().max(60)).max(20), types: z.array(z.string()).max(6), required: z.boolean() })).max(30),
  widgets: z.array(z.record(z.unknown())).max(24),
  basedOn: z.string().max(80).optional(),
  /** The `updatedAt` the person was looking at; when someone else has saved since, the save is refused. */
  expectedUpdatedAt: z.string().max(40).optional(),
});
export type DashboardTemplateBody = z.infer<typeof DashboardTemplateBodySchema>;

export const ApplyDashboardTemplateSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  scope: z.enum(["MINE", "PROJECT"]),
  /** Role key to the project's indicator id (null = not chosen). */
  mapping: z.record(z.string().nullable()),
});
export type ApplyDashboardTemplateInput = z.infer<typeof ApplyDashboardTemplateSchema>;

export const AddBookmarkSchema = z.object({ title: z.string().max(200), href: z.string().max(500) });
export type AddBookmarkInput = z.infer<typeof AddBookmarkSchema>;

export const SaveReportSchema = z.object({
  name: z.string().trim().min(1).max(120),
  scope: z.enum(["MINE", "PROJECT"]),
  projectId: z.string().min(1),
  query: ReportQuerySchema,
  expectedUpdatedAt: z.string().optional(),
});
export type SaveReportInput = z.infer<typeof SaveReportSchema>;
