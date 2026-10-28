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

export const DashboardWidgetSchema = z.object({
  id: z.string().min(1).max(64),
  projectId: z.string().min(1),
  spec: ChartSpecSchema,
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

export const AddDashboardWidgetSchema = z.object({ projectId: z.string().min(1), spec: ChartSpecSchema });
export type AddDashboardWidgetInput = z.infer<typeof AddDashboardWidgetSchema>;

export const CreateDashboardShareSchema = z.object({ label: z.string().trim().min(1).max(120), expiresInDays: z.number().int().min(1).max(180).default(30) });
export type CreateDashboardShareInput = z.infer<typeof CreateDashboardShareSchema>;

export const ListDashboardsQuerySchema = z.object({ projectId: z.string().optional() });
