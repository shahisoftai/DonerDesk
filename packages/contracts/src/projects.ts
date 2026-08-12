import { z } from "zod";
import { SectorSchema } from "./identity.js";

export const ProjectStatusSchema = z.enum(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]);

export const ReportingFrequencySchema = z.enum([
  "MONTHLY",
  "QUARTERLY",
  "SEMI_ANNUAL",
  "ANNUAL",
  "FINAL",
  "CUSTOM",
]);

export const CreateProjectSchema = z
  .object({
    title: z.string().min(2).max(200),
    projectCode: z.string().min(1).max(50),
    donorName: z.string().min(1).max(200),
    implementingOrganization: z.string().min(1).max(200),
    partnerOrganization: z.string().max(200).optional(),
    country: z.string().min(2).max(100),
    region: z.string().max(100).optional(),
    district: z.string().max(100).optional(),
    sector: SectorSchema,
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    budgetAmount: z.number().nonnegative().optional(),
    budgetCurrency: z.string().length(3).optional(),
    reportingFrequency: ReportingFrequencySchema,
    description: z.string().max(2000).optional(),
    primaryContactName: z.string().max(200).optional(),
    projectManagerId: z.string().optional(),
    meOfficerId: z.string().optional(),
    reportingOfficerId: z.string().optional(),
  })
  .refine((d) => new Date(d.endDate).getTime() >= new Date(d.startDate).getTime(), {
    message: "endDate must be on or after startDate",
    path: ["endDate"],
  });
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

export const UpdateProjectSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  projectCode: z.string().min(1).max(50).optional(),
  donorName: z.string().min(1).max(200).optional(),
  implementingOrganization: z.string().min(1).max(200).optional(),
  partnerOrganization: z.string().max(200).optional(),
  country: z.string().min(2).max(100).optional(),
  region: z.string().max(100).optional(),
  district: z.string().max(100).optional(),
  sector: SectorSchema.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  budgetAmount: z.number().nonnegative().optional(),
  budgetCurrency: z.string().length(3).optional(),
  reportingFrequency: ReportingFrequencySchema.optional(),
  description: z.string().max(2000).optional(),
  primaryContactName: z.string().max(200).optional(),
  projectManagerId: z.string().optional(),
  meOfficerId: z.string().optional(),
  reportingOfficerId: z.string().optional(),
  status: ProjectStatusSchema.optional(),
});
