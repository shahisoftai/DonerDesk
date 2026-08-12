import { z } from "zod";

const requiredText = z.string().min(1, "Required");
const optionalText = z.string().optional();

export const ProjectWizardStepSchema = z.object({
  title: requiredText,
  projectCode: requiredText,
  donorName: requiredText,
  implementingOrganization: requiredText,
  partnerOrganization: optionalText,
});

export const ProjectWizardGeographySchema = z.object({
  country: requiredText,
  region: optionalText,
  district: optionalText,
  sector: z.enum(["NUTRITION", "FOOD_SECURITY", "WASH", "HEALTH", "PROTECTION", "EDUCATION", "LIVELIHOODS", "SHELTER", "MULTI_SECTOR", "OTHER"]),
  startDate: requiredText,
  endDate: requiredText,
});

export const ProjectWizardReportingSchema = z.object({
  reportingFrequency: z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL", "FINAL", "CUSTOM"]),
  budgetAmount: z.string().optional(),
  budgetCurrency: z.string().optional(),
  primaryContactName: optionalText,
  description: optionalText,
});

export type ProjectWizardData = {
  step: ProjectWizardStepInput;
  geography: ProjectWizardGeographyInput;
  reporting: ProjectWizardReportingInput;
};

export type ProjectWizardStepInput = z.infer<typeof ProjectWizardStepSchema>;
export type ProjectWizardGeographyInput = z.infer<typeof ProjectWizardGeographySchema>;
export type ProjectWizardReportingInput = z.infer<typeof ProjectWizardReportingSchema>;

export type WizardFieldErrors = Record<string, string[]>;

export function validateStep(
  step: "identity" | "geography" | "reporting",
  data: ProjectWizardData,
): WizardFieldErrors {
  if (step === "identity") return flatten(ProjectWizardStepSchema.safeParse(data.step));
  if (step === "geography") return flatten(ProjectWizardGeographySchema.safeParse(data.geography));
  return flatten(ProjectWizardReportingSchema.safeParse(data.reporting));
}

function flatten(result: { success: boolean; error?: { flatten: () => { fieldErrors: Record<string, string[] | undefined> } } }): WizardFieldErrors {
  if (result.success) return {};
  const flat = result.error?.flatten().fieldErrors ?? {};
  const out: WizardFieldErrors = {};
  for (const [k, v] of Object.entries(flat)) {
    if (v && v.length > 0) out[k] = v;
  }
  return out;
}

export function mergeInputErrors(step: "identity" | "geography" | "reporting", data: ProjectWizardData): WizardFieldErrors {
  return validateStep(step, data);
}

export function emptyWizardData(): ProjectWizardData {
  return {
    step: { title: "", projectCode: "", donorName: "", implementingOrganization: "", partnerOrganization: "" },
    geography: { country: "", region: "", district: "", sector: "NUTRITION", startDate: "", endDate: "" },
    reporting: { reportingFrequency: "QUARTERLY", budgetAmount: "", budgetCurrency: "", primaryContactName: "", description: "" },
  };
}
