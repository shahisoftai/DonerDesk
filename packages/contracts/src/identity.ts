import { z } from "zod";
import { ProfileToneSchema } from "./reporting-profile.js";
import { StorageProviderSchema } from "./evidence.js";

export const RoleSchema = z.enum([
  "ADMIN",
  "PROJECT_MANAGER",
  "ME_OFFICER",
  "GRANTS_OFFICER",
  "FIELD_OFFICER",
  "COMPLIANCE_OFFICER",
  "VIEWER",
]);

export const OrganizationTypeSchema = z.enum([
  "LOCAL_NGO",
  "NATIONAL_NGO",
  "INGO",
  "UN_IMPLEMENTING_PARTNER",
  "CONSULTING_FIRM",
  "GOVERNMENT_UNIT",
  "OTHER",
]);

export const SectorSchema = z.enum([
  "NUTRITION",
  "FOOD_SECURITY",
  "WASH",
  "HEALTH",
  "PROTECTION",
  "EDUCATION",
  "LIVELIHOODS",
  "SHELTER",
  "MULTI_SECTOR",
  "OTHER",
]);

export const LanguageCodeSchema = z.enum(["en", "ar", "ur", "fr", "ps"]);

export const UserStatusSchema = z.enum(["INVITED", "ACTIVE", "SUSPENDED", "REMOVED"]);
export const DataResidencySchema = z.enum(["EU", "US", "AFRICA", "ASIA", "DEFAULT"]);

export const EmailSchema = z.string().email().max(254);

export const SignUpSchema = z.object({
  name: z.string().min(2).max(120),
  email: EmailSchema,
  password: z.string().min(8).max(200),
  requestedPlan: z.enum(["STARTER", "TEAM", "GROWTH"]).optional(),
  organization: z.object({
    name: z.string().min(2).max(200),
    organizationType: OrganizationTypeSchema,
    country: z.string().min(2).max(100),
    primarySector: SectorSchema,
    defaultLanguage: LanguageCodeSchema.default("en"),
    dataResidency: DataResidencySchema.default("DEFAULT"),
    aiEnabled: z.boolean().default(true),
  }),
});
export type SignUpInput = z.infer<typeof SignUpSchema>;

export const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const GoogleSignInSchema = z.object({
  code: z.string().min(1),
  requestedPlan: z.enum(["STARTER", "TEAM", "GROWTH"]).optional(),
});
export type GoogleSignInInput = z.infer<typeof GoogleSignInSchema>;

export const GoogleSignInResponseSchema = z.object({
  token: z.string().min(1),
  userId: z.string(),
  tenantId: z.string(),
  role: RoleSchema,
  name: z.string(),
  email: z.string().email(),
  provisioned: z.boolean().default(false),
});
export type GoogleSignInResponse = z.infer<typeof GoogleSignInResponseSchema>;

export const InviteUserSchema = z.object({
  email: EmailSchema,
  role: RoleSchema,
  projectIds: z.array(z.string()).default([]),
});
export type InviteUserInput = z.infer<typeof InviteUserSchema>;

export const ChangeRoleSchema = z.object({
  userId: z.string().min(1),
  role: RoleSchema,
});

export const OrganizationReportingDefaultsSchema = z
  .object({
    tone: ProfileToneSchema.default("FORMAL"),
    formattingRules: z.array(z.string().max(200)).max(50).default([]),
    deadlineOffsetDays: z.number().int().min(0).max(365).optional(),
    autoPeriodCreation: z.boolean().default(false),
  })
  .partial();

export const UpdateOrganizationReportingDefaultsSchema = z.object({
  reportingDefaults: OrganizationReportingDefaultsSchema,
  /** Account-wide report language; also updates Organization.defaultLanguage. */
  language: LanguageCodeSchema.optional(),
});
export type UpdateOrganizationReportingDefaultsInput = z.infer<typeof UpdateOrganizationReportingDefaultsSchema>;

export const OrganizationProfileSchema = z.object({
  name: z.string().min(2),
  organizationType: OrganizationTypeSchema,
  country: z.string().min(2),
  sectors: z.array(SectorSchema).min(1),
  contactName: z.string().min(1),
  contactEmail: EmailSchema,
  website: z.string().url().optional(),
  defaultLanguage: LanguageCodeSchema,
  logoUrl: z.string().url().optional(),
  mainOfficeLocation: z.string().optional(),
  donorTypesServed: z.string().optional(),
  dataResidency: DataResidencySchema,
  aiEnabled: z.boolean(),
  storageProvider: StorageProviderSchema.default("LOCAL"),
});
export type OrganizationProfileInput = z.infer<typeof OrganizationProfileSchema>;
