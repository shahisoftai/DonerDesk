import { z } from "zod";

const SpecSchema = z.object({
  template: z.string(), indicatorIds: z.array(z.string()), measure: z.string(), type: z.string(),
  fromPeriodId: z.string().optional(), toPeriodId: z.string().optional(), showTarget: z.boolean(), title: z.string().optional(), colors: z.array(z.string()).optional(),
});
export const WidgetSchema = z.object({ id: z.string(), projectId: z.string(), spec: SpecSchema, x: z.number(), y: z.number(), w: z.number(), h: z.number() });

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
  chart: z.object({ option: z.record(z.unknown()), title: z.string(), notes: z.array(z.string()), unverified: z.number(), points: z.number() }).optional(),
  unavailable: z.string().optional(),
});
export type ChartDrawing = z.infer<typeof ChartDrawingSchema>;
export const DashboardDataSchema = z.object({ charts: z.array(ChartDrawingSchema) });

export const DashboardLinkSchema = z.object({ id: z.string(), label: z.string(), expiresAt: z.string(), live: z.boolean(), revoked: z.boolean() });
export type DashboardLinkView = z.infer<typeof DashboardLinkSchema>;
export const DashboardLinkListSchema = z.object({ links: z.array(DashboardLinkSchema) });
export const DashboardLinkCreatedSchema = z.object({ id: z.string(), token: z.string(), expiresAt: z.string() });

export const SavedDashboardSchema = z.object({ id: z.string(), updatedAt: z.string() });
export const AddedChartSchema = z.object({ chartCount: z.number() });

export const PublicDashboardSchema = z.object({ name: z.string(), widgets: z.array(WidgetSchema), charts: z.array(ChartDrawingSchema) });
