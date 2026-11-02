import { z } from "zod";

const Risk = z.object({ kind: z.string().nullable().optional(), title: z.string().nullable(), seriousness: z.string().nullable(), mitigation: z.string().nullable() });
const Pack = z.object({
  id: z.string(), sector: z.string().nullable(), label: z.string(), cadence: z.string().optional(), reviewMode: z.string().optional(),
  reportRules: z.array(z.object({ reportType: z.string(), template: z.string(), dueDaysAfterEnd: z.number() })),
  windowRule: z.object({ opensDaysBefore: z.number(), closesDaysAfter: z.number() }).optional(),
  risks: z.array(Risk), dashboardTemplate: z.string().optional(),
});
export const OrganisationPacksSchema = z.object({
  own: z.array(z.object({ sectorKey: z.string(), pack: Pack, updatedAt: z.string() })),
  builtIn: z.array(Pack),
  dashboards: z.array(z.object({ id: z.string(), title: z.string(), sector: z.string() })),
});
export type OrganisationPacks = z.infer<typeof OrganisationPacksSchema>;
export type PackView = z.infer<typeof Pack>;
