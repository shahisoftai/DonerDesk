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

/** ISO 4217 alpha-3 currency code. */
export const CurrencyCodeSchema = z
  .string()
  .regex(/^[A-Z]{3}$/, "Currency must be a 3-letter ISO 4217 code");

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
    budgetCurrency: CurrencyCodeSchema.optional(),
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

export const UpdateProjectSchema = z
  .object({
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
    budgetCurrency: CurrencyCodeSchema.optional(),
    reportingFrequency: ReportingFrequencySchema.optional(),
    description: z.string().max(2000).optional(),
    primaryContactName: z.string().max(200).optional(),
    projectManagerId: z.string().optional(),
    meOfficerId: z.string().optional(),
    reportingOfficerId: z.string().optional(),
    status: ProjectStatusSchema.optional(),
    /** An IANA zone for this project's own "today"; null or empty clears it (the organisation zone applies). */
    timeZone: z.string().max(64).nullable().optional(),
  })
  .superRefine((d, ctx) => {
    if (d.startDate && d.endDate && new Date(d.endDate).getTime() < new Date(d.startDate).getTime()) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "endDate must be on or after startDate" });
    }
  });
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;

/** Programmes group grants and projects (see the funding module in the domain). Text is cleaned by the domain, not here. */
export const SaveProgrammeSchema = z.object({
  name: z.string().max(200),
  code: z.string().max(60).optional(),
  description: z.string().max(4000).optional(),
  status: z.enum(["ACTIVE", "CLOSED"]).optional(),
});
export type SaveProgrammeInput = z.infer<typeof SaveProgrammeSchema>;

export const SaveGrantSchema = z.object({
  title: z.string().max(300),
  donorName: z.string().max(200),
  programmeId: z.string().max(100).optional(),
  awardNumber: z.string().max(100).optional(),
  amount: z.string().max(40).optional(),
  currency: z.string().max(8).optional(),
  startDate: z.string().max(40).optional(),
  endDate: z.string().max(40).optional(),
  status: z.enum(["ACTIVE", "CLOSED"]).optional(),
});
export type SaveGrantInput = z.infer<typeof SaveGrantSchema>;

/** Where a project sits; `null` takes it out. A grant that belongs to a programme brings the programme with it. */
export const PlaceProjectSchema = z.object({
  programmeId: z.string().max(100).nullable().optional(),
  grantId: z.string().max(100).nullable().optional(),
});
export type PlaceProjectInput = z.infer<typeof PlaceProjectSchema>;
